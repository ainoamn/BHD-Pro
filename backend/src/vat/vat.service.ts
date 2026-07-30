import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID, createHash } from 'crypto';
import { Prisma } from '@prisma/client';

type OtaConfig = {
  mode?: 'mock' | 'sandbox' | 'live';
  apiBaseUrl?: string;
  clientId?: string;
  clientSecret?: string;
  clientSecretConfigured?: boolean;
  taxpayerTin?: string;
  submitPath?: string;
};

@Injectable()
export class VatService {
  constructor(private prisma: PrismaService) {}

  private parseOta(raw: Prisma.JsonValue | null | undefined): OtaConfig {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { mode: 'mock' };
    return { mode: 'mock', ...(raw as OtaConfig) };
  }

  async getOtaConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { zatcaConfig: true, vatNumber: true, name: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const cfg = this.parseOta(company.zatcaConfig);
    return {
      ...cfg,
      mode: cfg.mode || 'mock',
      vatNumber: company.vatNumber,
      companyName: company.name,
      hasLiveCredentials: !!(cfg.apiBaseUrl && cfg.clientId),
    };
  }

  async updateOtaConfig(companyId: string, dto: OtaConfig) {
    const existing = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { zatcaConfig: true },
    });
    if (!existing) throw new NotFoundException('Company not found');
    const prev = this.parseOta(existing.zatcaConfig);
    const next: OtaConfig = {
      ...prev,
      ...(dto.mode ? { mode: dto.mode } : {}),
      ...(dto.apiBaseUrl !== undefined ? { apiBaseUrl: dto.apiBaseUrl } : {}),
      ...(dto.clientId !== undefined ? { clientId: dto.clientId } : {}),
      ...(dto.taxpayerTin !== undefined ? { taxpayerTin: dto.taxpayerTin } : {}),
      clientSecretConfigured: dto.clientSecretConfigured ?? prev.clientSecretConfigured,
    };
    await this.prisma.company.update({
      where: { id: companyId },
      data: { zatcaConfig: next as Prisma.InputJsonValue },
    });
    return this.getOtaConfig(companyId);
  }

  async listEInvoices(companyId: string, requestedTake?: number) {
    const take = Math.min(Math.max(requestedTake || 150, 1), 500);
    const rows = await this.prisma.invoice.findMany({
      where: { companyId, type: 'SALES' },
      select: {
        id: true,
        number: true,
        date: true,
        total: true,
        taxAmount: true,
        status: true,
        vatUuid: true,
        clearedAt: true,
        customFieldsJson: true,
        contact: { select: { name: true, taxId: true } },
      },
      orderBy: { date: 'desc' },
      take,
    });
    return rows.map((inv) => {
      const fields =
        inv.customFieldsJson &&
        typeof inv.customFieldsJson === 'object' &&
        !Array.isArray(inv.customFieldsJson)
          ? (inv.customFieldsJson as Record<string, unknown>)
          : {};
      const otaStatus =
        typeof fields.otaStatus === 'string'
          ? fields.otaStatus
          : inv.vatUuid
            ? inv.clearedAt
              ? 'CLEARED'
              : 'LIVE_PENDING'
            : null;
      const otaMode =
        typeof fields.otaMode === 'string' ? fields.otaMode : null;
      const otaMessage =
        typeof fields.otaMessage === 'string' ? fields.otaMessage : null;
      return {
        ...inv,
        otaStatus,
        otaMode,
        otaMessage,
      };
    });
  }

  async submitToOta(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { contact: true, company: true, items: true },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'DRAFT') {
      throw new BadRequestException('Invoice must be sent before OTA submission');
    }

    const ota = this.parseOta(invoice.company.zatcaConfig);
    const mode = ota.mode || 'mock';

    const vatUuid = invoice.vatUuid || randomUUID();
    const hashInput = `${invoice.number}|${invoice.total}|${invoice.company.vatNumber}|${vatUuid}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');

    const qrPayload = {
      seller: invoice.company.name,
      vatNumber: invoice.company.vatNumber,
      timestamp: new Date().toISOString(),
      total: Number(invoice.total),
      vat: Number(invoice.taxAmount),
      uuid: vatUuid,
      mode,
    };
    const qrData = Buffer.from(JSON.stringify(qrPayload)).toString('base64');

    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:ota:om:einvoice:1.0">
  <UUID>${vatUuid}</UUID>
  <InvoiceNumber>${invoice.number}</InvoiceNumber>
  <IssueDate>${invoice.date.toISOString().split('T')[0]}</IssueDate>
  <SellerName>${invoice.company.name}</SellerName>
  <SellerVAT>${invoice.company.vatNumber || ''}</SellerVAT>
  <BuyerName>${invoice.contact.name}</BuyerName>
  <TaxableAmount>${Number(invoice.subtotal)}</TaxableAmount>
  <TaxAmount>${Number(invoice.taxAmount)}</TaxAmount>
  <TotalAmount>${Number(invoice.total)}</TotalAmount>
  <Currency>OMR</Currency>
  <SubmissionMode>${mode}</SubmissionMode>
</Invoice>`;

    let otaStatus: 'CLEARED' | 'SANDBOX_ACCEPTED' | 'LIVE_PENDING' | 'LIVE_REJECTED' = 'CLEARED';
    let otaMessage = 'Local mock clearance';

    if (mode === 'sandbox') {
      otaStatus = 'SANDBOX_ACCEPTED';
      otaMessage = 'Sandbox acceptance simulated — wire live OTA credentials for production';
    } else if (mode === 'live') {
      if (!ota.apiBaseUrl || !ota.clientId) {
        throw new BadRequestException(
          'Live OTA requires apiBaseUrl and clientId in company e-invoice settings',
        );
      }
      const submitPath = ota.submitPath || '/v1/invoices';
      const base = String(ota.apiBaseUrl).replace(/\/$/, '');
      const url = `${base}${submitPath.startsWith('/') ? submitPath : `/${submitPath}`}`;
      const secret = ota.clientSecret || process.env.OTA_CLIENT_SECRET || '';
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: secret
              ? `Bearer ${secret}`
              : `Basic ${Buffer.from(`${ota.clientId}:`).toString('base64')}`,
            'X-Client-Id': String(ota.clientId),
            'X-Taxpayer-TIN': String(ota.taxpayerTin || invoice.company.vatNumber || ''),
          },
          body: JSON.stringify({
            uuid: vatUuid,
            invoiceNumber: invoice.number,
            issueDate: invoice.date.toISOString().split('T')[0],
            hash,
            qrData,
            xml: xmlContent,
            currency: 'OMR',
            taxableAmount: Number(invoice.subtotal),
            taxAmount: Number(invoice.taxAmount),
            totalAmount: Number(invoice.total),
            sellerVat: invoice.company.vatNumber,
            buyerName: invoice.contact.name,
            buyerTaxId: invoice.contact.taxId,
          }),
        });
        const bodyText = await res.text();
        if (res.ok) {
          otaStatus = 'CLEARED';
          otaMessage = `Live OTA accepted (${res.status})`;
          try {
            const parsed = JSON.parse(bodyText) as { message?: string; status?: string };
            if (parsed.message) otaMessage = parsed.message;
            if (String(parsed.status || '').toUpperCase().includes('PEND')) {
              otaStatus = 'LIVE_PENDING';
            }
          } catch {
            /* keep defaults */
          }
        } else if (res.status === 404 || res.status === 501) {
          otaStatus = 'LIVE_PENDING';
          otaMessage = `Live endpoint not ready (${res.status}) at ${url} — queued pending official contract`;
        } else {
          otaStatus = 'LIVE_REJECTED';
          otaMessage = `Live OTA rejected (${res.status}): ${bodyText.slice(0, 300)}`;
        }
      } catch (err) {
        otaStatus = 'LIVE_PENDING';
        otaMessage = `Live OTA transport error — queued: ${
          err instanceof Error ? err.message : 'unknown'
        }`;
      }
    }

    const prevFields =
      invoice.customFieldsJson &&
      typeof invoice.customFieldsJson === 'object' &&
      !Array.isArray(invoice.customFieldsJson)
        ? (invoice.customFieldsJson as Record<string, unknown>)
        : {};

    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        vatUuid,
        hash,
        qrCode: qrData,
        xmlContent,
        clearedAt: otaStatus === 'CLEARED' || otaStatus === 'SANDBOX_ACCEPTED' ? new Date() : null,
        status: invoice.status,
        customFieldsJson: {
          ...prevFields,
          otaMode: mode,
          otaStatus,
          otaMessage,
          otaSubmittedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    });

    return {
      ...updated,
      otaMode: mode,
      otaStatus,
      otaMessage,
    };
  }

  async getStats(companyId: string) {
    const [row] = await this.prisma.$queryRaw<
      Array<{
        total: bigint;
        cleared: bigint;
        awaitingSubmit: bigint;
        awaitingAuthority: bigint;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*)::bigint AS "total",
        COUNT(*) FILTER (
          WHERE "vat_uuid" IS NOT NULL
            AND (
              "cleared_at" IS NOT NULL
              OR "custom_fields_json" ->> 'otaStatus' IN ('CLEARED', 'SANDBOX_ACCEPTED')
            )
        )::bigint AS "cleared",
        COUNT(*) FILTER (
          WHERE "vat_uuid" IS NULL
            AND "status"::text <> 'DRAFT'
        )::bigint AS "awaitingSubmit",
        COUNT(*) FILTER (
          WHERE "vat_uuid" IS NOT NULL
            AND "cleared_at" IS NULL
            AND COALESCE("custom_fields_json" ->> 'otaStatus', '') NOT IN (
              'CLEARED',
              'SANDBOX_ACCEPTED'
            )
        )::bigint AS "awaitingAuthority"
      FROM "invoices"
      WHERE "company_id" = ${companyId}
        AND "type"::text = 'SALES'
    `);
    const total = Number(row?.total || 0);
    const cleared = Number(row?.cleared || 0);
    const awaitingSubmit = Number(row?.awaitingSubmit || 0);
    const awaitingAuthority = Number(row?.awaitingAuthority || 0);
    return {
      total,
      submitted: cleared,
      cleared,
      pending: awaitingSubmit + awaitingAuthority,
      awaitingSubmit,
      awaitingAuthority,
    };
  }
}
