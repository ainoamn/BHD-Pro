import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateStockCountDto,
  UpdateStockCountLinesDto,
} from './dto/stock-count.dto';
import { MovementType, StockCountStatus } from '@prisma/client';

@Injectable()
export class StockCountsService {
  constructor(private prisma: PrismaService) {}

  private async generateNumber(companyId: string) {
    const year = new Date().getFullYear();
    const prefix = `SC-${year}-`;
    const latest = await this.prisma.stockCount.findFirst({
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

  private async resolveWarehouse(companyId: string, warehouseId?: string | null) {
    if (warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
      });
      if (!wh) throw new BadRequestException('Warehouse not found');
      return wh.id;
    }
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing.id;
    const created = await this.prisma.warehouse.create({
      data: {
        companyId,
        code: 'MAIN',
        name: 'المستودع الرئيسي',
        isActive: true,
      },
    });
    return created.id;
  }

  findAll(companyId: string) {
    return this.prisma.stockCount.findMany({
      where: { companyId },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
        _count: { select: { lines: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const row = await this.prisma.stockCount.findFirst({
      where: { id, companyId },
      include: {
        warehouse: true,
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true, quantity: true } },
          },
          orderBy: { product: { name: 'asc' } },
        },
        createdBy: { select: { id: true, name: true } },
      },
    });
    if (!row) throw new NotFoundException('Stock count not found');
    return {
      ...row,
      lines: row.lines.map((l) => ({
        ...l,
        variance: Number((Number(l.countedQty) - Number(l.systemQty)).toFixed(3)),
      })),
    };
  }

  async create(companyId: string, userId: string, dto: CreateStockCountDto) {
    const warehouseId = await this.resolveWarehouse(companyId, dto.warehouseId);
    const number = await this.generateNumber(companyId);
    const seed = dto.seedProducts !== false;

    const products = seed
      ? await this.prisma.product.findMany({
          where: { companyId, isActive: true, isTracked: true },
          orderBy: { name: 'asc' },
        })
      : [];

    return this.prisma.stockCount.create({
      data: {
        companyId,
        number,
        date: new Date(dto.date),
        warehouseId,
        notes: dto.notes || null,
        status: StockCountStatus.DRAFT,
        createdById: userId,
        lines: {
          create: products.map((p) => ({
            productId: p.id,
            systemQty: Number(p.quantity),
            countedQty: Number(p.quantity),
          })),
        },
      },
      include: {
        warehouse: { select: { id: true, code: true, name: true } },
        lines: {
          include: {
            product: { select: { id: true, sku: true, name: true, unit: true } },
          },
        },
      },
    });
  }

  async updateLines(companyId: string, id: string, dto: UpdateStockCountLinesDto) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id, companyId },
    });
    if (!count) throw new NotFoundException('Stock count not found');
    if (count.status !== StockCountStatus.DRAFT) {
      throw new BadRequestException('Only draft counts can be edited');
    }

    await this.prisma.$transaction(
      dto.lines.map((line) =>
        this.prisma.stockCountLine.updateMany({
          where: { stockCountId: id, productId: line.productId },
          data: { countedQty: line.countedQty },
        }),
      ),
    );

    return this.findOne(companyId, id);
  }

  async complete(companyId: string, id: string) {
    const count = await this.findOne(companyId, id);
    if (count.status !== StockCountStatus.DRAFT) {
      throw new BadRequestException('Only draft counts can be completed');
    }

    const warehouseId = count.warehouseId || (await this.resolveWarehouse(companyId));

    return this.prisma.$transaction(async (tx) => {
      for (const line of count.lines) {
        const system = Number(line.systemQty);
        const counted = Number(line.countedQty);
        const variance = Number((counted - system).toFixed(3));
        if (Math.abs(variance) < 0.0005) continue;

        const product = await tx.product.findFirst({
          where: { id: line.productId, companyId },
        });
        if (!product || !product.isTracked) continue;

        await tx.stockMovement.create({
          data: {
            productId: product.id,
            warehouseId,
            type: MovementType.ADJUSTMENT,
            quantity: Math.abs(variance),
            unitCost: Number(product.costPrice),
            reference: count.number,
            notes: `Stock count ${count.number}: ${system} → ${counted}`,
          },
        });

        await tx.product.update({
          where: { id: product.id },
          data: {
            quantity: counted,
            warehouseId: product.warehouseId || warehouseId,
          },
        });
      }

      return tx.stockCount.update({
        where: { id },
        data: {
          status: StockCountStatus.COMPLETED,
          completedAt: new Date(),
          warehouseId,
        },
        include: {
          warehouse: { select: { id: true, code: true, name: true } },
          lines: {
            include: {
              product: { select: { id: true, sku: true, name: true, unit: true } },
            },
          },
        },
      });
    });
  }

  async cancel(companyId: string, id: string) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id, companyId },
    });
    if (!count) throw new NotFoundException('Stock count not found');
    if (count.status === StockCountStatus.COMPLETED) {
      throw new BadRequestException('Cannot cancel a completed count');
    }
    return this.prisma.stockCount.update({
      where: { id },
      data: { status: StockCountStatus.CANCELLED },
    });
  }

  async remove(companyId: string, id: string) {
    const count = await this.prisma.stockCount.findFirst({
      where: { id, companyId },
    });
    if (!count) throw new NotFoundException('Stock count not found');
    if (count.status === StockCountStatus.COMPLETED) {
      throw new BadRequestException('Cannot delete a completed count');
    }
    await this.prisma.stockCount.delete({ where: { id } });
    return { message: 'Deleted' };
  }
}
