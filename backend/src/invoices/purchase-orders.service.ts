import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/procurement.dto';
import { InvoiceType, PurchaseOrderStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import { nextDocumentNumber, seedAfter } from '../common/document-number';
import { calculateTaxLine } from '../common/money';

const OMAN_VAT_RATE = 5;

@Injectable()
export class PurchaseOrdersService {
  constructor(
    private prisma: PrismaService,
    private invoicesService: InvoicesService,
  ) {}

  private calcLine(item: { quantity: number; unitPrice: number; discount?: number; taxRate?: number }) {
    const taxRate = item.taxRate ?? OMAN_VAT_RATE;
    const result = calculateTaxLine({ ...item, taxRate });
    return {
      lineSubtotal: result.lineSubtotal.toNumber(),
      taxRate: result.taxRate.toNumber(),
      taxAmount: result.taxAmount.toNumber(),
      total: result.total.toNumber(),
    };
  }

  private async generateNumber(companyId: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    const latest = await this.prisma.purchaseOrder.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { createdAt: 'desc' },
      select: { number: true },
    });
    return nextDocumentNumber(this.prisma, {
      scope: companyId,
      series: 'purchase-order',
      period: String(year),
      prefix,
      seed: seedAfter(latest?.number),
    });
  }

  private buildItems(items: CreatePurchaseOrderDto['items'], taxRate: number) {
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

  findAll(companyId: string) {
    return this.prisma.purchaseOrder.findMany({
      where: { companyId },
      include: {
        contact: { select: { id: true, name: true, nameEn: true } },
        items: true,
        createdBy: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const order = await this.prisma.purchaseOrder.findFirst({
      where: { id, companyId },
      include: {
        contact: true,
        items: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!order) throw new NotFoundException('Purchase order not found');
    return order;
  }

  async create(companyId: string, userId: string, dto: CreatePurchaseOrderDto) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, companyId, type: 'SUPPLIER' },
    });
    if (!contact) throw new BadRequestException('Supplier not found');

    const taxRate = dto.taxRate ?? OMAN_VAT_RATE;
    const { subtotal, taxAmount, items } = this.buildItems(dto.items, taxRate);
    const discount = dto.discount || 0;
    const total = Number((subtotal + taxAmount - discount).toFixed(3));
    const number = await this.generateNumber(companyId);

    return this.prisma.purchaseOrder.create({
      data: {
        companyId,
        number,
        contactId: dto.contactId,
        date: new Date(dto.date),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
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

  async update(companyId: string, id: string, dto: UpdatePurchaseOrderDto) {
    const existing = await this.findOne(companyId, id);
    if (existing.status === PurchaseOrderStatus.CANCELLED) {
      throw new ForbiddenException('Cannot edit cancelled purchase order');
    }
    if (existing.status === PurchaseOrderStatus.RECEIVED) {
      throw new ForbiddenException('Cannot edit received purchase order');
    }

    const taxRate =
      dto.taxRate != null ? Number(dto.taxRate) : Number(existing.taxRate);
    const discount =
      dto.discount != null ? Number(dto.discount) : Number(existing.discount);

    if (dto.items) {
      const { subtotal, taxAmount, items } = this.buildItems(dto.items, taxRate);
      const total = Number((subtotal + taxAmount - discount).toFixed(3));
      await this.prisma.purchaseOrderItem.deleteMany({ where: { orderId: id } });
      return this.prisma.purchaseOrder.update({
        where: { id },
        data: {
          contactId: dto.contactId ?? existing.contactId,
          date: dto.date ? new Date(dto.date) : existing.date,
          expectedDate:
            dto.expectedDate !== undefined
              ? dto.expectedDate
                ? new Date(dto.expectedDate)
                : null
              : existing.expectedDate,
          subtotal,
          discount,
          taxRate,
          taxAmount,
          total,
          notes: dto.notes !== undefined ? dto.notes : existing.notes,
          status: dto.status ?? existing.status,
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

    return this.prisma.purchaseOrder.update({
      where: { id },
      data: {
        contactId: dto.contactId ?? existing.contactId,
        date: dto.date ? new Date(dto.date) : existing.date,
        expectedDate:
          dto.expectedDate !== undefined
            ? dto.expectedDate
              ? new Date(dto.expectedDate)
              : null
            : existing.expectedDate,
        discount,
        taxRate,
        taxAmount: nextTaxAmount,
        total,
        notes: dto.notes !== undefined ? dto.notes : existing.notes,
        status: dto.status ?? existing.status,
      },
      include: { contact: true, items: true },
    });
  }

  async updateStatus(companyId: string, id: string, status: PurchaseOrderStatus) {
    const existing = await this.findOne(companyId, id);
    if (existing.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        'Cannot change status of a received purchase order',
      );
    }
    if (existing.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot change status of a cancelled purchase order');
    }
    if (status === PurchaseOrderStatus.CANCELLED) {
      if (
        existing.status !== PurchaseOrderStatus.DRAFT &&
        existing.status !== PurchaseOrderStatus.SENT
      ) {
        throw new BadRequestException('Only draft or sent purchase orders can be cancelled');
      }
    }
    if (status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException(
        'Mark received by converting to invoice, not by status patch',
      );
    }
    return this.prisma.purchaseOrder.update({
      where: { id },
      data: { status },
      include: { contact: true, items: true },
    });
  }

  async remove(companyId: string, id: string) {
    const order = await this.findOne(companyId, id);
    if (order.status === PurchaseOrderStatus.RECEIVED) {
      throw new ForbiddenException('Cannot delete received purchase order');
    }
    if (order.status !== PurchaseOrderStatus.DRAFT) {
      throw new BadRequestException(
        'Only DRAFT purchase orders can be deleted — cancel SENT orders instead',
      );
    }
    await this.prisma.purchaseOrder.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  async convertToInvoice(companyId: string, userId: string, id: string) {
    const order = await this.findOne(companyId, id);
    if (order.status === PurchaseOrderStatus.CANCELLED) {
      throw new BadRequestException('Cannot convert cancelled order');
    }
    if (order.status === PurchaseOrderStatus.RECEIVED) {
      throw new BadRequestException('Purchase order already converted / received');
    }

    const invoice = await this.invoicesService.create(companyId, userId, {
      type: InvoiceType.PURCHASE,
      contactId: order.contactId,
      date: new Date().toISOString().split('T')[0],
      dueDate: (order.expectedDate || order.date).toISOString().split('T')[0],
      discount: Number(order.discount),
      taxRate: Number(order.taxRate),
      notes: order.notes ? `من أمر شراء ${order.number}\n${order.notes}` : `من أمر شراء ${order.number}`,
      items: order.items.map((item) => ({
        productId: item.productId || undefined,
        description: item.description,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount),
        taxRate: Number(item.taxRate),
      })),
    });

    await this.prisma.purchaseOrder.update({
      where: { id },
      data: { status: PurchaseOrderStatus.RECEIVED },
    });

    return invoice;
  }
}
