import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomUUID, createHash } from 'crypto';

@Injectable()
export class VatService {
  constructor(private prisma: PrismaService) {}

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

    const vatUuid = randomUUID();
    const hashInput = `${invoice.number}|${invoice.total}|${invoice.company.vatNumber}|${vatUuid}`;
    const hash = createHash('sha256').update(hashInput).digest('hex');

    const qrData = Buffer.from(
      JSON.stringify({
        seller: invoice.company.name,
        vatNumber: invoice.company.vatNumber,
        timestamp: new Date().toISOString(),
        total: Number(invoice.total),
        vat: Number(invoice.taxAmount),
        uuid: vatUuid,
      }),
    ).toString('base64');

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
</Invoice>`;

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        vatUuid,
        hash,
        qrCode: qrData,
        xmlContent,
        clearedAt: new Date(),
        status: 'SENT',
      },
    });
  }

  getStats(companyId: string) {
    return this.prisma.invoice.groupBy({
      by: ['clearedAt'],
      where: { companyId, vatUuid: { not: null } },
      _count: true,
    }).then(async () => {
      const [submitted, pending, total] = await Promise.all([
        this.prisma.invoice.count({ where: { companyId, vatUuid: { not: null } } }),
        this.prisma.invoice.count({ where: { companyId, vatUuid: null, status: { not: 'DRAFT' } } }),
        this.prisma.invoice.count({ where: { companyId, type: 'SALES' } }),
      ]);
      return { submitted, pending, total };
    });
  }
}
