import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ContactType, InvoiceType, MovementType, PaymentMethod } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ProductsService } from '../products/products.service';
import { PeriodsService } from '../periods/periods.service';
import { CreatePosSaleDto } from './dto/pos.dto';

const WALK_IN_NAME = 'POS Walk-in / نقدي';

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
    private products: ProductsService,
    private periods: PeriodsService,
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
      throw new BadRequestException(
        'Integration key does not match this company — generate a key while signed into the same company, or use shared login to link',
      );
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

  /** Atomic stock OUT — safe under concurrent cashiers */
  private async reserveStockOut(
    companyId: string,
    productId: string,
    qty: number,
    warehouseId: string | undefined,
    reference: string,
  ) {
    await this.periods.assertOpen(companyId, new Date());

    return this.prisma.$transaction(async (tx) => {
      const product = await tx.product.findFirst({
        where: { id: productId, companyId },
      });
      if (!product || !product.isActive) {
        throw new BadRequestException('Product not found or inactive');
      }
      if (!product.isTracked) return { productId, reserved: false as const };

      let whId = warehouseId || product.warehouseId;
      if (whId) {
        const wh = await tx.warehouse.findFirst({ where: { id: whId, companyId } });
        if (!wh) throw new NotFoundException('Warehouse not found');
      } else {
        const wh =
          (await tx.warehouse.findFirst({
            where: { companyId, isActive: true },
            orderBy: { createdAt: 'asc' },
          })) ||
          (await tx.warehouse.create({
            data: { companyId, code: 'MAIN', name: 'المستودع الرئيسي', isActive: true },
          }));
        whId = wh.id;
      }

      const updated = await tx.product.updateMany({
        where: {
          id: productId,
          companyId,
          quantity: { gte: qty },
        },
        data: {
          quantity: { decrement: qty },
          warehouseId: whId!,
        },
      });
      if (updated.count === 0) {
        throw new BadRequestException(
          `Insufficient stock for ${product.name} (requested ${qty})`,
        );
      }

      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: whId!,
          type: MovementType.OUT,
          quantity: qty,
          unitCost: product.costPrice,
          reference,
          notes: 'POS sale (reserved)',
        },
      });

      return { productId, reserved: true as const, qty, warehouseId: whId! };
    });
  }

  private async releaseStockIn(
    companyId: string,
    productId: string,
    qty: number,
    warehouseId: string,
    reference: string,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { id: productId, companyId },
        data: { quantity: { increment: qty } },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type: MovementType.IN,
          quantity: qty,
          unitCost: 0,
          reference,
          notes: 'POS sale rollback',
        },
      });
    });
  }

  async createSale(companyId: string, userId: string, dto: CreatePosSaleDto) {
    const contact = await this.ensureWalkInContact(companyId);
    const today = new Date().toISOString().slice(0, 10);
    const reserveRef = `POS-TEMP-${Date.now()}`;

    const lineItems: {
      productId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
    }[] = [];

    for (const item of dto.items) {
      const product = await this.products.findOne(companyId, item.productId);
      if (!product.isActive) {
        throw new BadRequestException(`Product inactive: ${product.name}`);
      }
      const qty = Number(item.quantity);
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
    // Server-authoritative tax — never trust client taxRate
    const taxRate =
      taxCfg.applyVat === false
        ? 0
        : typeof taxCfg.vatRate === 'number'
          ? taxCfg.vatRate
          : 5;

    // 1) Reserve stock first (atomic) so we never charge without inventory
    const reserved: { productId: string; qty: number; warehouseId: string }[] = [];
    let invoiceCreated = false;
    try {
      for (const item of lineItems) {
        const result = await this.reserveStockOut(
          companyId,
          item.productId,
          item.quantity,
          dto.warehouseId,
          reserveRef,
        );
        if (result.reserved) {
          reserved.push({
            productId: result.productId,
            qty: result.qty!,
            warehouseId: result.warehouseId!,
          });
        }
      }

      // 2) Create paid cash invoice
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
      invoiceCreated = true;

      // Post-invoice bookkeeping is best-effort — never roll back stock after a paid sale
      try {
        if (reserved.length) {
          await this.prisma.stockMovement.updateMany({
            where: {
              reference: reserveRef,
              productId: { in: reserved.map((r) => r.productId) },
            },
            data: {
              reference: invoice.number,
              notes: 'POS sale',
            },
          });
        }
      } catch {
        /* keep TEMP reference if rename fails */
      }

      try {
        await this.prisma.company.updateMany({
          where: { id: companyId, posLinkedAt: null },
          data: { posLinkedAt: new Date() },
        });
      } catch {
        /* ignore */
      }

      return invoice;
    } catch (err) {
      // Only release stock if the paid invoice was never created
      if (!invoiceCreated) {
        for (const row of reserved.reverse()) {
          try {
            await this.releaseStockIn(
              companyId,
              row.productId,
              row.qty,
              row.warehouseId,
              `${reserveRef}-ROLLBACK`,
            );
          } catch {
            /* log-less best effort */
          }
        }
      }
      throw err;
    }
  }
}
