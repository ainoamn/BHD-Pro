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
import { MovementType } from '@prisma/client';
import { PeriodsService } from '../periods/periods.service';

@Injectable()
export class ProductsService {
  constructor(
    private prisma: PrismaService,
    private periods: PeriodsService,
  ) {}

  async findAll(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
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

  async create(companyId: string, dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { companyId, sku: dto.sku },
    });
    if (existing) throw new ConflictException('SKU already exists');

    if (dto.barcode) {
      const barcodeTaken = await this.prisma.product.findFirst({
        where: { companyId, barcode: dto.barcode },
      });
      if (barcodeTaken) throw new ConflictException('Barcode already exists');
    }

    const warehouse = await this.ensureDefaultWarehouse(companyId);
    const { customFieldsJson, ...rest } = dto;

    return this.prisma.product.create({
      data: {
        ...rest,
        companyId,
        images: [],
        warehouseId: warehouse.id,
        ...(customFieldsJson !== undefined
          ? { customFieldsJson: customFieldsJson as object }
          : {}),
      },
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(companyId, id);
    const { customFieldsJson, ...rest } = dto;
    return this.prisma.product.update({
      where: { id },
      data: {
        ...rest,
        ...(customFieldsJson !== undefined
          ? { customFieldsJson: customFieldsJson as object }
          : {}),
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
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

    const current = Number(product.quantity);
    const qty = Number(dto.quantity);
    let nextQty = current;
    let movementQty = qty;
    let movementType: MovementType = MovementType.ADJUSTMENT;

    if (dto.mode === StockAdjustMode.IN) {
      if (qty <= 0) throw new BadRequestException('Quantity must be positive');
      nextQty = Number((current + qty).toFixed(3));
      movementType = MovementType.IN;
      movementQty = qty;
    } else if (dto.mode === StockAdjustMode.OUT) {
      if (qty <= 0) throw new BadRequestException('Quantity must be positive');
      if (qty > current) throw new BadRequestException('Insufficient stock');
      nextQty = Number((current - qty).toFixed(3));
      movementType = MovementType.OUT;
      movementQty = qty;
    } else {
      nextQty = Number(qty.toFixed(3));
      movementQty = Number(Math.abs(nextQty - current).toFixed(3));
      movementType = MovementType.ADJUSTMENT;
      if (movementQty === 0) {
        return product;
      }
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

      return tx.product.update({
        where: { id },
        data: {
          quantity: nextQty,
          warehouseId: warehouseId!,
        },
        include: { warehouse: { select: { id: true, code: true, name: true } } },
      });
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
