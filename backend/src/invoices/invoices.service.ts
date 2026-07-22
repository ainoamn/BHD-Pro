import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceStatus, PaymentStatus, InvoiceType, PaymentMethod } from '@prisma/client';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { BatchRecordPaymentDto } from './dto/batch-record-payment.dto';
import { GlPostingService } from '../journal/gl-posting.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PeriodsService } from '../periods/periods.service';

const OMAN_VAT_RATE = 5;

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private glPosting: GlPostingService,
    private subscriptions: SubscriptionsService,
    private periods: PeriodsService,
  ) {}

  private calcLine(item: { quantity: number; unitPrice: number; discount?: number; taxRate?: number }) {
    const discount = item.discount || 0;
    const lineSubtotal = item.quantity * item.unitPrice - discount;
    const taxRate = item.taxRate ?? OMAN_VAT_RATE;
    const taxAmount = Number((lineSubtotal * (taxRate / 100)).toFixed(3));
    const total = Number((lineSubtotal + taxAmount).toFixed(3));
    return { lineSubtotal, taxRate, taxAmount, total };
  }

  private async generateNumber(companyId: string, type: InvoiceType): Promise<string> {
    const year = new Date().getFullYear();
    const prefixByType: Partial<Record<InvoiceType, string>> = {
      [InvoiceType.PURCHASE]: `EXP-${year}-`,
      [InvoiceType.QUOTATION]: `QTE-${year}-`,
      [InvoiceType.CREDIT_NOTE]: `CN-${year}-`,
      [InvoiceType.DEBIT_NOTE]: `DN-${year}-`,
    };
    const prefix = prefixByType[type] ?? `INV-${year}-`;

    const latest = await this.prisma.invoice.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });

    let nextSeq = 1;
    if (latest?.number) {
      const match = latest.number.match(/-(\d+)$/);
      if (match) {
        nextSeq = parseInt(match[1], 10) + 1;
      }
    }

    return `${prefix}${String(nextSeq).padStart(4, '0')}`;
  }

  async findAll(
    companyId: string,
    filters?: {
      isCash?: boolean;
      type?: InvoiceType;
      status?: InvoiceStatus;
      paymentStatus?: PaymentStatus;
      q?: string;
    },
  ) {
    const q = filters?.q?.trim();
    return this.prisma.invoice.findMany({
      where: {
        companyId,
        ...(filters?.isCash != null ? { isCash: filters.isCash } : {}),
        ...(filters?.type ? { type: filters.type } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
        ...(q
          ? {
              OR: [
                { number: { contains: q, mode: 'insensitive' as const } },
                { contact: { name: { contains: q, mode: 'insensitive' as const } } },
                { contact: { nameEn: { contains: q, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      },
      include: {
        contact: { select: { id: true, name: true, nameEn: true, email: true } },
        items: true,
        payments: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async loadInvoice(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        contact: true,
        items: { include: { product: true } },
        payments: true,
        costCenter: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  private async validateAnalytics(
    companyId: string,
    costCenterId?: string | null,
    projectId?: string | null,
  ) {
    if (costCenterId) {
      const cc = await this.prisma.costCenter.findFirst({
        where: { id: costCenterId, companyId },
      });
      if (!cc) throw new BadRequestException('Cost center not found');
    }
    if (projectId) {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, companyId },
      });
      if (!project) throw new BadRequestException('Project not found');
    }
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.loadInvoice(companyId, id);
    return this.repairMissingPayments(companyId, invoice);
  }

  async create(companyId: string, userId: string, dto: CreateInvoiceDto) {
    await this.subscriptions.assertCanCreateInvoice(companyId);
    await this.periods.assertOpen(companyId, dto.date || new Date());

    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, companyId },
    });
    if (!contact) throw new BadRequestException('Contact not found');

    if (!dto.items?.length) throw new BadRequestException('At least one line item required');

    if (dto.payImmediately) {
      if (dto.type !== InvoiceType.SALES && dto.type !== InvoiceType.PURCHASE) {
        throw new BadRequestException('Cash payment is only allowed for sales or purchase invoices');
      }
    }

    await this.validateAnalytics(companyId, dto.costCenterId, dto.projectId);

    const taxRate = dto.taxRate ?? OMAN_VAT_RATE;
    let subtotal = 0;
    let taxAmount = 0;

    const itemsData = dto.items.map((item) => {
      const calc = this.calcLine({ ...item, taxRate: item.taxRate ?? taxRate });
      subtotal += calc.lineSubtotal;
      taxAmount += calc.taxAmount;
      return {
        productId: item.productId || null,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        taxRate: calc.taxRate,
        taxAmount: calc.taxAmount,
        total: calc.total,
      };
    });

    subtotal = Number(subtotal.toFixed(3));
    taxAmount = Number(taxAmount.toFixed(3));
    const discount = dto.discount || 0;
    const docTotal = Number((subtotal + taxAmount - discount).toFixed(3));

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { currency: true },
    });
    const baseCurrency = (company?.currency || 'OMR').toUpperCase();
    const currency = (dto.currency || baseCurrency).toUpperCase();
    let exchangeRate = dto.exchangeRate != null ? Number(dto.exchangeRate) : 1;
    if (currency === baseCurrency) exchangeRate = 1;
    if (exchangeRate <= 0) throw new BadRequestException('Exchange rate must be positive');

    const isForeign = currency !== baseCurrency;
    const foreignTotal = isForeign ? docTotal : null;
    const scale = isForeign ? exchangeRate : 1;
    // Header totals in company base currency for GL; line items stay in document currency
    const total = Number((docTotal * scale).toFixed(3));
    const baseSubtotal = Number((subtotal * scale).toFixed(3));
    const baseTaxAmount = Number((taxAmount * scale).toFixed(3));
    const baseDiscount = Number((discount * scale).toFixed(3));

    const number = await this.generateNumber(companyId, dto.type);
    const cash = !!dto.payImmediately;
    const dueDate = cash ? new Date(dto.date) : new Date(dto.dueDate);

    const created = await this.prisma.invoice.create({
      data: {
        companyId,
        number,
        type: dto.type,
        contactId: dto.contactId,
        date: new Date(dto.date),
        dueDate,
        subtotal: baseSubtotal,
        discount: baseDiscount,
        taxRate,
        taxAmount: baseTaxAmount,
        total,
        currency,
        exchangeRate,
        foreignTotal,
        status: InvoiceStatus.DRAFT,
        paymentStatus: PaymentStatus.UNPAID,
        isCash: cash,
        notes: dto.notes,
        costCenterId: dto.costCenterId || null,
        projectId: dto.projectId || null,
        createdById: userId,
        ...(dto.customFieldsJson !== undefined
          ? { customFieldsJson: dto.customFieldsJson as object }
          : {}),
        items: { create: itemsData },
      },
      include: {
        contact: true,
        items: true,
        costCenter: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
      },
    });

    if (!cash) return created;

    return this.recordPayment(companyId, userId, created.id, {
      method: dto.paymentMethod ?? PaymentMethod.CASH,
      date: dto.date,
      notes: dto.notes || 'Cash payment',
    });
  }

  async update(companyId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.findOne(companyId, id);
    if (
      existing.status === InvoiceStatus.PAID ||
      existing.status === InvoiceStatus.CANCELLED
    ) {
      throw new ForbiddenException('Cannot edit paid or cancelled invoice');
    }
    if (Number(existing.paidAmount) > 0 || existing.payments.length > 0) {
      throw new ForbiddenException(
        'Cannot edit invoice with recorded payments — reverse the receipt first',
      );
    }

    await this.periods.assertOpen(companyId, dto.date || existing.date);
    await this.validateAnalytics(companyId, dto.costCenterId, dto.projectId);

    if (dto.items) {
      await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });

      const taxRate = dto.taxRate ?? Number(existing.taxRate);
      let subtotal = 0;
      let taxAmount = 0;

      const itemsData = dto.items.map((item) => {
        const calc = this.calcLine({ ...item, taxRate: item.taxRate ?? taxRate });
        subtotal += calc.lineSubtotal;
        taxAmount += calc.taxAmount;
        return {
          invoiceId: id,
          productId: item.productId || null,
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount || 0,
          taxRate: calc.taxRate,
          taxAmount: calc.taxAmount,
          total: calc.total,
        };
      });

      subtotal = Number(subtotal.toFixed(3));
      taxAmount = Number(taxAmount.toFixed(3));

      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { currency: true },
      });
      const baseCurrency = (company?.currency || 'OMR').toUpperCase();
      const currency = (dto.currency || existing.currency || baseCurrency).toUpperCase();
      let exchangeRate =
        dto.exchangeRate != null
          ? Number(dto.exchangeRate)
          : Number(existing.exchangeRate || 1);
      if (currency === baseCurrency) exchangeRate = 1;
      if (exchangeRate <= 0) throw new BadRequestException('Exchange rate must be positive');

      const existingRate = Number(existing.exchangeRate || 1);
      const existingDocDiscount =
        (existing.currency || baseCurrency).toUpperCase() !== baseCurrency && existingRate > 0
          ? Number((Number(existing.discount) / existingRate).toFixed(3))
          : Number(existing.discount);
      const discount = dto.discount ?? existingDocDiscount;
      const docTotal = Number((subtotal + taxAmount - discount).toFixed(3));

      const isForeign = currency !== baseCurrency;
      const foreignTotal = isForeign ? docTotal : null;
      const scale = isForeign ? exchangeRate : 1;
      const total = Number((docTotal * scale).toFixed(3));
      const baseSubtotal = Number((subtotal * scale).toFixed(3));
      const baseTaxAmount = Number((taxAmount * scale).toFixed(3));
      const baseDiscount = Number((discount * scale).toFixed(3));

      await this.prisma.invoiceItem.createMany({ data: itemsData });

      return this.prisma.invoice.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.contactId && { contactId: dto.contactId }),
          ...(dto.date && { date: new Date(dto.date) }),
          ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.costCenterId !== undefined && { costCenterId: dto.costCenterId || null }),
          ...(dto.projectId !== undefined && { projectId: dto.projectId || null }),
          ...(dto.customFieldsJson !== undefined && {
            customFieldsJson: dto.customFieldsJson as object,
          }),
          currency,
          exchangeRate,
          foreignTotal,
          subtotal: baseSubtotal,
          discount: baseDiscount,
          taxRate,
          taxAmount: baseTaxAmount,
          total,
        },
        include: { contact: true, items: true, costCenter: true, project: true },
      });
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.contactId && { contactId: dto.contactId }),
        ...(dto.date && { date: new Date(dto.date) }),
        ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        ...(dto.discount !== undefined && { discount: dto.discount }),
        ...(dto.costCenterId !== undefined && { costCenterId: dto.costCenterId || null }),
        ...(dto.projectId !== undefined && { projectId: dto.projectId || null }),
        ...(dto.customFieldsJson !== undefined && {
          customFieldsJson: dto.customFieldsJson as object,
        }),
        ...(dto.currency !== undefined && { currency: dto.currency.toUpperCase() }),
        ...(dto.exchangeRate !== undefined && { exchangeRate: dto.exchangeRate }),
      },
      include: { contact: true, items: true, costCenter: true, project: true },
    });
  }

  async updateStatus(companyId: string, userId: string, id: string, status: InvoiceStatus) {
    const invoice = await this.findOne(companyId, id);

    const data: {
      status: InvoiceStatus;
      paymentStatus?: PaymentStatus;
      paidAmount?: number;
    } = { status };

    if (status === InvoiceStatus.PAID) {
      data.paymentStatus = PaymentStatus.PAID;
      data.paidAmount = Number(invoice.total);
      // Create payment record if none exists (legacy mark-paid flow)
      const existingPayments = await this.prisma.payment.count({ where: { invoiceId: id } });
      if (existingPayments === 0) {
        await this.prisma.payment.create({
          data: {
            invoiceId: id,
            amount: invoice.total,
            method: PaymentMethod.CASH,
            date: new Date(),
            notes: 'Marked as paid',
          },
        });
      }
    } else if (status === InvoiceStatus.CANCELLED) {
      data.paymentStatus = PaymentStatus.UNPAID;
      data.paidAmount = 0;
    } else if (invoice.paymentStatus === PaymentStatus.PAID) {
      // Reverting from paid
      data.paymentStatus = PaymentStatus.UNPAID;
      data.paidAmount = 0;
    }

    const updated = await this.prisma.invoice.update({
      where: { id },
      data,
      include: { contact: true, items: true, payments: true },
    });

    if (
      ([InvoiceStatus.SENT, InvoiceStatus.VIEWED, InvoiceStatus.OVERDUE, InvoiceStatus.PAID] as InvoiceStatus[]).includes(
        status,
      )
    ) {
      await this.glPosting.postInvoice(companyId, userId, updated);
    }

    if (status === InvoiceStatus.PAID && updated.payments.length > 0) {
      for (const pay of updated.payments) {
        await this.glPosting.postPayment(companyId, userId, pay, updated);
      }
    }

    return updated;
  }

  /** Fix legacy rows where status=PAID but paymentStatus was not updated */
  private async syncPaymentStatus(companyId: string) {
    const stale = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status: InvoiceStatus.PAID,
        NOT: { paymentStatus: PaymentStatus.PAID },
      },
      select: { id: true, total: true },
    });
    await Promise.all(stale.map((inv) => this.syncPaidInvoiceRow(companyId, inv)));
  }

  private async applyPayment(
    companyId: string,
    userId: string,
    invoice: Awaited<ReturnType<InvoicesService['findOne']>>,
    amount: number,
    meta: {
      method: PaymentMethod;
      date?: string;
      reference?: string;
      notes?: string;
    },
  ) {
    await this.periods.assertOpen(companyId, meta.date || new Date());

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(`Cannot record payment on cancelled invoice ${invoice.number}`);
    }
    if (invoice.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException(`Invoice ${invoice.number} is already fully paid`);
    }

    const total = Number(invoice.total);
    const alreadyPaid = Number(invoice.paidAmount);
    const remaining = Number((total - alreadyPaid).toFixed(3));

    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    if (amount > remaining + 0.001) {
      throw new BadRequestException(
        `Amount ${amount} exceeds remaining balance (${remaining}) for invoice ${invoice.number}`,
      );
    }

    const newPaid = Number((alreadyPaid + amount).toFixed(3));
    const paymentStatus =
      newPaid >= total - 0.001 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
    const status =
      paymentStatus === PaymentStatus.PAID ? InvoiceStatus.PAID : invoice.status;

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount,
        method: meta.method,
        reference: meta.reference || null,
        notes: meta.notes || null,
        date: meta.date ? new Date(meta.date) : new Date(),
      },
    });

    const updated = await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: newPaid,
        paymentStatus,
        status,
      },
      include: { contact: true, items: true, payments: true },
    });

    await this.glPosting.postInvoice(companyId, userId, updated);
    await this.glPosting.postPayment(companyId, userId, payment, updated);

    return updated;
  }

  async recordPayment(companyId: string, userId: string, id: string, dto: RecordPaymentDto) {
    const invoice = await this.findOne(companyId, id);
    const total = Number(invoice.total);
    const alreadyPaid = Number(invoice.paidAmount);
    const remaining = Number((total - alreadyPaid).toFixed(3));
    const amount = dto.amount != null ? Number(dto.amount) : remaining;

    return this.applyPayment(companyId, userId, invoice, amount, {
      method: dto.method,
      date: dto.date,
      reference: dto.reference,
      notes: dto.notes,
    });
  }

  async recordBatchPayment(companyId: string, userId: string, dto: BatchRecordPaymentDto) {
    const allocations = dto.allocations.map((a) => ({
      invoiceId: a.invoiceId,
      amount: Number(a.amount),
    }));

    const seen = new Set<string>();
    for (const row of allocations) {
      if (seen.has(row.invoiceId)) {
        throw new BadRequestException('Duplicate invoice in payment allocations');
      }
      seen.add(row.invoiceId);
    }

    const invoices = await Promise.all(
      allocations.map((a) => this.findOne(companyId, a.invoiceId)),
    );

    return this.prisma.$transaction(async () => {
      const updated: Awaited<ReturnType<InvoicesService['applyPayment']>>[] = [];
      for (let i = 0; i < allocations.length; i++) {
        const result = await this.applyPayment(companyId, userId, invoices[i], allocations[i].amount, {
          method: dto.method,
          date: dto.date,
          reference: dto.reference,
          notes: dto.notes,
        });
        updated.push(result);
      }
      return {
        totalAmount: Number(
          allocations.reduce((sum, row) => sum + row.amount, 0).toFixed(3),
        ),
        invoices: updated,
      };
    });
  }

  private recalcAfterPayments(
    invoice: { total: unknown; status: InvoiceStatus; type?: InvoiceType },
    paidAmount: number,
  ): { paidAmount: number; paymentStatus: PaymentStatus; status: InvoiceStatus } {
    const total = Number(invoice.total);
    const paid = Number(paidAmount.toFixed(3));

    let paymentStatus: PaymentStatus;
    if (paid <= 0.0005) paymentStatus = PaymentStatus.UNPAID;
    else if (paid >= total - 0.001) paymentStatus = PaymentStatus.PAID;
    else paymentStatus = PaymentStatus.PARTIAL;

    let status = invoice.status;
    if (paymentStatus === PaymentStatus.PAID) {
      status = InvoiceStatus.PAID;
    } else if (invoice.status === InvoiceStatus.PAID) {
      status =
        invoice.type === InvoiceType.PURCHASE
          ? InvoiceStatus.DRAFT
          : InvoiceStatus.SENT;
    }

    return { paidAmount: paid, paymentStatus, status };
  }

  /** Invoices marked paid without Payment rows (legacy sync) */
  private async repairMissingPayments(
    companyId: string,
    invoice: Awaited<ReturnType<InvoicesService['loadInvoice']>>,
  ) {
    const paid = Number(invoice.paidAmount);
    if (paid <= 0.0005 || invoice.payments.length > 0) {
      return invoice;
    }

    await this.prisma.payment.create({
      data: {
        invoiceId: invoice.id,
        amount: paid,
        method: PaymentMethod.OTHER,
        date: invoice.updatedAt || new Date(),
        notes: 'Legacy payment (auto-repaired)',
      },
    });

    return this.loadInvoice(companyId, invoice.id);
  }

  private async syncPaidInvoiceRow(
    companyId: string,
    inv: { id: string; total: unknown },
  ) {
    const count = await this.prisma.payment.count({ where: { invoiceId: inv.id } });
    if (count === 0) {
      await this.prisma.payment.create({
        data: {
          invoiceId: inv.id,
          amount: Number(inv.total),
          method: PaymentMethod.OTHER,
          date: new Date(),
          notes: 'Marked as paid',
        },
      });
    }
    await this.prisma.invoice.update({
      where: { id: inv.id },
      data: { paymentStatus: PaymentStatus.PAID, paidAmount: Number(inv.total) },
    });
  }

  async unsend(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot revert cancelled invoice');
    }
    if (invoice.status === InvoiceStatus.DRAFT) {
      throw new BadRequestException('Invoice is already a draft');
    }
    if (Number(invoice.paidAmount) > 0 || invoice.payments.length > 0) {
      throw new BadRequestException(
        'Cannot revert send while payments exist — reverse the receipt first',
      );
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Cannot revert paid invoice');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.DRAFT },
      include: { contact: true, items: true, payments: true },
    });
  }

  async reversePayment(companyId: string, userId: string, invoiceId: string, paymentId: string) {
    const invoice = await this.findOne(companyId, invoiceId);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot reverse payment on cancelled invoice');
    }

    const payment = invoice.payments.find((p) => p.id === paymentId);
    if (!payment) {
      throw new NotFoundException('Payment not found on this invoice');
    }

    await this.glPosting.reversePaymentEntry(companyId, userId, payment, invoice);
    await this.prisma.payment.delete({ where: { id: paymentId } });

    const remaining = await this.prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { date: 'asc' },
    });
    const paidAmount = Number(
      remaining.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(3),
    );
    const next = this.recalcAfterPayments(invoice, paidAmount);

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: next,
      include: { contact: true, items: true, payments: true },
    });
  }

  async reverseAllPayments(companyId: string, userId: string, invoiceId: string) {
    let invoice = await this.findOne(companyId, invoiceId);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot reverse payments on cancelled invoice');
    }

    const hasPaidAmount = Number(invoice.paidAmount) > 0.0005;
    const hasPayments = invoice.payments.length > 0;

    if (!hasPaidAmount && !hasPayments) {
      throw new BadRequestException('No payments to reverse');
    }

    if (hasPayments) {
      for (const pay of invoice.payments) {
        await this.glPosting.reversePaymentEntry(companyId, userId, pay, invoice);
      }
      await this.prisma.payment.deleteMany({ where: { invoiceId } });
    }

    const next = this.recalcAfterPayments(invoice, 0);

    return this.prisma.invoice.update({
      where: { id: invoiceId },
      data: next,
      include: { contact: true, items: true, payments: true },
    });
  }

  async send(companyId: string, userId: string, id: string, email?: string) {
    const invoice = await this.findOne(companyId, id);
    const recipient = email || invoice.contact.email;

    const updated = await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT },
      include: { contact: true, items: true, payments: true },
    });

    await this.glPosting.postInvoice(companyId, userId, updated);

    if (!recipient) {
      return {
        success: true,
        message: `Invoice ${invoice.number} marked as sent (no email on file)`,
        email: null,
        invoiceNumber: invoice.number,
        total: invoice.total,
      };
    }

    return {
      success: true,
      message: `Invoice ${invoice.number} sent to ${recipient}`,
      email: recipient,
      invoiceNumber: invoice.number,
      total: invoice.total,
    };
  }

  async remove(companyId: string, id: string) {
    const invoice = await this.findOne(companyId, id);
    if (invoice.status === InvoiceStatus.PAID) {
      throw new ForbiddenException('Cannot delete paid invoice');
    }
    await this.prisma.invoice.delete({ where: { id } });
    return { message: 'Invoice deleted' };
  }

  async getStats(companyId: string, type?: InvoiceType) {
    await this.syncPaymentStatus(companyId);

    const baseWhere = {
      companyId,
      status: { not: InvoiceStatus.CANCELLED },
      ...(type ? { type } : {}),
    };

    const [total, paid, pending, overdue, pendingCollection] = await Promise.all([
      this.prisma.invoice.count({ where: baseWhere }),
      this.prisma.invoice.aggregate({
        where: { ...baseWhere, paymentStatus: PaymentStatus.PAID },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...baseWhere, paymentStatus: PaymentStatus.UNPAID },
        _sum: { total: true },
      }),
      this.prisma.invoice.count({
        where: { ...baseWhere, status: InvoiceStatus.OVERDUE },
      }),
      this.prisma.invoice.count({
        where: {
          ...baseWhere,
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
          status: { in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.VIEWED] },
        },
      }),
    ]);

    return {
      total,
      paidAmount: paid._sum.total || 0,
      pendingAmount: pending._sum.total || 0,
      overdueCount: overdue,
      pendingCollectionCount: pendingCollection,
    };
  }

  async listPayments(companyId: string, invoiceType?: 'SALES' | 'PURCHASE') {
    const types = invoiceType
      ? invoiceType === 'SALES'
        ? (['SALES', 'CREDIT_NOTE'] as const)
        : (['PURCHASE', 'DEBIT_NOTE'] as const)
      : undefined;

    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: {
          companyId,
          ...(types ? { type: { in: [...types] } } : {}),
        },
      },
      include: {
        invoice: {
          select: {
            id: true,
            number: true,
            type: true,
            contact: { select: { id: true, name: true, nameEn: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    });

    return payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      reference: p.reference,
      date: p.date,
      notes: p.notes,
      invoice: p.invoice,
    }));
  }

  async convertQuotationToSales(companyId: string, userId: string, id: string) {
    const quote = await this.loadInvoice(companyId, id);
    if (quote.type !== InvoiceType.QUOTATION) {
      throw new BadRequestException('Invoice is not a quotation');
    }
    if (quote.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot convert cancelled quotation');
    }

    return this.create(companyId, userId, {
      type: InvoiceType.SALES,
      contactId: quote.contactId,
      date: new Date().toISOString().split('T')[0],
      dueDate: quote.dueDate.toISOString().split('T')[0],
      discount: Number(quote.discount),
      taxRate: Number(quote.taxRate),
      notes: quote.notes ? `من عرض سعر ${quote.number}\n${quote.notes}` : `من عرض سعر ${quote.number}`,
      items: quote.items.map((item) => ({
        productId: item.productId || undefined,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
      })),
    });
  }
}
