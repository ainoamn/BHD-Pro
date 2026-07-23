import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ContactType, InvoiceType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ProductsService } from '../products/products.service';
import { StockAdjustMode } from '../products/dto/adjust-stock.dto';
import { CreatePosSaleDto } from './dto/pos.dto';

const WALK_IN_NAME = 'POS Walk-in / نقدي';

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
    private products: ProductsService,
  ) {}

  private hashKey(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  async getLinkStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        posLinkedAt: true,
        posIntegrationKeyPrefix: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      linked: !!company.posLinkedAt,
      companyId: company.id,
      companyName: company.name,
      keyPrefix: company.posIntegrationKeyPrefix,
      apps: { accounting: true, pos: true },
    };
  }

  /** Same-login SSO: mark Accounting ↔ POS as linked for this company */
  async activateLink(companyId: string) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { posLinkedAt: new Date() },
      select: { id: true, name: true, posLinkedAt: true },
    });
    return {
      linked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.posLinkedAt,
    };
  }

  async generateIntegrationKey(companyId: string) {
    const secret = `hpos_${randomBytes(24).toString('hex')}`;
    const prefix = secret.slice(0, 12);
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        posIntegrationKeyHash: this.hashKey(secret),
        posIntegrationKeyPrefix: prefix,
        posLinkedAt: new Date(),
      },
    });
    return {
      key: secret,
      prefix,
      linked: true,
      warning: 'Store this key now — it will not be shown again',
    };
  }

  async linkWithKey(companyId: string, key: string) {
    const trimmed = key.trim();
    if (!trimmed.startsWith('hpos_')) {
      throw new BadRequestException('Invalid POS integration key');
    }
    const hash = this.hashKey(trimmed);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, posIntegrationKeyHash: hash },
      select: { id: true },
    });
    if (!company) {
      throw new BadRequestException('Integration key does not match this company');
    }
    return this.activateLink(companyId);
  }

  async lookupProduct(companyId: string, code: string) {
    const q = code.trim();
    if (!q) throw new BadRequestException('Scan code is required');

    const product = await this.prisma.product.findFirst({
      where: {
        companyId,
        isActive: true,
        OR: [
          { barcode: q },
          { sku: { equals: q, mode: 'insensitive' } },
        ],
      },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
    if (!product) throw new NotFoundException('Product not found for this barcode/SKU');
    return product;
  }

  async searchProducts(companyId: string, q: string) {
    const term = q.trim();
    if (!term) {
      return this.prisma.product.findMany({
        where: { companyId, isActive: true },
        take: 40,
        orderBy: { name: 'asc' },
        include: { warehouse: { select: { id: true, code: true, name: true } } },
      });
    }
    return this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        OR: [
          { name: { contains: term, mode: 'insensitive' } },
          { sku: { contains: term, mode: 'insensitive' } },
          { barcode: { contains: term, mode: 'insensitive' } },
        ],
      },
      take: 40,
      orderBy: { name: 'asc' },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
  }

  async ensureWalkInContact(companyId: string) {
    const existing = await this.prisma.contact.findFirst({
      where: { companyId, name: WALK_IN_NAME, isActive: true },
    });
    if (existing) return existing;
    return this.prisma.contact.create({
      data: {
        companyId,
        type: ContactType.CUSTOMER,
        name: WALK_IN_NAME,
        nameEn: 'POS Walk-in',
        notes: 'Auto-created for Hisaby POS cash sales',
        isActive: true,
      },
    });
  }

  async createSale(companyId: string, userId: string, dto: CreatePosSaleDto) {
    const contact = await this.ensureWalkInContact(companyId);
    const today = new Date().toISOString().slice(0, 10);

    const lineItems = [];
    for (const item of dto.items) {
      const product = await this.products.findOne(companyId, item.productId);
      if (!product.isActive) {
        throw new BadRequestException(`Product inactive: ${product.name}`);
      }
      const qty = Number(item.quantity);
      if (product.isTracked && qty > Number(product.quantity)) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name} (available ${product.quantity})`,
        );
      }
      lineItems.push({
        productId: product.id,
        description: product.name,
        quantity: qty,
        unitPrice: item.unitPrice != null ? Number(item.unitPrice) : Number(product.salePrice),
        discount: item.discount || 0,
      });
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ftaConfig: true },
    });
    const taxCfg = (company?.ftaConfig as { vatRate?: number; applyVat?: boolean } | null) || {};
    const taxRate =
      dto.taxRate != null
        ? Number(dto.taxRate)
        : taxCfg.applyVat === false
          ? 0
          : typeof taxCfg.vatRate === 'number'
            ? taxCfg.vatRate
            : 5;

    const invoice = await this.invoices.create(companyId, userId, {
      type: InvoiceType.SALES,
      contactId: contact.id,
      date: today,
      dueDate: today,
      taxRate,
      notes: dto.notes || 'Hisaby POS sale',
      payImmediately: true,
      paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
      items: lineItems,
    });

    for (const item of dto.items) {
      const product = await this.products.findOne(companyId, item.productId);
      if (!product.isTracked) continue;
      await this.products.adjustStock(companyId, product.id, {
        mode: StockAdjustMode.OUT,
        quantity: Number(item.quantity),
        warehouseId: dto.warehouseId || product.warehouseId || undefined,
        reference: invoice.number,
        notes: 'POS sale',
      });
    }

    // Ensure apps marked linked after first successful POS sale with shared login
    await this.prisma.company.updateMany({
      where: { id: companyId, posLinkedAt: null },
      data: { posLinkedAt: new Date() },
    });

    return invoice;
  }
}
