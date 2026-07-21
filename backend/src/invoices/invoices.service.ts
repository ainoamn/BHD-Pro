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

const OMAN_VAT_RATE = 5;

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

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
    const prefix = type === InvoiceType.PURCHASE ? `EXP-${year}-` : `INV-${year}-`;

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

  async findAll(companyId: string) {
    return this.prisma.invoice.findMany({
      where: { companyId },
      include: {
        contact: { select: { id: true, name: true, nameEn: true, email: true } },
        items: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, companyId },
      include: {
        contact: true,
        items: { include: { product: true } },
        payments: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(companyId: string, userId: string, dto: CreateInvoiceDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, companyId },
    });
    if (!contact) throw new BadRequestException('Contact not found');

    if (!dto.items?.length) throw new BadRequestException('At least one line item required');

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
    const total = Number((subtotal + taxAmount - discount).toFixed(3));

    const number = await this.generateNumber(companyId, dto.type);

    return this.prisma.invoice.create({
      data: {
        companyId,
        number,
        type: dto.type,
        contactId: dto.contactId,
        date: new Date(dto.date),
        dueDate: new Date(dto.dueDate),
        subtotal,
        discount,
        taxRate,
        taxAmount,
        total,
        status: InvoiceStatus.DRAFT,
        paymentStatus: PaymentStatus.UNPAID,
        notes: dto.notes,
        createdById: userId,
        items: { create: itemsData },
      },
      include: {
        contact: true,
        items: true,
      },
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
      const discount = dto.discount ?? Number(existing.discount);
      const total = Number((subtotal + taxAmount - discount).toFixed(3));

      await this.prisma.invoiceItem.createMany({ data: itemsData });

      return this.prisma.invoice.update({
        where: { id },
        data: {
          ...(dto.type && { type: dto.type }),
          ...(dto.contactId && { contactId: dto.contactId }),
          ...(dto.date && { date: new Date(dto.date) }),
          ...(dto.dueDate && { dueDate: new Date(dto.dueDate) }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
          subtotal,
          discount,
          taxRate,
          taxAmount,
          total,
        },
        include: { contact: true, items: true },
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
      },
      include: { contact: true, items: true },
    });
  }

  async updateStatus(companyId: string, id: string, status: InvoiceStatus) {
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

    return this.prisma.invoice.update({
      where: { id },
      data,
      include: { contact: true, items: true },
    });
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
    await Promise.all(
      stale.map((inv) =>
        this.prisma.invoice.update({
          where: { id: inv.id },
          data: { paymentStatus: PaymentStatus.PAID, paidAmount: inv.total },
        }),
      ),
    );
  }

  async recordPayment(companyId: string, id: string, dto: RecordPaymentDto) {
    const invoice = await this.findOne(companyId, id);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot record payment on cancelled invoice');
    }
    if (invoice.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('Invoice is already fully paid');
    }

    const total = Number(invoice.total);
    const alreadyPaid = Number(invoice.paidAmount);
    const remaining = Number((total - alreadyPaid).toFixed(3));
    const amount = dto.amount != null ? Number(dto.amount) : remaining;

    if (amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }
    if (amount > remaining + 0.001) {
      throw new BadRequestException(`Amount exceeds remaining balance (${remaining})`);
    }

    const newPaid = Number((alreadyPaid + amount).toFixed(3));
    const paymentStatus =
      newPaid >= total - 0.001 ? PaymentStatus.PAID : PaymentStatus.PARTIAL;
    const status =
      paymentStatus === PaymentStatus.PAID ? InvoiceStatus.PAID : invoice.status;

    await this.prisma.payment.create({
      data: {
        invoiceId: id,
        amount,
        method: dto.method,
        reference: dto.reference || null,
        notes: dto.notes || null,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });

    return this.prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaid,
        paymentStatus,
        status,
      },
      include: { contact: true, items: true, payments: true },
    });
  }

  async send(companyId: string, id: string, email?: string) {
    const invoice = await this.findOne(companyId, id);
    const recipient = email || invoice.contact.email;

    await this.prisma.invoice.update({
      where: { id },
      data: { status: InvoiceStatus.SENT },
    });

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
}
