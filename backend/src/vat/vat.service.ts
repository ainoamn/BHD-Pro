import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID, createHash } from 'crypto';
import { Prisma } from '@prisma/client';

type OtaConfig = {
  mode?: 'mock' | 'sandbox' | 'live';
  apiBaseUrl?: string;
  clientId?: string;
  clientSecretConfigured?: boolean;
  taxpayerTin?: string;
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

  async listEInvoices(companyId: string) {
    return this.prisma.invoice.findMany({
      where: { companyId, type: 'SALES' },
      include: { contact: { select: { name: true, taxId: true } } },
      orderBy: { date: 'desc' },
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
      // Live HTTP call is gated until official Oman OTA credentials/API contract are provided.
      // We record LIVE_PENDING so ops can monitor and complete when the endpoint is available.
      otaStatus = 'LIVE_PENDING';
      otaMessage = `Queued for live OTA at ${ota.apiBaseUrl} (credentials present — awaiting official API contract)`;
    }

    const prevFields =
      invoice.customFieldsJson &&
      typeof invoice.customFieldsJson === 'object' &&
      !Array.isArray(invoice.customFieldsJson)
        ? (invoice.customFieldsJson as Record<string, unknown>)
        : {};

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        vatUuid,
        hash,
        qrCode: qrData,
        xmlContent,
        clearedAt: mode === 'live' ? null : new Date(),
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
  }

  getStats(companyId: string) {
    return Promise.all([
      this.prisma.invoice.count({ where: { companyId, vatUuid: { not: null } } }),
      this.prisma.invoice.count({
        where: { companyId, vatUuid: null, status: { not: 'DRAFT' }, type: 'SALES' },
      }),
      this.prisma.invoice.count({ where: { companyId, type: 'SALES' } }),
    ]).then(([submitted, pending, total]) => ({ submitted, pending, total }));
  }
}
