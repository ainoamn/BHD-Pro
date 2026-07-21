import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(companyId: string) {
    return this.prisma.product.findMany({
      where: { companyId },
      orderBy: { name: 'asc' },
    });
  }

  async getStats(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
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

  async create(companyId: string, dto: CreateProductDto) {
    const existing = await this.prisma.product.findFirst({
      where: { companyId, sku: dto.sku },
    });
    if (existing) throw new ConflictException('SKU already exists');

    return this.prisma.product.create({
      data: { ...dto, companyId, images: [] },
    });
  }

  async update(companyId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(companyId, id);
    return this.prisma.product.update({ where: { id }, data: dto });
  }

  async findOne(companyId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, companyId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }
}
