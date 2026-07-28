import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateScheduledInvoiceDto,
  UpdateScheduledInvoiceDto,
} from './dto/procurement.dto';
import { InvoiceType, ScheduleFrequency } from '@prisma/client';
import { InvoicesService } from './invoices.service';

const OMAN_VAT_RATE = 5;

@Injectable()
export class ScheduledInvoicesService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  private calcLine(item: { quantity: number; unitPrice: number; discount?: number; taxRate?: number }) {
    const discount = item.discount || 0;
    const lineSubtotal = item.quantity * item.unitPrice - discount;
    const taxRate = item.taxRate ?? OMAN_VAT_RATE;
    const taxAmount = Number((lineSubtotal * (taxRate / 100)).toFixed(3));
    const total = Number((lineSubtotal + taxAmount).toFixed(3));
    return { lineSubtotal, taxRate, taxAmount, total };
  }

  private buildItems(items: CreateScheduledInvoiceDto['items'], taxRate: number) {
    let subtotal = 0;
    let taxAmount = 0;
    const rows = items.map((item) => {
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
    return {
      subtotal: Number(subtotal.toFixed(3)),
      taxAmount: Number(taxAmount.toFixed(3)),
      items: rows,
    };
  }

  private advanceDate(date: Date, frequency: ScheduleFrequency): Date {
    const next = new Date(date);
    switch (frequency) {
      case ScheduleFrequency.WEEKLY:
        next.setDate(next.getDate() + 7);
        break;
      case ScheduleFrequency.MONTHLY:
        next.setMonth(next.getMonth() + 1);
        break;
      case ScheduleFrequency.QUARTERLY:
        next.setMonth(next.getMonth() + 3);
        break;
      case ScheduleFrequency.YEARLY:
        next.setFullYear(next.getFullYear() + 1);
        break;
    }
    return next;
  }

  findAll(companyId: string) {
    return this.prisma.scheduledInvoice.findMany({
      where: { companyId },
      include: {
        contact: { select: { id: true, name: true, nameEn: true } },
        items: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { nextDate: 'asc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const row = await this.prisma.scheduledInvoice.findFirst({
      where: { id, companyId },
      include: {
        contact: true,
        items: true,
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Scheduled invoice not found');
    return row;
  }

  async create(companyId: string, userId: string, dto: CreateScheduledInvoiceDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, companyId, type: 'CUSTOMER' },
    });
    if (!contact) throw new BadRequestException('Customer not found');

    const taxRate = dto.taxRate ?? OMAN_VAT_RATE;
    const { subtotal, taxAmount, items } = this.buildItems(dto.items, taxRate);
    const discount = dto.discount || 0;
    const total = Number((subtotal + taxAmount - discount).toFixed(3));

    return this.prisma.scheduledInvoice.create({
      data: {
        companyId,
        name: dto.name,
        contactId: dto.contactId,
        frequency: dto.frequency,
        nextDate: new Date(dto.nextDate),
        isActive: dto.isActive ?? true,
        subtotal,
        discount,
        taxRate,
        taxAmount,
        total,
        notes: dto.notes,
        createdById: userId,
        items: { create: items },
      },
      include: { contact: true, items: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateScheduledInvoiceDto) {
    const existing = await this.findOne(companyId, id);
    const taxRate =
      dto.taxRate != null ? Number(dto.taxRate) : Number(existing.taxRate);
    const discount =
      dto.discount != null ? Number(dto.discount) : Number(existing.discount);

    if (dto.items) {
      const { subtotal, taxAmount, items } = this.buildItems(dto.items, taxRate);
      const total = Number((subtotal + taxAmount - discount).toFixed(3));
      await this.prisma.scheduledInvoiceItem.deleteMany({ where: { scheduleId: id } });
      return this.prisma.scheduledInvoice.update({
        where: { id },
        data: {
          name: dto.name ?? existing.name,
          contactId: dto.contactId ?? existing.contactId,
          frequency: dto.frequency ?? existing.frequency,
          nextDate: dto.nextDate ? new Date(dto.nextDate) : existing.nextDate,
          isActive: dto.isActive ?? existing.isActive,
          subtotal,
          discount,
          taxRate,
          taxAmount,
          total,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          items: { create: items },
        },
        include: { contact: true, items: true },
      });
    }

    const subtotal = Number(existing.subtotal);
    const nextTaxAmount =
      dto.taxRate != null
        ? Number(
            existing.items
              .reduce((s, it) => {
                const lineSub =
                  Number(it.quantity) * Number(it.unitPrice) - Number(it.discount || 0);
                return s + lineSub * (taxRate / 100);
              }, 0)
              .toFixed(3),
          )
        : Number(existing.taxAmount);
    const total = Number((subtotal + nextTaxAmount - discount).toFixed(3));

    return this.prisma.scheduledInvoice.update({
      where: { id },
      data: {
        name: dto.name ?? existing.name,
        contactId: dto.contactId ?? existing.contactId,
        frequency: dto.frequency ?? existing.frequency,
        nextDate: dto.nextDate ? new Date(dto.nextDate) : existing.nextDate,
        isActive: dto.isActive ?? existing.isActive,
        discount,
        taxRate,
        taxAmount: nextTaxAmount,
        total,
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
      },
      include: { contact: true, items: true },
    });
  }

  async remove(companyId: string, id: string) {
    const schedule = await this.findOne(companyId, id);
    if (schedule.lastGeneratedAt) {
      throw new BadRequestException(
        'Cannot delete a schedule that has generated invoices — deactivate instead',
      );
    }
    await this.prisma.scheduledInvoice.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  async toggleActive(companyId: string, id: string) {
    const schedule = await this.findOne(companyId, id);
    return this.prisma.scheduledInvoice.update({
      where: { id },
      data: { isActive: !schedule.isActive },
      include: { contact: true, items: true },
    });
  }

  async generateNow(companyId: string, userId: string, id: string) {
    const schedule = await this.findOne(companyId, id);
    if (!schedule.isActive) {
      throw new BadRequestException('Schedule is inactive');
    }

    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 30);

    const invoice = await this.invoicesService.create(companyId, userId, {
      type: InvoiceType.SALES,
      contactId: schedule.contactId,
      date: today.toISOString().split('T')[0],
      dueDate: due.toISOString().split('T')[0],
      discount: Number(schedule.discount),
      taxRate: Number(schedule.taxRate),
      notes: schedule.notes
        ? `${schedule.name}\n${schedule.notes}`
        : schedule.name,
      items: schedule.items.map((item) => ({
        productId: item.productId || undefined,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
      })),
    });

    // Issue invoice and post to GL (Wafeq-style recurring billing)
    const sendResult = await this.invoicesService.send(companyId, userId, invoice.id);

    await this.prisma.scheduledInvoice.update({
      where: { id },
      data: {
        lastGeneratedAt: today,
        nextDate: this.advanceDate(schedule.nextDate, schedule.frequency),
      },
    });

    const issued = await this.invoicesService.findOne(companyId, invoice.id);
    return {
      ...issued,
      emailSent: !!sendResult.emailSent,
      emailMock: !!sendResult.emailMock,
      emailSkipped: !!(sendResult as { emailSkipped?: boolean }).emailSkipped,
      ...('emailError' in sendResult && sendResult.emailError
        ? { emailError: String(sendResult.emailError) }
        : {}),
    };
  }

  /** Cron: all companies. Manual API: pass companyId to scope to one tenant. */
  async processDueSchedules(companyId?: string) {
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const due = await this.prisma.scheduledInvoice.findMany({
      where: {
        isActive: true,
        nextDate: { lte: endOfToday },
        ...(companyId ? { companyId } : {}),
      },
      select: { id: true, companyId: true, createdById: true, name: true },
    });

    let generated = 0;
    let emailSent = 0;
    let emailMock = 0;
    let emailSkipped = 0;
    for (const row of due) {
      try {
        const result = await this.generateNow(row.companyId, row.createdById, row.id);
        generated += 1;
        if (result.emailSent) emailSent += 1;
        else if (result.emailMock) emailMock += 1;
        else emailSkipped += 1;
      } catch {
        // skip failed rows; cron will retry next run
      }
    }

    return { checked: due.length, generated, emailSent, emailMock, emailSkipped };
  }
}
