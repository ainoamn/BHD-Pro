import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto, StockAdjustMode } from './dto/adjust-stock.dto';
import { MovementType, Prisma } from '@prisma/client';
import { PeriodsService } from '../periods/periods.service';

const warehouseStockInclude = {
  warehouseStocks: {
    include: { warehouse: { select: { id: true, code: true, name: true } } },
  },
  warehouse: { select: { id: true, code: true, name: true } },
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private periods: PeriodsService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      include: warehouseStockInclude,
      orderBy: { name: 'asc' },
    });
  }

  async getStats(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        quantity: true,
        minQuantity: true,
        costPrice: true,
        isTracked: true,
        unit: true,
      },
    });

    const lowStockItems = products.filter(
      (p) => p.isTracked && Number(p.quantity) <= Number(p.minQuantity),
    );

    const totalValue = products.reduce(
      (s, p) => s + Number(p.quantity) * Number(p.costPrice),
      0,
    );

    return {
      total: products.length,
      lowStock: lowStockItems.length,
      totalValue,
      lowStockItems,
    };
  }

  async ensureDefaultWarehouse(companyId: string) {
    const existing = await this.prisma.warehouse.findFirst({
      where: { companyId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    if (existing) return existing;

    return this.prisma.warehouse.create({
      data: {
        companyId,
        code: 'MAIN',
        name: 'المستودع الرئيسي',
        isActive: true,
      },
    });
  }

  private normalizeBarcode(barcode: string | null | undefined): string | null | undefined {
    if (barcode === undefined) return undefined;
    if (barcode === null) return null;
    const trimmed = barcode.trim();
    return trimmed.length ? trimmed : null;
  }

  private async assertBarcodeAvailable(
    companyId: string,
    barcode: string | null | undefined,
    excludeProductId?: string,
  ) {
    if (!barcode) return;
    const barcodeTaken = await this.prisma.product.findFirst({
      where: {
        companyId,
        barcode,
        ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
      },
    });
    if (barcodeTaken) throw new ConflictException('Barcode already exists');
  }

  private async syncProductQuantity(
    tx: Prisma.TransactionClient,
    productId: string,
    warehouseId?: string,
  ) {
    const agg = await tx.warehouseStock.aggregate({
      where: { productId },
      _sum: { quantity: true },
    });
    return tx.product.update({
      where: { id: productId },
      data: {
        quantity: agg._sum.quantity ?? 0,
        ...(warehouseId ? { warehouseId } : {}),
      },
      include: warehouseStockInclude,
    });
  }

  async create(companyId: string, dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { companyId, sku: dto.sku },
    });
    if (existing) throw new ConflictException('SKU already exists');

    const barcode = this.normalizeBarcode(dto.barcode);
    await this.assertBarcodeAvailable(companyId, barcode);

    const warehouse = await this.ensureDefaultWarehouse(companyId);
    const { customFieldsJson, barcode: _barcode, ...rest } = dto;
    const qty = Number(dto.quantity ?? 0);

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...rest,
          ...(barcode !== undefined ? { barcode } : {}),
          companyId,
          images: [],
          warehouseId: warehouse.id,
          ...(customFieldsJson !== undefined
            ? { customFieldsJson: customFieldsJson as object }
            : {}),
        },
      });

      if (product.isTracked && qty > 0) {
        await tx.warehouseStock.create({
          data: {
            productId: product.id,
            warehouseId: warehouse.id,
            quantity: qty,
          },
        });
      }

      return tx.product.findFirstOrThrow({
        where: { id: product.id },
        include: warehouseStockInclude,
      });
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(companyId, id);
    const { customFieldsJson, barcode: rawBarcode, ...rest } = dto;
    const barcode = this.normalizeBarcode(rawBarcode);
    await this.assertBarcodeAvailable(companyId, barcode, id);

    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(barcode !== undefined ? { barcode } : {}),
        ...(customFieldsJson !== undefined
          ? { customFieldsJson: customFieldsJson as object }
          : {}),
      },
      include: warehouseStockInclude,
    });
  }

  async findOne(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: warehouseStockInclude,
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async adjustStock(companyId: string, id: string, dto: AdjustStockDto) {
    await this.periods.assertOpen(companyId, new Date());

    const product = await this.findOne(companyId, id);
    if (!product.isTracked) {
      throw new BadRequestException('Product is not stock-tracked');
    }

    const qty = Number(dto.quantity);
    let movementQty = qty;
    let movementType: MovementType = MovementType.ADJUSTMENT;

    if (dto.mode === StockAdjustMode.IN || dto.mode === StockAdjustMode.OUT) {
      if (qty <= 0) throw new BadRequestException('Quantity must be positive');
      movementType = dto.mode === StockAdjustMode.IN ? MovementType.IN : MovementType.OUT;
      movementQty = qty;
    } else {
      movementType = MovementType.ADJUSTMENT;
    }

    let warehouseId = dto.warehouseId || product.warehouseId;
    if (warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId },
      });
      if (!wh) throw new NotFoundException('Warehouse not found');
    } else {
      const wh = await this.ensureDefaultWarehouse(companyId);
      warehouseId = wh.id;
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: { productId: id, warehouseId: warehouseId! },
        },
        create: { productId: id, warehouseId: warehouseId!, quantity: 0 },
        update: {},
      });

      const currentRow = await tx.warehouseStock.findUnique({
        where: {
          productId_warehouseId: { productId: id, warehouseId: warehouseId! },
        },
      });
      const currentWh = Number(currentRow?.quantity ?? 0);

      if (dto.mode === StockAdjustMode.IN) {
        await tx.warehouseStock.update({
          where: {
            productId_warehouseId: { productId: id, warehouseId: warehouseId! },
          },
          data: { quantity: { increment: qty } },
        });
      } else if (dto.mode === StockAdjustMode.OUT) {
        const updated = await tx.warehouseStock.updateMany({
          where: {
            productId: id,
            warehouseId: warehouseId!,
            quantity: { gte: qty },
          },
          data: { quantity: { decrement: qty } },
        });
        if (updated.count === 0) {
          throw new BadRequestException('Insufficient stock');
        }
      } else {
        const nextWh = Number(qty.toFixed(3));
        movementQty = Number(Math.abs(nextWh - currentWh).toFixed(3));
        if (movementQty === 0) {
          return tx.product.findFirstOrThrow({
            where: { id },
            include: warehouseStockInclude,
          });
        }
        await tx.warehouseStock.update({
          where: {
            productId_warehouseId: { productId: id, warehouseId: warehouseId! },
          },
          data: { quantity: nextWh },
        });
      }

      await tx.stockMovement.create({
        data: {
          productId: id,
          warehouseId: warehouseId!,
          type: movementType,
          quantity: movementQty,
          unitCost: Number(product.costPrice),
          reference: dto.reference || null,
          notes: dto.notes || null,
        },
      });

      return this.syncProductQuantity(tx, id, warehouseId!);
    });
  }

  async listMovements(companyId: string, productId: string) {
    await this.findOne(companyId, productId);
    return this.prisma.stockMovement.findMany({
      where: { productId, product: { companyId } },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
