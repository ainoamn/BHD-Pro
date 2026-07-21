import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeliveryNoteDto } from './dto/create-delivery-note.dto';
import { DeliveryNoteStatus, MovementType } from '@prisma/client';

@Injectable()
export class DeliveryNotesService {
  constructor(private prisma: PrismaService) {}

  private async generateNumber(companyId: string) {
    const year = new Date().getFullYear();
    const prefix = `DN-${year}-`;
    const latest = await this.prisma.deliveryNote.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    let next = 1;
    if (latest?.number) {
      const seq = Number(latest.number.slice(prefix.length));
      if (!Number.isNaN(seq)) next = seq + 1;
    }
    return `${prefix}${String(next).padStart(4, '0')}`;
  }

  findAll(companyId: string) {
    return this.prisma.deliveryNote.findMany({
      where: { companyId },
      include: {
        contact: { select: { id: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        items: {
          include: { product: { select: { id: true, sku: true, name: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const row = await this.prisma.deliveryNote.findFirst({
      where: { id, companyId },
      include: {
        contact: true,
        warehouse: true,
        items: { include: { product: true } },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Delivery note not found');
    return row;
  }

  async create(companyId: string, userId: string, dto: CreateDeliveryNoteDto) {
    if (!dto.items?.length) throw new BadRequestException('At least one item required');

    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, companyId },
    });
    if (!contact) throw new BadRequestException('Contact not found');

    if (dto.warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: dto.warehouseId, companyId },
      });
      if (!wh) throw new BadRequestException('Warehouse not found');
    }

    for (const item of dto.items) {
      if (item.productId) {
        const p = await this.prisma.product.findFirst({
          where: { id: item.productId, companyId },
        });
        if (!p) throw new BadRequestException(`Product not found: ${item.productId}`);
      }
    }

    const number = await this.generateNumber(companyId);

    return this.prisma.deliveryNote.create({
      data: {
        companyId,
        number,
        date: new Date(dto.date),
        contactId: dto.contactId,
        warehouseId: dto.warehouseId || null,
        notes: dto.notes || null,
        status: DeliveryNoteStatus.DRAFT,
        createdById: userId,
        items: {
          create: dto.items.map((i) => ({
            productId: i.productId || null,
            description: i.description.trim(),
            quantity: i.quantity,
            unit: i.unit || 'pcs',
          })),
        },
      },
      include: {
        contact: { select: { id: true, name: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        items: true,
      },
    });
  }

  async deliver(companyId: string, id: string) {
    const note = await this.findOne(companyId, id);
    if (note.status !== DeliveryNoteStatus.DRAFT) {
      throw new BadRequestException('Only draft delivery notes can be delivered');
    }

    let warehouseId = note.warehouseId;
    if (!warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!wh) {
        const created = await this.prisma.warehouse.create({
          data: {
            companyId,
            code: 'MAIN',
            name: 'المستودع الرئيسي',
            isActive: true,
          },
        });
        warehouseId = created.id;
      } else {
        warehouseId = wh.id;
      }
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of note.items) {
        if (!item.productId) continue;
        const product = await tx.product.findFirst({
          where: { id: item.productId, companyId },
        });
        if (!product || !product.isTracked) continue;

        const qty = Number(item.quantity);
        const current = Number(product.quantity);
        if (qty > current) {
          throw new BadRequestException(
            `Insufficient stock for ${product.name} (have ${current}, need ${qty})`,
          );
        }

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            warehouseId: warehouseId!,
            type: MovementType.OUT,
            quantity: qty,
            unitCost: Number(product.costPrice),
            reference: note.number,
            notes: `Delivery note ${note.number}`,
          },
        });

        await tx.product.update({
          where: { id: product.id },
          data: {
            quantity: Number((current - qty).toFixed(3)),
            warehouseId: product.warehouseId || warehouseId,
          },
        });
      }

      return tx.deliveryNote.update({
        where: { id },
        data: {
          status: DeliveryNoteStatus.DELIVERED,
          deliveredAt: new Date(),
          warehouseId,
        },
        include: {
          contact: { select: { id: true, name: true } },
          warehouse: { select: { id: true, code: true, name: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const note = await this.findOne(companyId, id);
    if (note.status === DeliveryNoteStatus.DELIVERED) {
      throw new BadRequestException('Cannot cancel a delivered note (reverse stock manually)');
    }
    if (note.status === DeliveryNoteStatus.CANCELLED) {
      return note;
    }
    return this.prisma.deliveryNote.update({
      where: { id },
      data: { status: DeliveryNoteStatus.CANCELLED },
      include: {
        contact: { select: { id: true, name: true } },
        items: true,
      },
    });
  }

  async remove(companyId: string, id: string) {
    const note = await this.findOne(companyId, id);
    if (note.status === DeliveryNoteStatus.DELIVERED) {
      throw new BadRequestException('Cannot delete a delivered note');
    }
    await this.prisma.deliveryNote.delete({ where: { id } });
    return { message: 'Deleted' };
  }
}
