import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  ContactType,
  InvoiceStatus,
  InvoiceType,
  MovementType,
  PaymentMethod,
  Prisma,
  UserRole,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { ProductsService } from '../products/products.service';
import { PeriodsService } from '../periods/periods.service';
import { DualControlService } from '../dual-control/dual-control.service';
import { DualApprovalDto } from '../dual-control/dto/approval.dto';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import { canSwitchWarehouseFreely as warehouseRoleCanSwitchFreely } from './warehouse-role';
import {
  CreatePosSaleDto,
  CreatePosDraftDto,
  CreatePosCashMovementDto,
  CreatePosNoSaleDto,
  OpenPosShiftDto,
  ClosePosShiftDto,
  RefundPosSaleDto,
  BlindReturnDto,
  UpdatePosDraftDto,
  DeletePosDraftDto,
  PosStoreCreditTopUpDto,
} from './dto/pos.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { GlPostingService } from '../journal/gl-posting.service';
import { CustomerNotifyService } from '../notifications/customer-notify.service';
import { EmailNotifyService } from '../notifications/email-notify.service';
import { WhatsappNotifyService } from '../notifications/whatsapp-notify.service';
import {
  dialCodeForCountry,
  isValidMobileE164,
  toE164Digits,
} from '../common/phone';
import { PosIncentivesService } from './pos-incentives.service';
import { productWhereForWarehouse } from '../common/warehouse-product-scope';
import {
  parseVariableMeasureBarcode,
  pluWeightQty,
  productMatchesPluArticle,
} from '../common/pos-plu';
import { AuditService } from '../audit/audit.service';
import { ensureCompanyAppsLinked } from '../common/company-apps-link';
import { RedisService } from '../redis/redis.service';

const WALK_IN_NAME = 'POS Walk-in / نقدي';
const POS_REPRINT_ACTION = 'POS_RECEIPT_REPRINT';

@Injectable()
export class PosService {
  private readonly logger = new Logger(PosService.name);

  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
    private products: ProductsService,
    private periods: PeriodsService,
    private dualControl: DualControlService,
    private subscriptions: SubscriptionsService,
    private glPosting: GlPostingService,
    private customerNotify: CustomerNotifyService,
    private emailNotify: EmailNotifyService,
    private whatsapp: WhatsappNotifyService,
    private incentives: PosIncentivesService,
    private audit: AuditService,
    private redis: RedisService,
  ) {}

  private bumpCatalogCache(companyId: string) {
    void this.redis.invalidatePosCatalog(companyId).catch(() => undefined);
    void this.redis.invalidateDashboardStats(companyId).catch(() => undefined);
  }

  private bumpDashboardCache(companyId: string) {
    void this.redis.invalidateDashboardStats(companyId).catch(() => undefined);
  }

  private hashKey(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  async getLinkStatus(companyId: string) {
    await ensureCompanyAppsLinked(this.prisma, companyId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        posLinkedAt: true,
        posIntegrationKeyPrefix: true,
        posWarehouseId: true,
        restoLinkedAt: true,
        posWarehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            nameEn: true,
            sector: true,
          },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      linked: true,
      alwaysLinked: true,
      companyId: company.id,
      companyName: company.name,
      keyPrefix: company.posIntegrationKeyPrefix,
      warehouseId: company.posWarehouseId,
      warehouse: company.posWarehouse,
      restoLinked: true,
      apps: { accounting: true, pos: true, resto: true },
    };
  }

  private async assertCompanyWarehouse(companyId: string, warehouseId: string) {
    const wh = await this.prisma.warehouse.findFirst({
      where: { id: warehouseId, companyId, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        sector: true,
      },
    });
    if (!wh) throw new BadRequestException('Warehouse not found for this company');
    return wh;
  }

  async setWarehouse(companyId: string, warehouseId: string) {
    const wh = await this.assertCompanyWarehouse(companyId, warehouseId);
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        posWarehouseId: wh.id,
        posLinkedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        posLinkedAt: true,
        posWarehouseId: true,
      },
    });
    return {
      linked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.posLinkedAt,
      warehouseId: company.posWarehouseId,
      warehouse: wh,
    };
  }

  async resolvePosWarehouseId(
    companyId: string,
    overrideWarehouseId?: string,
  ): Promise<string | null> {
    if (overrideWarehouseId) {
      await this.assertCompanyWarehouse(companyId, overrideWarehouseId);
      return overrideWarehouseId;
    }
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { posWarehouseId: true },
    });
    return company?.posWarehouseId || null;
  }

  private canSwitchWarehouseFreely(role: string): boolean {
    return warehouseRoleCanSwitchFreely(role);
  }

  async resolveActorHomeWarehouse(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, companyId },
      select: {
        defaultWarehouseId: true,
        defaultWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true, sector: true },
        },
      },
    });
    if (user?.defaultWarehouseId) {
      return {
        id: user.defaultWarehouseId as string,
        warehouse: user.defaultWarehouse,
      };
    }
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        posWarehouseId: true,
        posWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true, sector: true },
        },
      },
    });
    return {
      id: company?.posWarehouseId || null,
      warehouse: company?.posWarehouse || null,
    };
  }

  /**
   * Managers pick any warehouse freely.
   * Cashiers stay on home warehouse unless deferred remote sale is requested.
   */
  async resolveSaleWarehouse(
    companyId: string,
    actor: TokenPayload,
    dto: { warehouseId?: string; deferredFulfillment?: boolean },
  ): Promise<{ warehouseId: string | null; deferred: boolean; homeWarehouseId: string | null }> {
    const home = await this.resolveActorHomeWarehouse(companyId, actor.sub);
    const free = this.canSwitchWarehouseFreely(actor.role);
    const requested = dto.warehouseId?.trim() || null;

    if (free) {
      if (requested) await this.assertCompanyWarehouse(companyId, requested);
      return {
        warehouseId: requested || home.id,
        deferred: !!dto.deferredFulfillment && !!requested && requested !== home.id,
        homeWarehouseId: home.id,
      };
    }

    if (!requested || requested === home.id) {
      return {
        warehouseId: home.id,
        deferred: false,
        homeWarehouseId: home.id,
      };
    }

    await this.assertCompanyWarehouse(companyId, requested);
    if (!dto.deferredFulfillment) {
      throw new BadRequestException(
        'Selling from another warehouse requires deferred fulfillment (deliver later)',
      );
    }
    return {
      warehouseId: requested,
      deferred: true,
      homeWarehouseId: home.id,
    };
  }

  async getPosWarehouseContext(companyId: string, actor: TokenPayload) {
    const home = await this.resolveActorHomeWarehouse(companyId, actor.sub);
    const warehouses = await this.prisma.warehouse.findMany({
      where: { companyId, isActive: true, sector: { in: ['RETAIL', 'GENERAL'] } },
      select: {
        id: true,
        code: true,
        name: true,
        nameEn: true,
        sector: true,
        branchId: true,
      },
      orderBy: { code: 'asc' },
    });
    return {
      canSwitchFreely: this.canSwitchWarehouseFreely(actor.role),
      homeWarehouseId: home.id,
      homeWarehouse: home.warehouse,
      warehouses,
    };
  }

  /** Same-login SSO: apps are always unified — ensure timestamps and optional warehouse. */
  async activateLink(companyId: string, warehouseId?: string) {
    await ensureCompanyAppsLinked(this.prisma, companyId);
    if (warehouseId) {
      return this.setWarehouse(companyId, warehouseId);
    }
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        posLinkedAt: true,
        posWarehouseId: true,
        posWarehouse: {
          select: {
            id: true,
            code: true,
            name: true,
            nameEn: true,
            sector: true,
          },
        },
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      linked: true,
      alwaysLinked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.posLinkedAt,
      warehouseId: company.posWarehouseId,
      warehouse: company.posWarehouse,
      needsWarehouse: !company.posWarehouseId,
    };
  }

  /**
   * Unlink is disabled: Accounting / POS / Restaurants stay one company.
   * Disable modules later via plan / subscription.
   */
  async deactivateLink(companyId: string) {
    await ensureCompanyAppsLinked(this.prisma, companyId);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, posLinkedAt: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      linked: true,
      alwaysLinked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.posLinkedAt,
      message:
        'Apps stay linked for this company. Turn modules off via subscription/plan later.',
    };
  }

  async generateIntegrationKey(companyId: string, warehouseId?: string) {
    if (warehouseId) {
      await this.assertCompanyWarehouse(companyId, warehouseId);
    }
    const secret = 'hpos_' + randomBytes(24).toString('hex');
    const prefix = secret.slice(0, 12);
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        posIntegrationKeyHash: this.hashKey(secret),
        posIntegrationKeyPrefix: prefix,
        posLinkedAt: new Date(),
        ...(warehouseId ? { posWarehouseId: warehouseId } : {}),
      },
    });
    return {
      key: secret,
      prefix,
      linked: true,
      warehouseId: warehouseId || null,
      warning: 'Store this key now — it will not be shown again',
    };
  }

  async linkWithKey(companyId: string, key: string, warehouseId?: string) {
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
    return this.activateLink(companyId, warehouseId);
  }

  private async applyWarehouseQuantity<
    T extends { id: string; quantity: unknown },
  >(products: T[], warehouseId?: string) {
    if (!warehouseId) return products;
    const stocks = await this.prisma.warehouseStock.findMany({
      where: {
        warehouseId,
        productId: { in: products.map((p) => p.id) },
      },
      select: { productId: true, quantity: true },
    });
    const byProduct = new Map(stocks.map((s) => [s.productId, Number(s.quantity)]));
    return products.map((p) => ({
      ...p,
      totalQuantity: Number(p.quantity),
      quantity: byProduct.get(p.id) ?? 0,
    }));
  }

  async lookupProduct(companyId: string, code: string, warehouseId?: string) {
    const q = code.trim();
    if (!q) throw new BadRequestException('Scan code is required');

    const scopeWh = await this.resolvePosWarehouseId(companyId, warehouseId);
    const plu = parseVariableMeasureBarcode(q);

    let product = await this.prisma.product.findFirst({
      where: scopeWh
        ? {
            AND: [
              productWhereForWarehouse(companyId, scopeWh),
              {
                OR: [
                  { barcode: q },
                  { sku: { equals: q, mode: 'insensitive' } },
                ],
              },
            ],
          }
        : {
            companyId,
            isActive: true,
            OR: [
              { barcode: q },
              { sku: { equals: q, mode: 'insensitive' } },
            ],
          },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });

    // Variable-measure EAN-13 (prefix 2): match article code → qty from embedded weight
    if (!product && plu) {
      const candidates = await this.prisma.product.findMany({
        where: scopeWh
          ? productWhereForWarehouse(companyId, scopeWh)
          : { companyId, isActive: true },
        take: 5000,
        include: { warehouse: { select: { id: true, code: true, name: true } } },
      });
      product =
        candidates.find((p) => productMatchesPluArticle(p, plu.articleCode)) ||
        null;
    }

    if (!product) throw new NotFoundException('Product not found for this barcode/SKU');
    const [mapped] = await this.applyWarehouseQuantity([product], scopeWh || undefined);

    if (plu && productMatchesPluArticle(product, plu.articleCode)) {
      const qty = pluWeightQty(plu.valueInt);
      return {
        ...mapped,
        scanQty: qty,
        scanMode: 'weight' as const,
        pluArticle: plu.articleCode,
        pluRaw: q,
      };
    }

    return mapped;
  }

  async searchProducts(companyId: string, q: string, warehouseId?: string) {
    const scopeWh = await this.resolvePosWarehouseId(companyId, warehouseId);
    const term = q.trim();
    const where = scopeWh
      ? productWhereForWarehouse(companyId, scopeWh, term || undefined)
      : !term
        ? { companyId, isActive: true }
        : {
            companyId,
            isActive: true,
            OR: [
              { name: { contains: term, mode: 'insensitive' as const } },
              { sku: { contains: term, mode: 'insensitive' as const } },
              { barcode: { contains: term, mode: 'insensitive' as const } },
            ],
          };

    const products = await this.prisma.product.findMany({
      where,
      take: 40,
      orderBy: { name: 'asc' },
      include: { warehouse: { select: { id: true, code: true, name: true } } },
    });
    return this.applyWarehouseQuantity(products, scopeWh || undefined);
  }

  async syncCatalog(companyId: string, warehouseId?: string) {
    const scopeWh = await this.resolvePosWarehouseId(companyId, warehouseId);
    const cacheKey = this.redis.posCatalogKey(companyId, scopeWh);
    type CatalogPayload = {
      warehouseId: string | null;
      syncedAt: string | Date;
      count: number;
      products: unknown[];
      full: true;
      needsWarehouse: boolean;
      cached?: boolean;
    };

    if (this.redis.isConfigured()) {
      const hit = await this.redis.getJson<CatalogPayload>(cacheKey);
      if (hit && Array.isArray(hit.products)) {
        return {
          ...hit,
          warehouseId: hit.warehouseId ?? scopeWh ?? null,
          syncedAt: new Date(hit.syncedAt),
          full: true as const,
          cached: true,
        };
      }
    }

    const products = await this.prisma.product.findMany({
      where: scopeWh
        ? productWhereForWarehouse(companyId, scopeWh)
        : { companyId, isActive: true },
      take: 5000,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        quantity: true,
        minQuantity: true,
        isTracked: true,
        unit: true,
        soldByWeight: true,
        warehouseId: true,
        updatedAt: true,
      },
    });
    const withStock = await this.applyWarehouseQuantity(products, scopeWh || undefined);
    const payload = {
      warehouseId: scopeWh || null,
      syncedAt: new Date(),
      count: withStock.length,
      products: withStock,
      full: true as const,
      needsWarehouse: !scopeWh,
      cached: false,
    };

    if (this.redis.isConfigured()) {
      void this.redis
        .setJson(cacheKey, { ...payload, syncedAt: payload.syncedAt.toISOString() }, this.redis.posCatalogTtlSec())
        .catch(() => undefined);
    }

    return payload;
  }

  /**
   * Incremental stock/qty sync for offline POS.
   * Pass `since` ISO timestamp to receive only products updated after that time.
   * Without since → same as full catalog sync (full: true).
   */
  async syncStock(companyId: string, warehouseId?: string, since?: string) {
    if (!since) {
      return this.syncCatalog(companyId, warehouseId);
    }
    const sinceDate = new Date(since);
    if (Number.isNaN(sinceDate.getTime())) {
      return this.syncCatalog(companyId, warehouseId);
    }

    const scopeWh = await this.resolvePosWarehouseId(companyId, warehouseId);
    const baseWhere = scopeWh
      ? productWhereForWarehouse(companyId, scopeWh)
      : { companyId, isActive: true };

    const products = await this.prisma.product.findMany({
      where: {
        AND: [baseWhere, { updatedAt: { gt: sinceDate } }],
      },
      take: 5000,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        quantity: true,
        minQuantity: true,
        isTracked: true,
        unit: true,
        soldByWeight: true,
        warehouseId: true,
        updatedAt: true,
      },
    });
    const withStock = await this.applyWarehouseQuantity(products, scopeWh || undefined);
    return {
      warehouseId: scopeWh || null,
      syncedAt: new Date(),
      since: sinceDate,
      count: withStock.length,
      products: withStock,
      full: false,
      needsWarehouse: !scopeWh,
    };
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

  /** Atomic stock OUT — safe under concurrent cashiers (per-warehouse) */
  private async reserveStockOut(
    companyId: string,
    productId: string,
    qty: number,
    warehouseId: string | undefined,
    reference: string,
    notes = 'POS sale (reserved)',
    allowNegative = false,
  ) {
    await this.periods.assertOpen(companyId, new Date());

    const result = await this.prisma.$transaction(async (tx) => {
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

      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId: whId! },
        },
        create: { productId, warehouseId: whId!, quantity: 0 },
        update: {},
      });

      if (allowNegative) {
        await tx.warehouseStock.update({
          where: {
            productId_warehouseId: { productId, warehouseId: whId! },
          },
          data: { quantity: { decrement: qty } },
        });
        await tx.product.update({
          where: { id: productId },
          data: {
            quantity: { decrement: qty },
            warehouseId: whId!,
          },
        });
      } else {
        const whUpdated = await tx.warehouseStock.updateMany({
          where: {
            productId,
            warehouseId: whId!,
            quantity: { gte: qty },
          },
          data: { quantity: { decrement: qty } },
        });
        if (whUpdated.count === 0) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" at this warehouse (on hand below requested ${qty}). Reduce quantity or restock before checkout.`,
          );
        }

        const productUpdated = await tx.product.updateMany({
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
        if (productUpdated.count === 0) {
          throw new BadRequestException(
            `Insufficient stock for "${product.name}" (on hand below requested ${qty}). Reduce quantity or restock before checkout.`,
          );
        }
      }

      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId: whId!,
          type: MovementType.OUT,
          quantity: qty,
          unitCost: product.costPrice,
          reference,
          notes: allowNegative ? `${notes} [STOCK_OVERRIDE]` : notes,
        },
      });

      return { productId, reserved: true as const, qty, warehouseId: whId! };
    });
    if (result.reserved) this.bumpCatalogCache(companyId);
    return result;
  }

  /** Public stock OUT for restaurant recipe components (and similar) */
  async consumeStock(
    companyId: string,
    productId: string,
    qty: number,
    warehouseId: string | undefined,
    reference: string,
    notes = 'Resto recipe component',
  ) {
    return this.reserveStockOut(
      companyId,
      productId,
      qty,
      warehouseId,
      reference,
      notes,
    );
  }

  private async releaseStockIn(
    companyId: string,
    productId: string,
    qty: number,
    warehouseId: string,
    reference: string,
    notes = 'POS sale rollback',
  ) {
    if (qty <= 0.0005) return;
    await this.prisma.$transaction(async (tx) => {
      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        create: { productId, warehouseId, quantity: qty },
        update: { quantity: { increment: qty } },
      });
      const agg = await tx.warehouseStock.aggregate({
        where: { productId },
        _sum: { quantity: true },
      });
      await tx.product.updateMany({
        where: { id: productId, companyId },
        data: { quantity: agg._sum.quantity ?? 0 },
      });
      await tx.stockMovement.create({
        data: {
          productId,
          warehouseId,
          type: MovementType.IN,
          quantity: qty,
          unitCost: 0,
          reference,
          notes,
        },
      });
    });
    this.bumpCatalogCache(companyId);
  }

  /** Units already returned to stock for this sale (refunds / prior voids). */
  private async stockAlreadyRestoredByProduct(
    companyId: string,
    invoiceNumber: string,
  ): Promise<Map<string, number>> {
    const moves = await this.prisma.stockMovement.findMany({
      where: {
        type: MovementType.IN,
        product: { companyId },
        OR: [
          { reference: `${invoiceNumber}-VOID` },
          { reference: { startsWith: `${invoiceNumber}-REFUND` } },
          { notes: { contains: `POS refund of ${invoiceNumber}` } },
        ],
      },
      select: { productId: true, quantity: true },
    });
    const map = new Map<string, number>();
    for (const m of moves) {
      map.set(m.productId, (map.get(m.productId) || 0) + Number(m.quantity));
    }
    return map;
  }

  /** Manual resend of customer receipt notify (WA / email / SMS). */
  async resendSaleNotify(companyId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      select: {
        id: true,
        contactId: true,
        isCash: true,
        notes: true,
        contact: { select: { id: true, phone: true, name: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Sale not found');
    const notes = String(invoice.notes || '');
    if (!invoice.isCash || !notes.includes('Hisaby POS')) {
      throw new BadRequestException('Only Hisaby POS sales can resend notify');
    }
    if (!invoice.contactId) {
      throw new BadRequestException('Sale has no customer contact');
    }
    const delivery = await this.customerNotify.resendPosSaleNotify(
      companyId,
      invoice.id,
      invoice.contactId,
    );
    return { ok: true, delivery };
  }

  /** Void a POS cash sale: reverse payments, restore warehouse stock, cancel invoice */
  async voidSale(
    companyId: string,
    actor: TokenPayload,
    invoiceId: string,
    approval?: DualApprovalDto,
  ) {
    const userId = actor.sub;
    await this.dualControl.assertApproved(companyId, actor, 'POS_VOID', approval);

    const invoice = await this.invoices.findOne(companyId, invoiceId);

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Sale already voided');
    }

    const notes = String(invoice.notes || '');
    if (!invoice.isCash || !notes.includes('Hisaby POS')) {
      throw new BadRequestException('Only Hisaby POS cash sales can be voided here');
    }

    await this.periods.assertOpen(companyId, new Date());

    const alreadyRestored = await this.prisma.stockMovement.findFirst({
      where: {
        reference: `${invoice.number}-VOID`,
        type: MovementType.IN,
        product: { companyId },
      },
      select: { id: true },
    });

    const hasPaid =
      Number(invoice.paidAmount) > 0.0005 || (invoice.payments?.length ?? 0) > 0;
    if (hasPaid) {
      await this.invoices.reverseAllPayments(companyId, userId, invoiceId);
    }

    if (!alreadyRestored) {
      const restoredByProduct = await this.stockAlreadyRestoredByProduct(
        companyId,
        invoice.number,
      );

      const outMoves = await this.prisma.stockMovement.findMany({
        where: {
          reference: invoice.number,
          type: MovementType.OUT,
          product: { companyId, isTracked: true },
        },
        select: {
          productId: true,
          warehouseId: true,
          quantity: true,
        },
      });

      if (outMoves.length) {
        for (const m of outMoves) {
          const already = restoredByProduct.get(m.productId) || 0;
          const need = Number((Number(m.quantity) - already).toFixed(3));
          if (need <= 0.0005) continue;
          await this.releaseStockIn(
            companyId,
            m.productId,
            need,
            m.warehouseId,
            `${invoice.number}-VOID`,
            'POS sale void',
          );
          restoredByProduct.set(m.productId, already + need);
        }
      } else {
        // Fallback if movement refs were not renamed after sale
        for (const item of invoice.items) {
          if (!item.productId) continue;
          const product = await this.prisma.product.findFirst({
            where: { id: item.productId, companyId },
          });
          if (!product?.isTracked) continue;

          let whId = product.warehouseId;
          if (!whId) {
            const wh = await this.prisma.warehouse.findFirst({
              where: { companyId, isActive: true },
              orderBy: { createdAt: 'asc' },
            });
            if (!wh) continue;
            whId = wh.id;
          }

          const already = restoredByProduct.get(product.id) || 0;
          const need = Number((Number(item.quantity) - already).toFixed(3));
          if (need <= 0.0005) continue;

          await this.releaseStockIn(
            companyId,
            product.id,
            need,
            whId,
            `${invoice.number}-VOID`,
            'POS sale void',
          );
          restoredByProduct.set(product.id, already + need);
        }
      }
    }

    const cancelled = await this.invoices.updateStatus(
      companyId,
      userId,
      invoiceId,
      InvoiceStatus.CANCELLED,
    );

    const fields = (invoice.customFieldsJson || {}) as Record<string, unknown>;
    const usedStoreCredit =
      notes.includes('STORE_CREDIT') ||
      fields.usedStoreCredit === true ||
      invoice.payments?.some((p) => p.method === PaymentMethod.STORE_CREDIT);
    if (usedStoreCredit && invoice.contactId) {
      const restoreAmount =
        typeof fields.storeCreditAmount === 'number'
          ? fields.storeCreditAmount
          : Number(fields.storeCreditAmount) > 0
            ? Number(fields.storeCreditAmount)
            : Number(invoice.total);
      if (restoreAmount > 0) {
        try {
          await this.prisma.contact.updateMany({
            where: { id: invoice.contactId, companyId },
            data: { currentBalance: { increment: restoreAmount } },
          });
        } catch {
          /* non-fatal — void already applied */
        }
      }
    }

    const customerNotify = await this.awaitCustomerNotify(
      'void',
      companyId,
      invoiceId,
      invoice.contactId,
    );

    try {
      await this.incentives.reverseOnVoid(
        companyId,
        invoiceId,
        invoice.createdById,
      );
    } catch {
      /* never fail void */
    }

    this.bumpDashboardCache(companyId);
    return {
      voided: true,
      invoice: cancelled,
      customerNotify: customerNotify ?? null,
    };
  }

  /** Awaited notify for sale/void/refund/blind-return/fulfill honesty; never throws. */
  private async awaitCustomerNotify(
    kind: 'sale' | 'void' | 'refund' | 'blind_return' | 'fulfill',
    companyId: string,
    invoiceId: string,
    contactId: string | null | undefined,
    creditNoteId?: string,
  ): Promise<{
    whatsapp?: string;
    email?: string;
    sms?: string;
  } | null> {
    if (!contactId) return null;
    try {
      if (kind === 'sale') {
        return await this.customerNotify.notifyPosSale(
          companyId,
          invoiceId,
          contactId,
        );
      }
      if (kind === 'void') {
        return await this.customerNotify.notifyPosVoid(
          companyId,
          invoiceId,
          contactId,
        );
      }
      if (kind === 'blind_return') {
        return await this.customerNotify.notifyPosBlindReturn(
          companyId,
          invoiceId,
          contactId,
        );
      }
      if (kind === 'fulfill') {
        return await this.customerNotify.notifyPosFulfill(
          companyId,
          invoiceId,
          contactId,
        );
      }
      return await this.customerNotify.notifyPosRefund(
        companyId,
        invoiceId,
        contactId,
        creditNoteId,
      );
    } catch {
      return null;
    }
  }

  private async resolveSaleContact(companyId: string, contactId?: string) {
    if (!contactId) return this.ensureWalkInContact(companyId);

    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId, isActive: true },
    });
    if (!contact) {
      throw new BadRequestException('Contact not found or inactive for this company');
    }
    return contact;
  }

  private async resolveUserRole(userId: string, roleFromToken?: string) {
    if (roleFromToken) return roleFromToken;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return user?.role;
  }

  private static readonly SPLIT_PAYMENT_METHODS = new Set<PaymentMethod>([
    PaymentMethod.CASH,
    PaymentMethod.CREDIT_CARD,
    PaymentMethod.BANK_TRANSFER,
    PaymentMethod.STORE_CREDIT,
  ]);

  async createSale(
    companyId: string,
    actor: TokenPayload,
    dto: CreatePosSaleDto,
  ) {
    await this.subscriptions.assertCanCreateInvoice(companyId);
    const userId = actor.sub;

    const saleWh = await this.resolveSaleWarehouse(companyId, actor, {
      warehouseId: dto.warehouseId,
      deferredFulfillment: dto.deferredFulfillment,
    });
    const effectiveWarehouseId = saleWh.warehouseId || undefined;
    const deferredFulfillment = saleWh.deferred;

    const clientSaleId = dto.clientSaleId?.trim();
    if (clientSaleId) {
      const existing = await this.prisma.invoice.findFirst({
        where: {
          companyId,
          notes: { contains: `[CLIENT_SALE:${clientSaleId}]` },
        },
        include: {
          contact: true,
          items: true,
          payments: true,
        },
      });
      if (existing) {
        return existing;
      }
    }

    const contact = await this.resolveSaleContact(companyId, dto.contactId);
    const today = new Date().toISOString().slice(0, 10);
    const reserveRef = `POS-TEMP-${Date.now()}`;

    const tipAmount = dto.tipAmount != null ? Number(dto.tipAmount) : 0;
    if (tipAmount < 0) {
      throw new BadRequestException('tipAmount must be >= 0');
    }
    const tipAssigneeId = dto.tipAssigneeId?.trim() || null;
    const serviceChargeAmount =
      dto.serviceChargeAmount != null ? Number(dto.serviceChargeAmount) : 0;
    if (serviceChargeAmount < 0) {
      throw new BadRequestException('serviceChargeAmount must be >= 0');
    }

    const splitPayments = Array.isArray(dto.payments) ? dto.payments : null;
    const useSplit = !!splitPayments && splitPayments.length > 0;
    const useStoreCredit =
      !useSplit &&
      (dto.useStoreCredit === true ||
        dto.paymentMethod === PaymentMethod.STORE_CREDIT);

    if (useStoreCredit && contact.name === WALK_IN_NAME) {
      throw new BadRequestException('Store credit requires a non-walk-in contact');
    }

    const lineItems: {
      productId: string | null;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
      taxRate?: number;
      notes?: string | null;
    }[] = [];

    let hasPriceOverride = false;
    let hasExcessiveDiscount = false;
    const discountLimits =
      await this.dualControl.getLineDiscountLimits(companyId);
    for (const item of dto.items) {
      const product = await this.products.findOne(companyId, item.productId);
      if (!product.isActive) {
        throw new BadRequestException(`Product inactive: ${product.name}`);
      }
      const catalogPrice = Number(product.salePrice);
      const unitPrice =
        item.unitPrice != null ? Number(item.unitPrice) : catalogPrice;
      const overridden =
        item.unitPrice != null && Math.abs(unitPrice - catalogPrice) > 0.001;
      if (overridden) {
        // Any POS role may request an override; dual-control approval is required below
        hasPriceOverride = true;
      }
      const qty = Number(item.quantity);
      const discount = Number(item.discount || 0);
      if (discount < 0) {
        throw new BadRequestException('Line discount must be >= 0');
      }
      const lineGross = unitPrice * qty;
      if (discount > lineGross + 0.0005) {
        throw new BadRequestException(
          `Discount exceeds line total for ${product.name}`,
        );
      }
      const pct = lineGross > 0.0005 ? (discount / lineGross) * 100 : 0;
      if (
        discount > discountLimits.amount + 0.0005 ||
        pct > discountLimits.percent + 0.0005
      ) {
        hasExcessiveDiscount = true;
      }
      lineItems.push({
        productId: product.id,
        description: product.name,
        quantity: qty,
        unitPrice,
        discount,
        notes: item.notes?.trim() || null,
      });
    }

    if (tipAmount > 0.0005) {
      lineItems.push({
        productId: null,
        description: 'Tip / بقشيش',
        quantity: 1,
        unitPrice: tipAmount,
        discount: 0,
        taxRate: 0,
      });
    }
    if (serviceChargeAmount > 0.0005) {
      lineItems.push({
        productId: null,
        description: 'Service charge / رسوم خدمة',
        quantity: 1,
        unitPrice: serviceChargeAmount,
        discount: 0,
        taxRate: 0,
      });
    }

    let loyaltyRedeemPoints = 0;
    let loyaltyRedeemValue = 0;
    const requestedRedeem = Number(dto.loyaltyPointsToRedeem || 0);
    if (requestedRedeem > 0.0005) {
      if (contact.name === WALK_IN_NAME) {
        throw new BadRequestException('Loyalty redeem requires a customer');
      }
      const incentivesCfg = await this.incentives.getConfig(companyId);
      if (
        !incentivesCfg.customerEnabled ||
        !incentivesCfg.redeemEnabled ||
        !(incentivesCfg.redeemPointsPerUnit! > 0)
      ) {
        throw new BadRequestException('Loyalty redeem is not enabled');
      }
      const bal = await this.prisma.contact.findFirst({
        where: { id: contact.id, companyId },
        select: { loyaltyPoints: true },
      });
      const available = Number(bal?.loyaltyPoints || 0);
      loyaltyRedeemPoints = Math.min(requestedRedeem, available);
      if (!(loyaltyRedeemPoints > 0.0005)) {
        throw new BadRequestException('Insufficient loyalty points');
      }
      loyaltyRedeemValue = Number(
        (loyaltyRedeemPoints * incentivesCfg.redeemPointsPerUnit!).toFixed(3),
      );
      // Apply as merchandise discounts (skip tip line)
      let remaining = loyaltyRedeemValue;
      for (const item of lineItems) {
        if (!item.productId || remaining <= 0.0005) continue;
        const lineNet = item.unitPrice * item.quantity - (item.discount || 0);
        if (lineNet <= 0.0005) continue;
        const take = Math.min(remaining, lineNet);
        item.discount = Number(((item.discount || 0) + take).toFixed(3));
        remaining = Number((remaining - take).toFixed(3));
      }
      loyaltyRedeemValue = Number(
        (loyaltyRedeemValue - remaining).toFixed(3),
      );
      if (loyaltyRedeemValue <= 0.0005) {
        loyaltyRedeemPoints = 0;
        loyaltyRedeemValue = 0;
      } else if (remaining > 0.0005 && incentivesCfg.redeemPointsPerUnit! > 0) {
        // Scale points to value actually applied
        loyaltyRedeemPoints = Number(
          (loyaltyRedeemValue / incentivesCfg.redeemPointsPerUnit!).toFixed(3),
        );
      }
    }

    const dualActions: Array<
      'POS_PRICE_OVERRIDE' | 'POS_LINE_DISCOUNT' | 'POS_STOCK_OVERRIDE'
    > = [];
    if (hasPriceOverride) dualActions.push('POS_PRICE_OVERRIDE');
    if (hasExcessiveDiscount) dualActions.push('POS_LINE_DISCOUNT');
    const allowNegativeStock = dto.allowNegativeStock === true;
    if (allowNegativeStock) dualActions.push('POS_STOCK_OVERRIDE');
    if (dualActions.length) {
      await this.dualControl.assertApprovedForActions(
        companyId,
        actor,
        dualActions,
        dto.approval,
      );
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ftaConfig: true },
    });
    const taxCfg =
      (company?.ftaConfig as { vatRate?: number; applyVat?: boolean } | null) ||
      {};
    const taxRate =
      taxCfg.applyVat === false
        ? 0
        : typeof taxCfg.vatRate === 'number'
          ? taxCfg.vatRate
          : 5;

    let estimatedSubtotal = 0;
    let estimatedTax = 0;
    for (const item of lineItems) {
      const lineNet = item.unitPrice * item.quantity - (item.discount || 0);
      estimatedSubtotal += lineNet;
      const lineTaxRate = item.taxRate != null ? item.taxRate : taxRate;
      estimatedTax += lineNet * (lineTaxRate / 100);
    }
    const estimatedTotal = Number((estimatedSubtotal + estimatedTax).toFixed(3));

    let storeCreditPortion = 0;
    if (useSplit) {
      let paySum = 0;
      for (const row of splitPayments!) {
        if (!PosService.SPLIT_PAYMENT_METHODS.has(row.method)) {
          throw new BadRequestException(
            `Unsupported split payment method: ${row.method}`,
          );
        }
        const amt = Number(row.amount);
        if (!(amt > 0)) {
          throw new BadRequestException('Each split payment amount must be > 0');
        }
        paySum += amt;
        if (row.method === PaymentMethod.STORE_CREDIT) storeCreditPortion += amt;
      }
      paySum = Number(paySum.toFixed(3));
      if (Math.abs(paySum - estimatedTotal) > 0.005) {
        throw new BadRequestException(
          `Split payments sum ${paySum.toFixed(3)} must equal total ${estimatedTotal.toFixed(3)}`,
        );
      }
      if (storeCreditPortion > 0) {
        if (contact.name === WALK_IN_NAME) {
          throw new BadRequestException(
            'Store credit split requires a non-walk-in contact',
          );
        }
        const currentBalance = Number(contact.currentBalance || 0);
        if (currentBalance + 0.0005 < storeCreditPortion) {
          throw new BadRequestException(
            `Insufficient store credit: balance ${currentBalance.toFixed(3)}, required ${storeCreditPortion.toFixed(3)}`,
          );
        }
      }
    } else if (useStoreCredit) {
      storeCreditPortion = estimatedTotal;
      const currentBalance = Number(contact.currentBalance || 0);
      if (currentBalance < estimatedTotal) {
        throw new BadRequestException(
          `Insufficient store credit: balance ${currentBalance.toFixed(3)}, required ${estimatedTotal.toFixed(3)}`,
        );
      }
    }

    const openShift = await this.findOpenShift(companyId, effectiveWarehouseId || null);
    if ((await this.dualControl.isRequireOpenShift(companyId)) && !openShift) {
      throw new BadRequestException(
        'An open shift is required before completing a sale. Open a shift from /pos/shifts first.',
      );
    }

    const reserved: { productId: string; qty: number; warehouseId: string }[] = [];
    let invoiceCreated = false;
    let loyaltyPointsDebited = false;
    try {
      if (loyaltyRedeemPoints > 0.0005) {
        await this.incentives.debitLoyaltyPoints(
          companyId,
          contact.id,
          loyaltyRedeemPoints,
        );
        loyaltyPointsDebited = true;
      }

      if (!deferredFulfillment) {
        for (const item of lineItems) {
          if (!item.productId) continue;
          const result = await this.reserveStockOut(
            companyId,
            item.productId,
            item.quantity,
            effectiveWarehouseId,
            reserveRef,
            'POS sale (reserved)',
            allowNegativeStock,
          );
          if (result.reserved) {
            reserved.push({
              productId: result.productId,
              qty: result.qty!,
              warehouseId: result.warehouseId!,
            });
          }
        }
      }

      const paymentMethod = useStoreCredit
        ? PaymentMethod.STORE_CREDIT
        : (dto.paymentMethod ?? PaymentMethod.CASH);
      const partnerCheckout = !!dto.partnerCheckout && !useStoreCredit && !useSplit;
      const baseNotes = dto.notes?.trim() || 'Hisaby POS sale';
      const withOverride = allowNegativeStock
        ? `[STOCK_OVERRIDE] ${baseNotes}`
        : baseNotes;
      const withDeferred = deferredFulfillment
        ? `[POS_DEFERRED_FULFILL] ${withOverride}`
        : withOverride;
      const withClient = clientSaleId
        ? `${withDeferred} [CLIENT_SALE:${clientSaleId}]`
        : withDeferred;
      const notes =
        useStoreCredit || storeCreditPortion > 0
          ? `[STORE_CREDIT] ${withClient}`
          : partnerCheckout
            ? `[PARTNER_PAY] ${withClient}`
            : withClient;

      let invoice = await this.invoices.create(companyId, userId, {
        type: InvoiceType.SALES,
        contactId: contact.id,
        date: today,
        dueDate: today,
        taxRate,
        notes,
        payImmediately: partnerCheckout ? false : !useSplit,
        paymentMethod: useSplit || partnerCheckout ? undefined : paymentMethod,
        items: lineItems.map((li) => ({
          productId: li.productId || undefined,
          description: li.description,
          quantity: li.quantity,
          unitPrice: li.unitPrice,
          discount: li.discount || 0,
          ...(li.taxRate != null ? { taxRate: li.taxRate } : {}),
          ...(li.notes ? { notes: li.notes } : {}),
        })),
      });
      invoiceCreated = true;

      try {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            posWarehouseId: effectiveWarehouseId || null,
            posFulfillmentStatus: deferredFulfillment ? 'PENDING' : null,
          },
        });
      } catch {
        /* columns may be pending migrate — non-fatal for sale */
      }

      if (partnerCheckout) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { isCash: true, status: InvoiceStatus.SENT },
        });
        invoice = await this.prisma.invoice.findUniqueOrThrow({
          where: { id: invoice.id },
          include: {
            contact: true,
            items: true,
            payments: true,
          },
        });
      }

      if (useSplit) {
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: { isCash: true },
        });
        try {
          for (const row of splitPayments!) {
            invoice = await this.invoices.recordPayment(
              companyId,
              userId,
              invoice.id,
              {
                method: row.method,
                amount: Number(row.amount),
                date: today,
                notes: 'POS split payment',
              },
            );
          }
        } catch (splitErr) {
          try {
            if (Number(invoice.paidAmount) > 0.0005) {
              await this.invoices.reverseAllPayments(companyId, userId, invoice.id);
            }
            await this.invoices.updateStatus(
              companyId,
              userId,
              invoice.id,
              InvoiceStatus.CANCELLED,
            );
          } catch {
            /* best-effort */
          }
          invoiceCreated = false;
          throw splitErr;
        }
      }

      if (storeCreditPortion > 0.0005) {
        const debitAmount = Number(storeCreditPortion.toFixed(3));
        const debited = await this.prisma.contact.updateMany({
          where: {
            id: contact.id,
            companyId,
            currentBalance: { gte: debitAmount },
          },
          data: { currentBalance: { decrement: debitAmount } },
        });
        if (debited.count === 0) {
          try {
            if (Number(invoice.paidAmount) > 0.0005) {
              await this.invoices.reverseAllPayments(companyId, userId, invoice.id);
            }
            await this.invoices.updateStatus(
              companyId,
              userId,
              invoice.id,
              InvoiceStatus.CANCELLED,
            );
          } catch {
            /* best-effort */
          }
          invoiceCreated = false;
          throw new BadRequestException(
            `Insufficient store credit: required ${debitAmount.toFixed(3)}`,
          );
        }
        try {
          const existingFields =
            ((invoice as { customFieldsJson?: Record<string, unknown> })
              .customFieldsJson || {}) as Record<string, unknown>;
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              customFieldsJson: {
                ...existingFields,
                usedStoreCredit: true,
                storeCreditAmount: debitAmount,
                ...(tipAmount > 0.0005 ? { tipAmount } : {}),
                ...(serviceChargeAmount > 0.0005
                  ? { serviceChargeAmount }
                  : {}),
                ...(tipAssigneeId ? { tipAssigneeId } : {}),
              },
            },
          });
        } catch {
          /* non-fatal */
        }
      } else if (
        tipAmount > 0.0005 ||
        serviceChargeAmount > 0.0005 ||
        tipAssigneeId
      ) {
        try {
          const existingFields =
            ((invoice as { customFieldsJson?: Record<string, unknown> })
              .customFieldsJson || {}) as Record<string, unknown>;
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              customFieldsJson: {
                ...existingFields,
                ...(tipAmount > 0.0005 ? { tipAmount } : {}),
                ...(serviceChargeAmount > 0.0005
                  ? { serviceChargeAmount }
                  : {}),
                ...(tipAssigneeId ? { tipAssigneeId } : {}),
              },
            },
          });
        } catch {
          /* non-fatal */
        }
      }

      if (openShift) {
        try {
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: { posShiftId: openShift.id },
          });
        } catch {
          /* non-fatal */
        }
      }

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
        /* keep TEMP */
      }

      let customerNotify: {
        whatsapp?: string;
        email?: string;
        sms?: string;
      } | null = null;
      if (
        !partnerCheckout &&
        contact.name !== WALK_IN_NAME &&
        (contact.phone || contact.email)
      ) {
        customerNotify = await this.awaitCustomerNotify(
          'sale',
          companyId,
          invoice.id,
          contact.id,
        );
      }

      // Loyalty + parked draft: best-effort after sale is durable — don't delay cashier UX
      void (async () => {
        try {
          if (loyaltyRedeemPoints > 0.0005) {
            await this.incentives.recordRedeemLedger(
              companyId,
              contact.id,
              invoice.id,
              loyaltyRedeemPoints,
              `Redeem ${loyaltyRedeemValue.toFixed(3)}`,
            );
            try {
              const existingFields =
                ((invoice as { customFieldsJson?: Record<string, unknown> })
                  .customFieldsJson || {}) as Record<string, unknown>;
              await this.prisma.invoice.update({
                where: { id: invoice.id },
                data: {
                  customFieldsJson: {
                    ...existingFields,
                    loyaltyRedeemPoints,
                    loyaltyRedeemValue,
                  },
                },
              });
            } catch {
              /* non-fatal */
            }
          }
        } catch (err) {
          this.logger.warn(
            `loyalty redeem ledger failed: ${err instanceof Error ? err.message : err}`,
          );
        }
        try {
          await this.incentives.accrueOnSale(
            companyId,
            userId,
            { id: invoice.id, total: invoice.total },
            contact.name !== WALK_IN_NAME ? contact.id : null,
          );
        } catch {
          /* never fail sale */
        }
        try {
          await this.consumeParkedDraftForSale(
            companyId,
            actor,
            dto.parkedDraftId,
            invoice.number,
          );
        } catch {
          /* non-fatal */
        }
      })();

      const fresh = await this.prisma.invoice.findUnique({
        where: { id: invoice.id },
        include: {
          contact: true,
          items: true,
          payments: true,
          posWarehouse: {
            select: { id: true, code: true, name: true, nameEn: true },
          },
        },
      });
      this.bumpDashboardCache(companyId);
      return {
        ...(fresh || invoice),
        customerNotify: customerNotify ?? null,
      };
    } catch (err) {
      if (loyaltyPointsDebited && !invoiceCreated) {
        try {
          await this.incentives.restoreLoyaltyPoints(
            companyId,
            contact.id,
            loyaltyRedeemPoints,
          );
        } catch {
          /* best effort */
        }
      }
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
            /* best effort */
          }
        }
      }
      throw err;
    }
  }

  async listDeferredFulfillments(companyId: string, take = 40) {
    const rows = await this.prisma.invoice.findMany({
      where: {
        companyId,
        posFulfillmentStatus: 'PENDING',
        isCash: true,
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 100),
      include: {
        contact: { select: { id: true, name: true, phone: true } },
        items: {
          select: {
            productId: true,
            description: true,
            quantity: true,
          },
        },
        posWarehouse: {
          select: { id: true, code: true, name: true, nameEn: true },
        },
      },
    });
    return rows.map((inv) => ({
      id: inv.id,
      number: inv.number,
      total: inv.total,
      createdAt: inv.createdAt,
      contact: inv.contact,
      warehouse: inv.posWarehouse,
      items: inv.items,
    }));
  }

  async fulfillDeferredSale(
    companyId: string,
    actor: TokenPayload,
    invoiceId: string,
    allowNegativeStock = false,
  ) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, companyId, posFulfillmentStatus: 'PENDING' },
      include: { items: true },
    });
    if (!invoice) {
      throw new NotFoundException('Deferred POS sale not found');
    }
    if (!invoice.posWarehouseId) {
      throw new BadRequestException('Sale has no source warehouse');
    }

    const reserveRef = `POS-FULFILL-${invoice.number}`;
    const reserved: { productId: string; qty: number; warehouseId: string }[] =
      [];
    try {
      for (const item of invoice.items) {
        if (!item.productId) continue;
        const result = await this.reserveStockOut(
          companyId,
          item.productId,
          Number(item.quantity),
          invoice.posWarehouseId,
          reserveRef,
          `POS deferred fulfill ${invoice.number}`,
          allowNegativeStock,
        );
        if (result.reserved) {
          reserved.push({
            productId: result.productId,
            qty: result.qty!,
            warehouseId: result.warehouseId!,
          });
        }
      }
      await this.prisma.stockMovement.updateMany({
        where: {
          reference: reserveRef,
          productId: { in: reserved.map((r) => r.productId) },
        },
        data: {
          reference: invoice.number,
          notes: 'POS deferred fulfillment',
        },
      });
      const updated = await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { posFulfillmentStatus: 'DONE' },
        include: {
          contact: true,
          items: true,
          payments: true,
          posWarehouse: {
            select: { id: true, code: true, name: true, nameEn: true },
          },
        },
      });

      const customerNotify = await this.awaitCustomerNotify(
        'fulfill',
        companyId,
        updated.id,
        updated.contactId,
      );

      return {
        ok: true,
        invoice: updated,
        fulfilledBy: actor.sub,
        customerNotify: customerNotify ?? null,
      };
    } catch (err) {
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
          /* best effort */
        }
      }
      throw err;
    }
  }

  /** Parked carts older than this are purged on list (housekeeping). */
  private static readonly DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

  async listDrafts(companyId: string) {
    const cutoff = new Date(Date.now() - PosService.DRAFT_TTL_MS);
    await this.prisma.posDraft.deleteMany({
      where: {
        companyId,
        createdAt: { lt: cutoff },
        OR: [{ heldAmount: null }, { heldAmount: { lte: 0 } }],
      },
    });
    const drafts = await this.prisma.posDraft.findMany({
      where: { companyId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
    const contactIds = [
      ...new Set(
        drafts
          .map((d) => d.contactId)
          .filter((id): id is string => !!id),
      ),
    ];
    const contacts = contactIds.length
      ? await this.prisma.contact.findMany({
          where: { companyId, id: { in: contactIds } },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const byId = new Map(contacts.map((c) => [c.id, c]));
    return drafts.map((d) => ({
      ...d,
      heldAmount: d.heldAmount != null ? Number(d.heldAmount) : null,
      contact: d.contactId ? byId.get(d.contactId) || null : null,
    }));
  }

  async createDraft(
    companyId: string,
    actor: TokenPayload,
    dto: CreatePosDraftDto,
  ) {
    if (!dto.lines?.length) {
      throw new BadRequestException('Draft lines are required');
    }

    const trimmedName = dto.name?.trim();
    let name = trimmedName;
    if (!name) {
      const count = await this.prisma.posDraft.count({ where: { companyId } });
      name = `Parked ${count + 1}`;
    }

    const heldAmount = Number(dto.heldAmount || 0);
    const heldMethod = dto.heldMethod || null;
    if (heldAmount > 0.0005 && !heldMethod) {
      throw new BadRequestException('heldMethod is required when heldAmount is set');
    }
    if (heldMethod && !(heldAmount > 0.0005)) {
      throw new BadRequestException('heldAmount is required when heldMethod is set');
    }

    let heldMovementId: string | null = null;
    if (heldAmount > 0.0005 && heldMethod === 'CASH') {
      const move = await this.createCashMovement(companyId, actor, {
        type: 'IN',
        amount: heldAmount,
        reason: `Park hold: ${name}`,
        warehouseId: dto.warehouseId,
      });
      heldMovementId = move.movement.id;
    }

    return this.prisma.posDraft.create({
      data: {
        companyId,
        createdById: actor.sub,
        name,
        notes: dto.notes?.trim() || null,
        warehouseId: dto.warehouseId || null,
        contactId: dto.contactId || null,
        linesJson: dto.lines as unknown as Prisma.InputJsonValue,
        heldAmount: heldAmount > 0.0005 ? heldAmount : null,
        heldMethod: heldAmount > 0.0005 ? heldMethod : null,
        heldMovementId,
        suspendReason: dto.suspendReason.trim(),
      },
    });
  }

  async updateDraft(companyId: string, id: string, dto: UpdatePosDraftDto) {
    const existing = await this.prisma.posDraft.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Parked cart not found');
    const data: { name?: string; notes?: string | null } = {};
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Draft name is required');
      data.name = name;
    }
    if (dto.notes !== undefined) {
      const notes = dto.notes.trim();
      data.notes = notes || null;
    }
    if (!Object.keys(data).length) {
      throw new BadRequestException('Nothing to update');
    }
    return this.prisma.posDraft.update({
      where: { id },
      data,
    });
  }

  /** @deprecated Prefer updateDraft */
  async updateDraftName(companyId: string, id: string, dto: UpdatePosDraftDto) {
    return this.updateDraft(companyId, id, dto);
  }

  /**
   * Reverse a CASH park hold (drawer OUT) so expected cash stays correct when
   * the hold is applied to a sale or returned on delete.
   */
  private async reverseCashParkHold(
    companyId: string,
    actor: TokenPayload,
    opts: {
      heldAmount: number;
      warehouseId?: string | null;
      reason: string;
      approval?: DualApprovalDto;
    },
  ) {
    await this.createCashMovement(companyId, actor, {
      type: 'OUT',
      amount: opts.heldAmount,
      reason: opts.reason,
      warehouseId: opts.warehouseId || undefined,
      approval: opts.approval,
    });
  }

  async deleteDraft(
    companyId: string,
    actor: TokenPayload,
    id: string,
    dto?: DeletePosDraftDto,
  ) {
    const existing = await this.prisma.posDraft.findFirst({
      where: { id, companyId },
    });
    if (!existing) throw new NotFoundException('Parked cart not found');

    const heldAmount = Number(existing.heldAmount || 0);
    if (heldAmount > 0.0005 && existing.heldMethod === 'CASH') {
      await this.reverseCashParkHold(companyId, actor, {
        heldAmount,
        warehouseId: existing.warehouseId,
        reason: `Return park hold: ${existing.name}`,
        approval: dto?.approval,
      });
    }

    await this.prisma.posDraft.delete({ where: { id } });
    return { deleted: true, id, heldReturned: heldAmount > 0.0005 };
  }

  /** Apply parked hold into sale payments and consume the draft. */
  private async consumeParkedDraftForSale(
    companyId: string,
    actor: TokenPayload,
    parkedDraftId: string | undefined,
    invoiceNumber: string,
  ) {
    if (!parkedDraftId) return;
    const draft = await this.prisma.posDraft.findFirst({
      where: { id: parkedDraftId, companyId },
    });
    if (!draft) return;

    const heldAmount = Number(draft.heldAmount || 0);
    if (heldAmount > 0.0005 && draft.heldMethod === 'CASH') {
      try {
        await this.reverseCashParkHold(companyId, actor, {
          heldAmount,
          warehouseId: draft.warehouseId,
          reason: `Apply park hold to sale ${invoiceNumber}`,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to reverse park hold for draft ${parkedDraftId}: ${
            err instanceof Error ? err.message : err
          }`,
        );
      }
    }

    try {
      await this.prisma.posDraft.delete({ where: { id: draft.id } });
    } catch {
      /* already gone */
    }
  }

  /** Floor top-up of customer store credit (wallet) with optional cash-in. */
  async topUpStoreCredit(
    companyId: string,
    actor: TokenPayload,
    dto: PosStoreCreditTopUpDto,
  ) {
    const amount = Number(dto.amount);
    if (!(amount > 0.0005)) {
      throw new BadRequestException('Amount must be greater than zero');
    }

    const contact = await this.prisma.contact.findFirst({
      where: { id: dto.contactId, companyId, isActive: true },
    });
    if (!contact) throw new NotFoundException('Customer not found');
    if (contact.type === ContactType.SUPPLIER) {
      throw new BadRequestException('Store credit applies to customers only');
    }

    const current = Number(contact.currentBalance || 0);
    const next = Number((current + amount).toFixed(3));
    const limit = Number(contact.creditLimit || 0);
    if (limit > 0 && next > limit + 0.001) {
      throw new BadRequestException(
        `Exceeds credit limit ${limit.toFixed(3)} (would be ${next.toFixed(3)})`,
      );
    }

    if (dto.bankAccountId) {
      const bank = await this.prisma.bankAccount.findFirst({
        where: { id: dto.bankAccountId, companyId },
      });
      if (!bank) throw new BadRequestException('Bank account not found');
    }

    const updated = await this.prisma.contact.update({
      where: { id: contact.id },
      data: { currentBalance: next },
    });

    await this.glPosting.postStoreCreditFunding(companyId, actor.sub, {
      contactId: contact.id,
      contactName: contact.name,
      amount,
      notes: dto.notes || `POS top-up (${dto.method})`,
      bankAccountId: dto.bankAccountId,
      reference: `POS-SC-TOPUP:${contact.id}:${Date.now()}`,
    });

    let cashMovementId: string | null = null;
    if (dto.method === 'CASH') {
      const move = await this.createCashMovement(companyId, actor, {
        type: 'IN',
        amount,
        reason: dto.notes?.trim() || `Store credit top-up: ${contact.name}`,
        warehouseId: dto.warehouseId,
      });
      cashMovementId = move.movement.id;
    }

    return {
      contact: {
        id: updated.id,
        name: updated.name,
        storeCreditBalance: Number(updated.currentBalance || 0),
      },
      amount,
      method: dto.method,
      cashMovementId,
    };
  }

  async getCurrentShift(
    companyId: string,
    warehouseId?: string | null,
    opts?: { light?: boolean },
  ) {
    if (opts?.light) {
      const shift = await this.prisma.posShift.findFirst({
        where: {
          companyId,
          status: 'OPEN',
          warehouseId: warehouseId ? warehouseId : null,
        },
        orderBy: { openedAt: 'desc' },
        select: {
          id: true,
          openedAt: true,
          openingFloat: true,
          warehouseId: true,
          status: true,
          notes: true,
          warehouse: { select: { id: true, name: true, code: true } },
          openedBy: { select: { id: true, name: true, email: true } },
        },
      });
      if (!shift) return { shift: null };
      return { shift, live: null, cashMovements: [] };
    }
    const shift = await this.findOpenShift(companyId, warehouseId);
    if (!shift) return { shift: null };
    const live = await this.buildZReport(
      companyId,
      shift.id,
      shift.openedAt,
      new Date(),
      Number(shift.openingFloat),
    );
    return {
      shift,
      live,
      cashMovements: shift.cashMovements || [],
    };
  }

  /** Start of calendar day in Asia/Muscat (UTC+4, no DST). */
  private startOfDayMuscat(now = new Date()): Date {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Muscat',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = fmt.format(now); // YYYY-MM-DD
    return new Date(`${dateStr}T00:00:00+04:00`);
  }

  /**
   * Lightweight today totals for POS checkout strip.
   * Counts Hisaby POS invoices since start of day (Asia/Muscat).
   */
  async getTodayStats(
    companyId: string,
    opts?: { warehouseId?: string; cashierId?: string },
  ) {
    const warehouseId = opts?.warehouseId;
    const cashierId = opts?.cashierId;
    const from = this.startOfDayMuscat();
    const warehouseFilter = warehouseId
      ? {
          OR: [
            { posWarehouseId: warehouseId },
            { posShift: { is: { warehouseId } } },
            { AND: [{ posWarehouseId: null }, { posShiftId: null }] },
          ],
        }
      : {};

    const baseWhere = {
      companyId,
      type: InvoiceType.SALES,
      isCash: true,
      notes: { contains: 'Hisaby POS' },
      createdAt: { gte: from },
      ...warehouseFilter,
    };

    const [storeAgg, storeVoidCount, storeRefundCount, myAgg, myVoidCount, myRefundCount] =
      await Promise.all([
        this.prisma.invoice.aggregate({
          where: {
            ...baseWhere,
            status: { not: InvoiceStatus.CANCELLED },
          },
          _count: { id: true },
          _sum: { total: true },
        }),
        this.prisma.invoice.count({
          where: { ...baseWhere, status: InvoiceStatus.CANCELLED },
        }),
        this.prisma.invoice.count({
          where: {
            companyId,
            type: InvoiceType.CREDIT_NOTE,
            notes: { contains: 'Hisaby POS refund' },
            createdAt: { gte: from },
            ...warehouseFilter,
          },
        }),
        cashierId
          ? this.prisma.invoice.aggregate({
              where: {
                ...baseWhere,
                createdById: cashierId,
                status: { not: InvoiceStatus.CANCELLED },
              },
              _count: { id: true },
              _sum: { total: true },
            })
          : Promise.resolve(null),
        cashierId
          ? this.prisma.invoice.count({
              where: {
                ...baseWhere,
                createdById: cashierId,
                status: InvoiceStatus.CANCELLED,
              },
            })
          : Promise.resolve(0),
        cashierId
          ? this.prisma.invoice.count({
              where: {
                companyId,
                type: InvoiceType.CREDIT_NOTE,
                notes: { contains: 'Hisaby POS refund' },
                createdAt: { gte: from },
                createdById: cashierId,
                ...warehouseFilter,
              },
            })
          : Promise.resolve(0),
      ]);

    const store = {
      salesCount: storeAgg._count.id || 0,
      salesTotal: Number(Number(storeAgg._sum.total || 0).toFixed(3)),
      refundCount: storeRefundCount,
      voidCount: storeVoidCount,
    };
    const mine = cashierId
      ? {
          salesCount: myAgg?._count.id || 0,
          salesTotal: Number(Number(myAgg?._sum.total || 0).toFixed(3)),
          refundCount: myRefundCount,
          voidCount: myVoidCount,
        }
      : store;

    return {
      ...store,
      mine,
      store,
      cashierId: cashierId || null,
      from,
    };
  }

  /**
   * Lightweight POS books (standalone mode): month revenues from cash sales,
   * expenses from cash-out movements, net = revenue − expenses − refunds.
   */
  async getBooksSummary(companyId: string) {
    const from = this.startOfDayMuscat();
    const monthStart = new Date(from);
    monthStart.setDate(1);

    const [monthSales, monthVoids, monthRefunds, monthCashOut, monthCashIn, today] =
      await Promise.all([
        this.prisma.invoice.findMany({
          where: {
            companyId,
            type: InvoiceType.SALES,
            isCash: true,
            notes: { contains: 'Hisaby POS' },
            status: { not: InvoiceStatus.CANCELLED },
            createdAt: { gte: monthStart },
          },
          select: { id: true, number: true, total: true, createdAt: true, status: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.invoice.aggregate({
          where: {
            companyId,
            type: InvoiceType.SALES,
            isCash: true,
            notes: { contains: 'Hisaby POS' },
            status: InvoiceStatus.CANCELLED,
            createdAt: { gte: monthStart },
          },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.invoice.aggregate({
          where: {
            companyId,
            type: InvoiceType.CREDIT_NOTE,
            notes: { contains: 'Hisaby POS refund' },
            status: { not: InvoiceStatus.CANCELLED },
            createdAt: { gte: monthStart },
          },
          _sum: { total: true },
          _count: true,
        }),
        this.prisma.posCashMovement.findMany({
          where: {
            type: 'OUT',
            createdAt: { gte: monthStart },
            shift: { companyId },
          },
          select: {
            id: true,
            amount: true,
            reason: true,
            createdAt: true,
            createdBy: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.posCashMovement.aggregate({
          where: {
            type: 'IN',
            createdAt: { gte: monthStart },
            shift: { companyId },
          },
          _sum: { amount: true },
          _count: true,
        }),
        this.getTodayStats(companyId, {}),
      ]);

    const revenue = monthSales.reduce((s, inv) => s + Number(inv.total), 0);
    const expenses = monthCashOut.reduce((s, m) => s + Number(m.amount), 0);
    const refunds = Number(monthRefunds._sum.total || 0);
    const net = revenue - expenses - refunds;

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { posLinkedAt: true, currency: true, plan: true },
    });
    await ensureCompanyAppsLinked(this.prisma, companyId);

    return {
      linked: true,
      alwaysLinked: true,
      currency: company?.currency || 'OMR',
      plan: company?.plan || 'STARTER',
      monthFrom: monthStart.toISOString(),
      today,
      revenue: Number(revenue.toFixed(3)),
      salesCount: monthSales.length,
      expenses: Number(expenses.toFixed(3)),
      expenseCount: monthCashOut.length,
      refunds: Number(refunds.toFixed(3)),
      refundCount: monthRefunds._count || 0,
      voidedTotal: Number(monthVoids._sum.total || 0),
      voidCount: monthVoids._count || 0,
      cashIn: Number(monthCashIn._sum.amount || 0),
      cashInCount: monthCashIn._count || 0,
      net: Number(net.toFixed(3)),
      recentSales: monthSales.slice(0, 12).map((s) => ({
        id: s.id,
        number: s.number,
        total: Number(s.total),
        createdAt: s.createdAt,
      })),
      recentExpenses: monthCashOut.slice(0, 12).map((m) => ({
        id: m.id,
        amount: Number(m.amount),
        reason: m.reason,
        createdAt: m.createdAt,
        createdBy: m.createdBy?.name || null,
      })),
    };
  }

  /** One OPEN shift per company+warehouse (null warehouse = company default drawer). */
  private async findOpenShift(companyId: string, warehouseId?: string | null) {
    return this.prisma.posShift.findFirst({
      where: {
        companyId,
        status: 'OPEN',
        warehouseId: warehouseId ? warehouseId : null,
      },
      orderBy: { openedAt: 'desc' },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true } },
        cashMovements: {
          orderBy: { createdAt: 'desc' },
          include: {
            createdBy: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async createCashMovement(
    companyId: string,
    actor: TokenPayload,
    dto: CreatePosCashMovementDto,
  ) {
    const resolved = await this.resolveSaleWarehouse(companyId, actor, {
      warehouseId: dto.warehouseId,
      deferredFulfillment: false,
    });
    const shiftWh = this.canSwitchWarehouseFreely(actor.role)
      ? dto.warehouseId || null
      : resolved.homeWarehouseId;
    const shift = await this.findOpenShift(companyId, shiftWh);
    if (!shift) throw new BadRequestException('No open shift');
    const amount = Number(dto.amount);
    if (!(amount > 0)) {
      throw new BadRequestException('Amount must be greater than zero');
    }
    const reason = dto.reason?.trim() || null;
    if (dto.type === 'OUT' && !reason) {
      throw new BadRequestException('Reason is required for cash out');
    }

    if (dto.type === 'OUT') {
      const limit = await this.dualControl.getCashOutApprovalLimit(companyId);
      if (amount >= limit) {
        await this.dualControl.assertApproved(
          companyId,
          actor,
          'SHIFT_CASH_OUT',
          dto.approval,
        );
      }
    }

    let movement = await this.prisma.posCashMovement.create({
      data: {
        companyId,
        shiftId: shift.id,
        type: dto.type,
        amount,
        reason,
        createdById: actor.sub,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    const reference = `POS-CASH-${dto.type}:${movement.id}`;
    const journal =
      dto.type === 'OUT'
        ? await this.glPosting.postPosCashOut(companyId, actor.sub, {
            amount,
            reason: reason || undefined,
            reference,
          })
        : await this.glPosting.postPosCashIn(companyId, actor.sub, {
            amount,
            reason: reason || undefined,
            reference,
          });

    if (journal?.id) {
      movement = await this.prisma.posCashMovement.update({
        where: { id: movement.id },
        data: { journalId: journal.id },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });
    }

    const live = await this.buildZReport(
      companyId,
      shift.id,
      shift.openedAt,
      new Date(),
      Number(shift.openingFloat),
    );
    const cashMovements = await this.prisma.posCashMovement.findMany({
      where: { companyId, shiftId: shift.id },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    const whLabel = shift.warehouse
      ? `${shift.warehouse.code || ''} ${shift.warehouse.name || ''}`.trim()
      : 'default';
    const staffNotify = await this.notifyStaffWhatsAppAlert(companyId, [
      dto.type === 'OUT'
        ? `صرف نقد من الصندوق · ${whLabel}`
        : `إيداع نقد للصندوق · ${whLabel}`,
      dto.type === 'OUT'
        ? `Cash OUT · ${whLabel}`
        : `Cash IN · ${whLabel}`,
      `المبلغ / amount: ${amount.toFixed(3)}`,
      reason ? `السبب / reason: ${reason}` : '',
      `بواسطة / by: ${movement.createdBy?.name || actor.email}`,
    ]);
    return {
      movement,
      live,
      cashMovements,
      shift: { id: shift.id },
      journalId: movement.journalId || null,
      postedToGl: !!movement.journalId,
      staffNotify,
    };
  }

  async reverseCashMovement(
    companyId: string,
    actor: TokenPayload,
    movementId: string,
    approval?: DualApprovalDto,
  ) {
    const movement = await this.prisma.posCashMovement.findFirst({
      where: { id: movementId, companyId },
      include: {
        shift: {
          include: {
            warehouse: { select: { code: true, name: true } },
          },
        },
      },
    });
    if (!movement) throw new NotFoundException('Cash movement not found');
    if (movement.shift.closedAt) {
      throw new BadRequestException('Cannot reverse cash movement on a closed shift');
    }
    if (Number(movement.amount) <= 0.0005 && !movement.journalId) {
      throw new BadRequestException('Movement already reversed');
    }

    if (movement.type === 'OUT') {
      const limit = await this.dualControl.getCashOutApprovalLimit(companyId);
      if (Number(movement.amount) >= limit) {
        await this.dualControl.assertApproved(
          companyId,
          actor,
          'SHIFT_CASH_OUT',
          approval,
        );
      }
    }

    if (movement.journalId) {
      await this.glPosting.reversePosCashMovement(companyId, actor.sub, movement);
    }

    await this.prisma.posCashMovement.delete({ where: { id: movement.id } });

    const live = await this.buildZReport(
      companyId,
      movement.shiftId,
      movement.shift.openedAt,
      new Date(),
      Number(movement.shift.openingFloat),
    );
    const cashMovements = await this.prisma.posCashMovement.findMany({
      where: { companyId, shiftId: movement.shiftId },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    const whLabel = movement.shift.warehouse
      ? `${movement.shift.warehouse.code || ''} ${movement.shift.warehouse.name || ''}`.trim()
      : 'default';
    const staffNotify = await this.notifyStaffWhatsAppAlert(companyId, [
      `عكس حركة نقد · ${whLabel}`,
      `Cash movement reversed · ${whLabel}`,
      `الأصل / was: ${movement.type} ${Number(movement.amount).toFixed(3)}`,
      movement.reason ? `السبب / reason: ${movement.reason}` : '',
      `بواسطة / by: ${actor.email}`,
    ]);
    return {
      reversed: true,
      movementId: movement.id,
      live,
      cashMovements,
      shift: { id: movement.shiftId },
      staffNotify,
    };
  }

  /** Audited no-sale drawer open (amount 0). Does not affect expected cash. */
  async createNoSale(
    companyId: string,
    actor: TokenPayload,
    dto: CreatePosNoSaleDto,
  ) {
    const shift = await this.findOpenShift(companyId, dto.warehouseId || null);
    if (!shift) throw new BadRequestException('No open shift');
    const reason = dto.reason?.trim();
    if (!reason) {
      throw new BadRequestException('Reason is required for no-sale');
    }

    await this.dualControl.assertApproved(
      companyId,
      actor,
      'POS_NO_SALE',
      dto.approval,
    );

    const movement = await this.prisma.posCashMovement.create({
      data: {
        companyId,
        shiftId: shift.id,
        type: 'NO_SALE',
        amount: 0,
        reason,
        createdById: actor.sub,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    const cashMovements = await this.prisma.posCashMovement.findMany({
      where: { companyId, shiftId: shift.id },
      orderBy: { createdAt: 'desc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });

    const whLabel = shift.warehouse
      ? `${shift.warehouse.code || ''} ${shift.warehouse.name || ''}`.trim()
      : 'default';
    const staffNotify = await this.notifyStaffWhatsAppAlert(companyId, [
      `فتح درج بلا بيع · ${whLabel}`,
      `No-sale drawer open · ${whLabel}`,
      `السبب / reason: ${reason}`,
      `بواسطة / by: ${movement.createdBy?.name || actor.email}`,
    ]);

    return {
      movement,
      cashMovements,
      shift: { id: shift.id },
      staffNotify,
    };
  }

  async getCustomerRecentSales(companyId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId },
      select: { id: true, name: true },
    });
    if (!contact) throw new NotFoundException('Customer not found');

    const sales = await this.prisma.invoice.findMany({
      where: {
        companyId,
        contactId,
        type: InvoiceType.SALES,
        status: { not: InvoiceStatus.CANCELLED },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        items: {
          include: {
            product: { select: { id: true, sku: true, barcode: true } },
          },
        },
        payments: { select: { method: true } },
      },
    });

    return {
      contact,
      sales: sales.map((inv) => ({
        id: inv.id,
        number: inv.number,
        total: inv.total,
        date: inv.date,
        createdAt: inv.createdAt,
        status: inv.status,
        notes: inv.notes,
        items: inv.items,
        payments: inv.payments,
      })),
    };
  }

  /** Recent Hisaby POS cash sales for reprint / void / refund drawer. */
  async listRecentSales(
    companyId: string,
    opts?: { take?: number; warehouseId?: string; q?: string },
  ) {
    const take = Math.min(Math.max(opts?.take ?? 20, 1), 50);
    const warehouseId = opts?.warehouseId?.trim() || undefined;
    const q = String(opts?.q || '').trim();
    const qDigits = q.replace(/\D/g, '');
    const amountRaw = q.replace(/,/g, '');
    const amount = parseFloat(amountRaw);
    const looksLikeAmount =
      Number.isFinite(amount) &&
      amount >= 0 &&
      /^[\d.,]+$/.test(amountRaw) &&
      amountRaw.length > 0;

    const searchOr =
      q.length > 0
        ? [
            { number: { contains: q, mode: 'insensitive' as const } },
            {
              contact: {
                is: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    ...(qDigits.length >= 3
                      ? [{ phone: { contains: qDigits } }]
                      : q.length >= 3
                        ? [{ phone: { contains: q } }]
                        : []),
                  ],
                },
              },
            },
            ...(looksLikeAmount
              ? [
                  {
                    total: {
                      gte: Number((amount - 0.005).toFixed(3)),
                      lte: Number((amount + 0.005).toFixed(3)),
                    },
                  },
                ]
              : []),
          ]
        : undefined;

    const warehouseOr = warehouseId
      ? [
          { posWarehouseId: warehouseId },
          { posShift: { is: { warehouseId } } },
          // Legacy sales without warehouse tags still appear on the register
          { AND: [{ posWarehouseId: null }, { posShiftId: null }] },
        ]
      : undefined;

    const sales = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.SALES,
        isCash: true,
        notes: { contains: 'Hisaby POS' },
        ...(warehouseOr && searchOr
          ? { AND: [{ OR: warehouseOr }, { OR: searchOr }] }
          : warehouseOr
            ? { OR: warehouseOr }
            : searchOr
              ? { OR: searchOr }
              : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        items: {
          include: {
            product: { select: { id: true, sku: true, barcode: true } },
          },
        },
        payments: { select: { method: true, amount: true } },
        contact: { select: { id: true, name: true, phone: true } },
        posShift: { select: { warehouseId: true } },
      },
    });

    const reprintCounts = await this.getReprintCounts(
      companyId,
      sales.map((s) => s.id),
    );

    return sales.map((inv) => ({
      id: inv.id,
      number: inv.number,
      total: inv.total,
      date: inv.date,
      createdAt: inv.createdAt,
      status: inv.status,
      notes: inv.notes,
      warehouseId: inv.posWarehouseId || inv.posShift?.warehouseId || null,
      contact: inv.contact,
      items: inv.items,
      payments: inv.payments,
      reprintCount: reprintCounts[inv.id] || 0,
    }));
  }

  /** Log audited receipt reprint; returns updated reprint count for the sale. */
  async recordReceiptReprint(
    companyId: string,
    actor: TokenPayload,
    invoiceId: string,
    variant: 'STANDARD' | 'GIFT' = 'STANDARD',
  ) {
    const inv = await this.prisma.invoice.findFirst({
      where: {
        id: invoiceId,
        companyId,
        type: InvoiceType.SALES,
        isCash: true,
        notes: { contains: 'Hisaby POS' },
      },
      select: { id: true, number: true, status: true },
    });
    if (!inv) throw new NotFoundException('POS sale not found');

    await this.audit.log({
      companyId,
      userId: actor.sub,
      action: POS_REPRINT_ACTION,
      entity: 'Invoice',
      entityId: inv.id,
      newValues: {
        number: inv.number,
        status: inv.status,
        variant: variant === 'GIFT' ? 'GIFT' : 'STANDARD',
      },
    });

    const reprintCount = await this.prisma.auditLog.count({
      where: {
        companyId,
        entity: 'Invoice',
        entityId: inv.id,
        action: POS_REPRINT_ACTION,
      },
    });

    return {
      id: inv.id,
      number: inv.number,
      reprintCount,
      variant: variant === 'GIFT' ? 'GIFT' : 'STANDARD',
    };
  }

  async getReprintCounts(
    companyId: string,
    invoiceIds: string[],
  ): Promise<Record<string, number>> {
    if (!invoiceIds.length) return {};
    const rows = await this.prisma.auditLog.groupBy({
      by: ['entityId'],
      where: {
        companyId,
        entity: 'Invoice',
        action: POS_REPRINT_ACTION,
        entityId: { in: invoiceIds },
      },
      _count: { _all: true },
    });
    const map: Record<string, number> = {};
    for (const r of rows) {
      if (r.entityId) map[r.entityId] = r._count._all;
    }
    return map;
  }

  async openShift(companyId: string, actor: TokenPayload, dto: OpenPosShiftDto) {
    const resolved = await this.resolveSaleWarehouse(companyId, actor, {
      warehouseId: dto.warehouseId,
      deferredFulfillment: false,
    });
    const warehouseId = resolved.warehouseId || null;
    const existing = await this.findOpenShift(companyId, warehouseId);
    if (existing) {
      throw new BadRequestException(
        warehouseId
          ? 'This warehouse already has an open shift — close it first'
          : 'An open shift already exists for the default drawer — close it first',
      );
    }
    if (warehouseId) {
      const wh = await this.prisma.warehouse.findFirst({
        where: { id: warehouseId, companyId, isActive: true },
      });
      if (!wh) throw new BadRequestException('Warehouse not found');
    }
    const openingFloat = Number(
      dto.openingCash != null ? dto.openingCash : dto.openingFloat ?? 0,
    );
    const shift = await this.prisma.posShift.create({
      data: {
        companyId,
        openedById: actor.sub,
        warehouseId,
        openingFloat,
        notes: dto.notes?.trim() || null,
        status: 'OPEN',
      },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
    const whLabel = shift.warehouse
      ? `${shift.warehouse.code || ''} ${shift.warehouse.name || ''}`.trim()
      : 'default';
    const staffNotify = await this.notifyStaffWhatsAppAlert(companyId, [
      `فتح وردية · ${whLabel}`,
      `Shift opened · ${whLabel}`,
      `بواسطة / by: ${shift.openedBy?.name || shift.openedBy?.email || actor.email}`,
      `افتتاح / float: ${openingFloat.toFixed(3)}`,
    ]);
    return { shift, staffNotify };
  }

  async closeShift(
    companyId: string,
    actor: TokenPayload,
    dto: ClosePosShiftDto & { warehouseId?: string },
  ) {
    const resolved = await this.resolveSaleWarehouse(companyId, actor, {
      warehouseId: dto.warehouseId,
      deferredFulfillment: false,
    });
    const shiftWarehouseId = this.canSwitchWarehouseFreely(actor.role)
      ? dto.warehouseId || null
      : resolved.homeWarehouseId;
    const shift = await this.findOpenShift(companyId, shiftWarehouseId);
    if (!shift) throw new BadRequestException('No open shift to close');
    const closedAt = new Date();
    const closingCash = Number(dto.closingCash);
    const notes = dto.notes?.trim()
      ? [shift.notes, dto.notes.trim()].filter(Boolean).join('\n')
      : shift.notes;

    const zReport = await this.buildZReport(
      companyId,
      shift.id,
      shift.openedAt,
      closedAt,
      Number(shift.openingFloat),
      closingCash,
    );

    const expectedCash = Number(zReport.expectedCash ?? 0);
    const variance = Math.abs(closingCash - expectedCash);
    const limit = await this.dualControl.getShiftVarianceLimit(companyId);
    if (variance > limit) {
      await this.dualControl.assertApproved(
        companyId,
        actor,
        'SHIFT_CLOSE_VARIANCE',
        dto.approval,
      );
    }

    const updated = await this.prisma.posShift.update({
      where: { id: shift.id },
      data: {
        status: 'CLOSED',
        closedById: actor.sub,
        closedAt,
        closingCash,
        notes,
        closingDenominationJson: dto.denominationCounts
          ? (dto.denominationCounts as Prisma.InputJsonValue)
          : undefined,
        zReportJson: {
          ...zReport,
          denominationCounts: dto.denominationCounts || null,
        } as unknown as Prisma.InputJsonValue,
      },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    const zEmail = await this.emailZReportBestEffort(companyId, updated, {
      ...zReport,
      denominationCounts: dto.denominationCounts || null,
    });

    const whLabel = updated.warehouse
      ? `${updated.warehouse.code || ''} ${updated.warehouse.name || ''}`.trim()
      : 'default';
    const staffNotify = await this.notifyStaffWhatsAppAlert(companyId, [
      `إغلاق وردية · ${whLabel}`,
      `Shift closed · ${whLabel}`,
      `بواسطة / by: ${updated.closedBy?.name || updated.closedBy?.email || actor.email}`,
      `نقد متوقع / expected: ${expectedCash.toFixed(3)} · إغلاق / counted: ${closingCash.toFixed(3)}`,
      `فرق / variance: ${(closingCash - expectedCash).toFixed(3)}`,
    ]);

    return {
      shift: updated,
      zReport: { ...zReport, denominationCounts: dto.denominationCounts || null },
      zEmail,
      staffNotify,
    };
  }

  /** Best-effort WhatsApp ping to dual-control notify phones (never throws). */
  private async notifyStaffWhatsAppAlert(
    companyId: string,
    detailLines: string[],
  ): Promise<{
    status: 'ok' | 'mock' | 'fail' | 'skipped';
    targets: number;
  }> {
    try {
      if (!this.whatsapp.isConfigured()) {
        return { status: 'skipped', targets: 0 };
      }
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          phone: true,
          name: true,
          country: true,
          securityConfig: true,
        },
      });
      const cfg =
        company?.securityConfig &&
        typeof company.securityConfig === 'object' &&
        !Array.isArray(company.securityConfig)
          ? (company.securityConfig as { whatsappNotifyPhones?: string[] })
          : {};
      const dial = dialCodeForCountry(company?.country);
      const targets = new Set<string>();
      for (const p of cfg.whatsappNotifyPhones || []) {
        const d = toE164Digits(String(p), dial);
        if (isValidMobileE164(d)) targets.add(d);
      }
      if (company?.phone) {
        const d = toE164Digits(company.phone, dial);
        if (isValidMobileE164(d)) targets.add(d);
      }
      if (!targets.size) {
        return { status: 'skipped', targets: 0 };
      }

      const body = [
        `Hisaby · ${company?.name || 'POS'}`,
        ...detailLines.filter(Boolean),
      ].join('\n');

      const results = await Promise.all(
        [...targets].map((to) => this.whatsapp.sendText(to, body)),
      );
      const anyLive = results.some((r) => r.ok && !r.mock);
      const anyMock = results.some((r) => r.ok && !!r.mock);
      const status = anyLive ? 'ok' : anyMock ? 'mock' : 'fail';
      return { status, targets: targets.size };
    } catch (err) {
      this.logger.warn(
        `Staff WhatsApp alert failed: ${err instanceof Error ? err.message : err}`,
      );
      return { status: 'fail', targets: 0 };
    }
  }

  private formatZReportPlainText(
    companyName: string,
    z: Record<string, unknown>,
    shiftMeta?: {
      warehouse?: { code?: string; name?: string } | null;
      openedBy?: { name?: string } | null;
      closedBy?: { name?: string } | null;
    },
  ): string {
    const money = (n: unknown) =>
      n == null || Number.isNaN(Number(n)) ? '—' : Number(n).toFixed(3);
    const wh = shiftMeta?.warehouse
      ? `${shiftMeta.warehouse.code || ''} ${shiftMeta.warehouse.name || ''}`.trim()
      : '';
    return [
      `Z-Report · ${companyName}`,
      wh ? `Warehouse: ${wh}` : '',
      shiftMeta?.openedBy?.name ? `Opened by: ${shiftMeta.openedBy.name}` : '',
      shiftMeta?.closedBy?.name ? `Closed by: ${shiftMeta.closedBy.name}` : '',
      new Date().toISOString(),
      '',
      `Opening: ${money(z.openingCash ?? z.openingFloat)}`,
      `Sales: ${money(z.salesTotal)} (${z.salesCount ?? 0})`,
      `Cash sales: ${money(z.cashSales)}`,
      `Card sales: ${money(z.cardSales)}`,
      `Cash in: ${money(z.cashIn)}`,
      `Cash out: ${money(z.cashOut)}`,
      `Refunds: ${money(z.refundTotal ?? z.refundsTotal)}`,
      `Voids: ${money(z.voidedTotal ?? z.voidsTotal)}`,
      `Expected cash: ${money(z.expectedCash)}`,
      `Closing cash: ${money(z.closingCash)}`,
      z.denominationCounts && typeof z.denominationCounts === 'object'
        ? `Till count: ${Object.entries(z.denominationCounts as Record<string, number>)
            .filter(([, c]) => Number(c) > 0)
            .map(([face, c]) => `${c}×${face}`)
            .join(', ') || '—'}`
        : '',
      `Variance: ${money(z.variance)}`,
      z.varianceStatus ? `Variance status: ${z.varianceStatus}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  /** Best-effort — never throws / never blocks shift close. */
  private async emailZReportBestEffort(
    companyId: string,
    shift: {
      id: string;
      warehouse?: { code?: string; name?: string } | null;
      openedBy?: { name?: string } | null;
      closedBy?: { name?: string } | null;
    },
    zReport: Record<string, unknown>,
  ): Promise<{
    sent: number;
    mocked: number;
    skipped: boolean;
    error?: string;
  }> {
    try {
      const settings = await this.dualControl.getZReportEmailSettings(companyId);
      if (!settings.enabled) {
        return { sent: 0, mocked: 0, skipped: true };
      }
      if (!this.emailNotify.isConfigured()) {
        return { sent: 0, mocked: 0, skipped: true, error: 'Email not configured' };
      }
      const company = await this.prisma.company.findUnique({
        where: { id: companyId },
        select: { name: true },
      });
      const text = this.formatZReportPlainText(
        company?.name || 'Hisaby POS',
        zReport,
        shift,
      );
      const subject = `Z-Report · ${company?.name || 'Hisaby'} · ${shift.id.slice(0, 8)}`;
      let sent = 0;
      let mocked = 0;
      for (const to of settings.emails) {
        const res = await this.emailNotify.sendText({ to, subject, text });
        if (res.ok && res.mock) mocked += 1;
        else if (res.ok) sent += 1;
        else {
          this.logger.warn(`Z-report email to ${to} failed: ${res.error || 'unknown'}`);
        }
      }
      return { sent, mocked, skipped: false };
    } catch (err) {
      this.logger.warn(
        `Z-report email failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return {
        sent: 0,
        mocked: 0,
        skipped: false,
        error: err instanceof Error ? err.message : 'email failed',
      };
    }
  }

  async getZReport(companyId: string, shiftId: string) {
    const shift = await this.prisma.posShift.findFirst({
      where: { id: shiftId, companyId },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.zReportJson && shift.status === 'CLOSED') {
      return { shift, zReport: shift.zReportJson };
    }
    const zReport = await this.buildZReport(
      companyId,
      shift.id,
      shift.openedAt,
      shift.closedAt || new Date(),
      Number(shift.openingFloat),
      shift.closingCash != null ? Number(shift.closingCash) : undefined,
    );
    return { shift, zReport };
  }

  async analyzeShiftAnomalies(companyId: string, shiftId: string) {
    const shift = await this.prisma.posShift.findFirst({
      where: { id: shiftId, companyId },
    });
    if (!shift) throw new NotFoundException('Shift not found');

    const z = await this.buildZReport(
      companyId,
      shift.id,
      shift.openedAt,
      shift.closedAt || new Date(),
      Number(shift.openingFloat),
      shift.closingCash != null ? Number(shift.closingCash) : undefined,
    );

    const variance = z.variance;
    const cashSales = z.cashSales;
    const cashOut = z.cashOut;
    const salesTotal = z.salesTotal;
    const voidsCount = z.voidsCount;
    const refundsCount = z.refundsCount;
    const refundsTotal = z.refundsTotal;
    const salesCount = z.salesCount;
    const commissionCashOut = z.commissionCashOut;
    const varianceStatus = z.varianceStatus;

    const limit = await this.dualControl.getShiftVarianceLimit(companyId);

    type Finding = {
      id: string;
      severity: 'low' | 'medium' | 'high';
      messageAr: string;
      messageEn: string;
    };
    const findings: Finding[] = [];

    if (variance != null && Math.abs(variance) > limit) {
      findings.push({
        id: 'variance-over-limit',
        severity: 'high',
        messageAr: `فارق النقد ${variance.toFixed(3)} يتجاوز الحد المسموح ${limit.toFixed(3)} (${varianceStatus || '—'})`,
        messageEn: `Cash variance ${variance.toFixed(3)} exceeds limit ${limit.toFixed(3)} (${varianceStatus || '—'})`,
      });
    }

    if (voidsCount > 3 || (salesCount > 0 && voidsCount / salesCount > 0.1)) {
      findings.push({
        id: 'high-voids',
        severity: 'medium',
        messageAr: `إلغاءات مرتفعة: ${voidsCount} من ${salesCount} عملية`,
        messageEn: `Elevated voids: ${voidsCount} of ${salesCount} sales`,
      });
    }

    if (cashSales > 0 && cashOut > cashSales * 0.3) {
      findings.push({
        id: 'high-cash-out',
        severity: 'medium',
        messageAr: `إخراج نقد (${cashOut.toFixed(3)}) يتجاوز 30% من المبيعات النقدية (${cashSales.toFixed(3)})`,
        messageEn: `Cash out (${cashOut.toFixed(3)}) exceeds 30% of cash sales (${cashSales.toFixed(3)})`,
      });
    }

    const from = shift.openedAt;
    const to = shift.closedAt || new Date();
    const payouts = await this.prisma.cashierCommissionLedger.findMany({
      where: {
        companyId,
        type: 'PAYOUT',
        createdAt: { gte: from, lte: to },
      },
      select: { amount: true },
    });
    const payoutTotal = payouts.reduce((s, p) => s + Number(p.amount), 0);
    if (payoutTotal > 0.005 && commissionCashOut + 0.005 < payoutTotal) {
      findings.push({
        id: 'commission-without-drawer-out',
        severity: 'medium',
        messageAr: `صرف عمولة ${payoutTotal.toFixed(3)} بدون إخراج صندوق مطابق (${commissionCashOut.toFixed(3)})`,
        messageEn: `Commission payout ${payoutTotal.toFixed(3)} without matching drawer cash-out (${commissionCashOut.toFixed(3)})`,
      });
    }

    if (
      refundsCount >= 5 ||
      (salesTotal > 0 && refundsTotal / salesTotal > 0.15)
    ) {
      findings.push({
        id: 'many-refunds',
        severity:
          refundsCount >= 8 || refundsTotal / Math.max(salesTotal, 1) > 0.25
            ? 'medium'
            : 'low',
        messageAr: `استردادات كثيرة: ${refundsCount} بقيمة ${refundsTotal.toFixed(3)}`,
        messageEn: `Many refunds: ${refundsCount} totaling ${refundsTotal.toFixed(3)}`,
      });
    }

    const severityWeight = { low: 0.12, medium: 0.28, high: 0.45 };
    const score = Math.min(
      1,
      findings.reduce((s, f) => s + severityWeight[f.severity], 0),
    );
    const overallRisk =
      score >= 0.5 ? 'high' : score >= 0.25 ? 'medium' : findings.length ? 'low' : 'none';

    let llmNote: string | null = null;
    const llmKey = process.env.OPENAI_API_KEY || process.env.AI_LLM_API_KEY;
    if (llmKey && findings.length > 0) {
      try {
        const base =
          process.env.AI_LLM_BASE_URL?.replace(/\/$/, '') ||
          'https://api.openai.com/v1';
        const model = process.env.AI_LLM_MODEL || 'gpt-4o-mini';
        const res = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${llmKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model,
            temperature: 0.2,
            max_tokens: 350,
            messages: [
              {
                role: 'system',
                content:
                  'You summarize POS shift anomaly findings in Arabic briefly. Never instruct auto-posting. Say human review is required.',
              },
              {
                role: 'user',
                content: JSON.stringify({
                  overallRisk,
                  variance,
                  findings: findings.map((f) => ({
                    severity: f.severity,
                    messageAr: f.messageAr,
                  })),
                }),
              },
            ],
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          llmNote = data.choices?.[0]?.message?.content?.trim() || null;
        }
      } catch {
        llmNote = null;
      }
    }

    return {
      engine: llmNote ? 'rules_v1+llm_summary' : 'rules_v1',
      shiftId: shift.id,
      status: shift.status,
      score: Number(score.toFixed(3)),
      overallRisk,
      varianceStatus,
      variance,
      shiftVarianceLimit: limit,
      findings,
      llmNote,
      summaryAr:
        findings.length === 0
          ? 'لا مؤشرات شاذة وفق القواعد الحالية'
          : `${findings.length} مؤشر — المخاطر: ${overallRisk}`,
      summaryEn:
        findings.length === 0
          ? 'No anomalies under current rules'
          : `${findings.length} finding(s) — risk: ${overallRisk}`,
    };
  }

  /**
   * Mid-shift X-report: same totals as Z for the open window until now, without closing.
   */
  async getXReport(companyId: string, shiftId: string) {
    const shift = await this.prisma.posShift.findFirst({
      where: { id: shiftId, companyId },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
    if (!shift) throw new NotFoundException('Shift not found');
    if (shift.status !== 'OPEN') {
      throw new BadRequestException('X-report is only available for an open shift');
    }
    const xReport = await this.buildZReport(
      companyId,
      shift.id,
      shift.openedAt,
      new Date(),
      Number(shift.openingFloat),
    );
    return { shift, xReport, reportType: 'X' as const };
  }

  async getCurrentXReport(companyId: string, warehouseId?: string | null) {
    const shift = await this.findOpenShift(companyId, warehouseId);
    if (!shift) throw new NotFoundException('No open shift');
    return this.getXReport(companyId, shift.id);
  }

  async listShifts(companyId: string, actor?: TokenPayload) {
    const where: Prisma.PosShiftWhereInput = { companyId };
    if (actor?.role === UserRole.CASHIER) {
      where.openedById = actor.sub;
    }
    return this.prisma.posShift.findMany({
      where,
      orderBy: { openedAt: 'desc' },
      take: 30,
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
  }

  /**
   * All warehouses' shifts for the current Asia/Muscat calendar day.
   * ADMIN/MANAGER/ACCOUNTANT see every warehouse; CASHIER sees own opened shifts only.
   */
  async getShiftsToday(companyId: string, actor: TokenPayload) {
    const from = this.startOfDayMuscat();
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Muscat',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(from);

    const where: Prisma.PosShiftWhereInput = {
      companyId,
      OR: [
        { status: 'OPEN' },
        { openedAt: { gte: from } },
        { closedAt: { gte: from } },
      ],
    };
    if (actor.role === UserRole.CASHIER) {
      where.openedById = actor.sub;
    }

    const shifts = await this.prisma.posShift.findMany({
      where,
      orderBy: { openedAt: 'asc' },
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    type WarehouseRow = {
      warehouseId: string | null;
      warehouseName: string;
      warehouseCode: string | null;
      openShift: {
        id: string;
        openedAt: Date;
        openedBy?: { id: string; name: string } | null;
      } | null;
      shifts: Array<{
        id: string;
        status: string;
        openedAt: Date;
        closedAt: Date | null;
        openedBy?: { id: string; name: string } | null;
        salesTotal: number;
        cashIn: number;
        cashOut: number;
        expectedCash: number;
        voidCount: number;
        voidedTotal: number;
      }>;
      salesTotal: number;
      cashIn: number;
      cashOut: number;
      expectedCash: number;
      voidCount: number;
      voidedTotal: number;
    };

    const byWh = new Map<string, WarehouseRow>();

    for (const shift of shifts) {
      const key = shift.warehouseId || '__default__';
      if (!byWh.has(key)) {
        byWh.set(key, {
          warehouseId: shift.warehouseId,
          warehouseName: shift.warehouse?.name || 'الصندوق الافتراضي',
          warehouseCode: shift.warehouse?.code || null,
          openShift: null,
          shifts: [],
          salesTotal: 0,
          cashIn: 0,
          cashOut: 0,
          expectedCash: 0,
          voidCount: 0,
          voidedTotal: 0,
        });
      }
      const row = byWh.get(key)!;

      let salesTotal = 0;
      let cashIn = 0;
      let cashOut = 0;
      let expectedCash = 0;
      let voidCount = 0;
      let voidedTotal = 0;

      if (shift.status === 'CLOSED' && shift.zReportJson) {
        const z = shift.zReportJson as Record<string, unknown>;
        salesTotal = Number(z.salesTotal ?? 0);
        cashIn = Number(z.cashIn ?? 0);
        cashOut = Number(z.cashOut ?? 0);
        expectedCash = Number(z.expectedCash ?? 0);
        voidCount = Number(z.voidCount ?? z.voidsCount ?? 0);
        voidedTotal = Number(z.voidedTotal ?? z.voidsTotal ?? 0);
      } else {
        const live = await this.buildZReport(
          companyId,
          shift.id,
          shift.openedAt,
          shift.closedAt || new Date(),
          Number(shift.openingFloat),
          shift.closingCash != null ? Number(shift.closingCash) : undefined,
        );
        salesTotal = live.salesTotal;
        cashIn = live.cashIn;
        cashOut = live.cashOut;
        expectedCash = live.expectedCash;
        voidCount = live.voidCount;
        voidedTotal = live.voidedTotal;
      }

      row.shifts.push({
        id: shift.id,
        status: shift.status,
        openedAt: shift.openedAt,
        closedAt: shift.closedAt,
        openedBy: shift.openedBy,
        salesTotal,
        cashIn,
        cashOut,
        expectedCash,
        voidCount,
        voidedTotal,
      });
      row.salesTotal = Number((row.salesTotal + salesTotal).toFixed(3));
      row.cashIn = Number((row.cashIn + cashIn).toFixed(3));
      row.cashOut = Number((row.cashOut + cashOut).toFixed(3));
      row.voidCount += voidCount;
      row.voidedTotal = Number((row.voidedTotal + voidedTotal).toFixed(3));
      // Expected cash is per open drawer — use open shift's expected, else sum closed
      if (shift.status === 'OPEN') {
        row.openShift = {
          id: shift.id,
          openedAt: shift.openedAt,
          openedBy: shift.openedBy,
        };
        row.expectedCash = expectedCash;
      } else if (!row.openShift) {
        row.expectedCash = Number((row.expectedCash + expectedCash).toFixed(3));
      }
    }

    const warehouses = [...byWh.values()];
    const totals = {
      salesTotal: Number(
        warehouses.reduce((s, w) => s + w.salesTotal, 0).toFixed(3),
      ),
      cashIn: Number(warehouses.reduce((s, w) => s + w.cashIn, 0).toFixed(3)),
      cashOut: Number(warehouses.reduce((s, w) => s + w.cashOut, 0).toFixed(3)),
      expectedCash: Number(
        warehouses.reduce((s, w) => s + w.expectedCash, 0).toFixed(3),
      ),
      voidCount: warehouses.reduce((s, w) => s + w.voidCount, 0),
      voidedTotal: Number(
        warehouses.reduce((s, w) => s + w.voidedTotal, 0).toFixed(3),
      ),
      openCount: warehouses.filter((w) => w.openShift).length,
      shiftCount: shifts.length,
    };

    return { date: dateStr, warehouses, totals };
  }

  private async buildZReport(
    companyId: string,
    shiftId: string,
    from: Date,
    to: Date,
    openingFloat: number,
    closingCash?: number,
  ) {
    const sales = await this.prisma.invoice.findMany({
      where: {
        companyId,
        OR: [
          { posShiftId: shiftId },
          {
            posShiftId: null,
            isCash: true,
            notes: { contains: 'Hisaby POS' },
            createdAt: { gte: from, lte: to },
            type: InvoiceType.SALES,
          },
        ],
      },
      include: { payments: true },
    });

    const refunds = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.CREDIT_NOTE,
        OR: [
          { posShiftId: shiftId },
          {
            notes: { contains: 'Hisaby POS refund' },
            createdAt: { gte: from, lte: to },
          },
        ],
      },
      include: { payments: true },
    });

    let salesTotal = 0;
    let voidsTotal = 0;
    let salesCount = 0;
    let voidsCount = 0;
    let tipsTotal = 0;
    const tipsByAssignee: Record<string, number> = {};
    const byPaymentMethod: Record<string, number> = {};

    for (const inv of sales) {
      const total = Number(inv.total);
      if (inv.status === InvoiceStatus.CANCELLED) {
        voidsTotal += total;
        voidsCount += 1;
        continue;
      }
      salesTotal += total;
      salesCount += 1;
      const fields = ((inv as { customFieldsJson?: Record<string, unknown> })
        .customFieldsJson || {}) as {
        tipAmount?: number;
        tipAssigneeId?: string;
      };
      const tipAmt = Number(fields.tipAmount || 0);
      if (tipAmt > 0.0005) {
        tipsTotal += tipAmt;
        const who = fields.tipAssigneeId?.trim() || 'UNASSIGNED';
        tipsByAssignee[who] = Number(
          ((tipsByAssignee[who] || 0) + tipAmt).toFixed(3),
        );
      }
      const pays = inv.payments || [];
      if (pays.length) {
        for (const pay of pays) {
          const method = String(pay.method || PaymentMethod.CASH);
          byPaymentMethod[method] =
            (byPaymentMethod[method] || 0) + Number(pay.amount);
        }
      } else {
        byPaymentMethod[PaymentMethod.CASH] =
          (byPaymentMethod[PaymentMethod.CASH] || 0) + total;
      }
    }

    const refundsTotal = refunds.reduce((s, r) => s + Number(r.total), 0);
    const cashRefundsTotal = refunds
      .filter((r) => {
        const method = r.payments?.[0]?.method;
        return method === PaymentMethod.CASH;
      })
      .reduce((s, r) => s + Number(r.total), 0);
    const cashSales = byPaymentMethod[PaymentMethod.CASH] || 0;
    const cardSales = byPaymentMethod[PaymentMethod.CREDIT_CARD] || 0;
    const bankSales = byPaymentMethod[PaymentMethod.BANK_TRANSFER] || 0;
    const storeCreditSales = byPaymentMethod[PaymentMethod.STORE_CREDIT] || 0;

    const movements = await this.prisma.posCashMovement.findMany({
      where: { companyId, shiftId },
      orderBy: { createdAt: 'asc' },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    let cashIn = 0;
    let cashOut = 0;
    let commissionCashOut = 0;
    for (const m of movements) {
      const amt = Number(m.amount);
      if (m.type === 'IN') cashIn += amt;
      else if (m.type === 'OUT') {
        cashOut += amt;
        const reason = String(m.reason || '');
        if (/commission/i.test(reason)) {
          commissionCashOut += amt;
        }
      }
    }
    cashIn = Number(cashIn.toFixed(3));
    cashOut = Number(cashOut.toFixed(3));
    commissionCashOut = Number(commissionCashOut.toFixed(3));

    const expectedCash = Number(
      (openingFloat + cashSales - cashRefundsTotal + cashIn - cashOut).toFixed(3),
    );
    const variance =
      closingCash != null ? Number((closingCash - expectedCash).toFixed(3)) : null;

    let varianceStatus: 'BALANCED' | 'SHORT' | 'OVER' | null = null;
    if (variance != null) {
      if (Math.abs(variance) <= 0.005) varianceStatus = 'BALANCED';
      else if (variance < 0) varianceStatus = 'SHORT';
      else varianceStatus = 'OVER';
    }

    return {
      shiftId,
      from,
      to,
      openingCash: openingFloat,
      openingFloat,
      salesCount,
      salesTotal: Number(salesTotal.toFixed(3)),
      voidsCount,
      voidsTotal: Number(voidsTotal.toFixed(3)),
      voidCount: voidsCount,
      voidedTotal: Number(voidsTotal.toFixed(3)),
      refundsCount: refunds.length,
      refundsTotal: Number(refundsTotal.toFixed(3)),
      refundCount: refunds.length,
      refundTotal: Number(refundsTotal.toFixed(3)),
      cashRefundsTotal: Number(cashRefundsTotal.toFixed(3)),
      byPaymentMethod: Object.fromEntries(
        Object.entries(byPaymentMethod).map(([k, v]) => [k, Number(v.toFixed(3))]),
      ),
      cashSales: Number(cashSales.toFixed(3)),
      cardSales: Number(cardSales.toFixed(3)),
      bankSales: Number(bankSales.toFixed(3)),
      storeCreditSales: Number(storeCreditSales.toFixed(3)),
      tipsTotal: Number(tipsTotal.toFixed(3)),
      tipsByAssignee,
      cashIn,
      cashOut,
      commissionCashOut,
      cashMovements: movements.map((m) => ({
        id: m.id,
        type: m.type,
        amount: Number(m.amount),
        reason: m.reason,
        journalId: m.journalId,
        createdAt: m.createdAt,
        createdBy: m.createdBy,
      })),
      expectedCash,
      closingCash: closingCash ?? null,
      variance,
      varianceStatus,
      formulaAr: 'افتتاح + مبيعات نقد − استرداد نقد + إدخال − إخراج',
      formulaEn: 'opening + cash sales − cash refunds + cash in − cash out',
    };
  }

  /** Partial refund: credit note + stock restore (original sale stays). */
  async refundSale(
    companyId: string,
    actor: TokenPayload,
    invoiceId: string,
    dto: RefundPosSaleDto,
  ) {
    await this.dualControl.assertApproved(companyId, actor, 'POS_REFUND', dto.approval);

    if (!dto.items?.length) {
      throw new BadRequestException('Refund items are required');
    }

    const invoice = await this.invoices.findOne(companyId, invoiceId);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot refund a voided sale');
    }
    const invoiceNotes = String(invoice.notes || '');
    if (!invoice.isCash || !invoiceNotes.includes('Hisaby POS')) {
      throw new BadRequestException('Only Hisaby POS cash sales can be refunded here');
    }
    if (invoice.type !== InvoiceType.SALES) {
      throw new BadRequestException('Only sales invoices can be refunded');
    }

    await this.periods.assertOpen(companyId, new Date());

    const marker = `Hisaby POS refund of ${invoice.number}`;
    const priorRefunds = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.CREDIT_NOTE,
        notes: { contains: marker },
        status: { not: InvoiceStatus.CANCELLED },
      },
      include: { items: true },
    });
    const alreadyByProduct = new Map<string, number>();
    for (const cn of priorRefunds) {
      for (const item of cn.items) {
        if (!item.productId) continue;
        alreadyByProduct.set(
          item.productId,
          (alreadyByProduct.get(item.productId) || 0) + Number(item.quantity),
        );
      }
    }

    const soldByProduct = new Map<
      string,
      { quantity: number; unitPrice: number; discount: number; description: string }
    >();
    for (const item of invoice.items) {
      if (!item.productId) continue;
      const prev = soldByProduct.get(item.productId);
      if (prev) {
        prev.quantity += Number(item.quantity);
      } else {
        soldByProduct.set(item.productId, {
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount || 0),
          description: item.description,
        });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const taxRate = Number(invoice.taxRate);
    const cnItems: {
      productId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
    }[] = [];

    for (const req of dto.items) {
      const sold = soldByProduct.get(req.productId);
      if (!sold) {
        throw new BadRequestException(`Product not on original sale: ${req.productId}`);
      }
      const qty = Number(req.quantity);
      const remaining = sold.quantity - (alreadyByProduct.get(req.productId) || 0);
      if (qty > remaining + 0.0005) {
        throw new BadRequestException(
          `Refund qty ${qty} exceeds remaining ${Number(remaining.toFixed(3))} for ${sold.description}`,
        );
      }
      const perUnitDiscount = sold.quantity > 0 ? sold.discount / sold.quantity : 0;
      cnItems.push({
        productId: req.productId,
        description: sold.description,
        quantity: qty,
        unitPrice: sold.unitPrice,
        discount: Number((perUnitDiscount * qty).toFixed(3)),
      });
    }

    const outMoves = await this.prisma.stockMovement.findMany({
      where: {
        reference: invoice.number,
        type: MovementType.OUT,
        product: { companyId, isTracked: true },
      },
      select: { productId: true, warehouseId: true },
    });
    const warehouseByProduct = new Map(
      outMoves.map((m) => [m.productId, m.warehouseId]),
    );

    const refundRef = `${invoice.number}-REFUND-${Date.now()}`;
    for (const item of cnItems) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, companyId },
      });
      if (!product?.isTracked) continue;
      let whId = warehouseByProduct.get(item.productId) || product.warehouseId;
      if (!whId) {
        const wh = await this.prisma.warehouse.findFirst({
          where: { companyId, isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        if (!wh) continue;
        whId = wh.id;
      }
      await this.releaseStockIn(
        companyId,
        product.id,
        item.quantity,
        whId,
        refundRef,
        `POS refund of ${invoice.number}`,
      );
    }

    const reason = dto.reason?.trim();
    const refundMethod = dto.refundMethod || 'ORIGINAL';

    const saleNotes = invoice.notes || '';
    const saleFields = (invoice.customFieldsJson || {}) as Record<string, unknown>;
    const originalMethod = invoice.payments?.[0]?.method || PaymentMethod.CASH;
    const originalWasStoreCredit =
      originalMethod === PaymentMethod.STORE_CREDIT ||
      saleNotes.includes('STORE_CREDIT') ||
      saleFields.usedStoreCredit === true;

    let paymentMethod: PaymentMethod;
    let isStoreCreditRefund = false;
    if (refundMethod === 'STORE_CREDIT') {
      paymentMethod = PaymentMethod.STORE_CREDIT;
      isStoreCreditRefund = true;
    } else if (refundMethod === 'CASH') {
      paymentMethod = PaymentMethod.CASH;
    } else if (refundMethod === 'ORIGINAL' && originalWasStoreCredit) {
      paymentMethod = PaymentMethod.STORE_CREDIT;
      isStoreCreditRefund = true;
    } else {
      // ORIGINAL: keep original method; legacy OTHER→CASH
      paymentMethod =
        originalMethod === PaymentMethod.OTHER ? PaymentMethod.CASH : originalMethod;
    }

    const notesBase = `${marker}${reason ? `: ${reason}` : ''}`;
    const notes = isStoreCreditRefund ? `${notesBase} [STORE_CREDIT]` : notesBase;

    const creditNote = await this.invoices.create(companyId, actor.sub, {
      type: InvoiceType.CREDIT_NOTE,
      contactId: invoice.contactId,
      date: today,
      dueDate: today,
      taxRate,
      notes,
      payImmediately: true,
      paymentMethod,
      items: cnItems,
    });

    try {
      await this.prisma.stockMovement.updateMany({
        where: { reference: refundRef, product: { companyId } },
        data: { reference: creditNote.number },
      });
    } catch {
      /* ignore */
    }

    if (isStoreCreditRefund) {
      const creditNoteTotal = Number(creditNote.total);
      const wallet = await this.prisma.contact.findFirst({
        where: { id: invoice.contactId!, companyId },
        select: { currentBalance: true, creditLimit: true },
      });
      const next = Number(wallet?.currentBalance || 0) + creditNoteTotal;
      const limit = Number(wallet?.creditLimit || 0);
      if (limit > 0 && next > limit + 0.001) {
        throw new BadRequestException(
          `Store credit refund would exceed credit limit ${limit.toFixed(3)}`,
        );
      }
      await this.prisma.contact.update({
        where: { id: invoice.contactId },
        data: { currentBalance: { increment: creditNoteTotal } },
      });
    }

    const openShift = await this.findOpenShift(
      companyId,
      (
        await this.prisma.posShift.findFirst({
          where: { id: invoice.posShiftId || '__none__' },
          select: { warehouseId: true },
        })
      )?.warehouseId ?? null,
    );

    try {
      await this.prisma.invoice.update({
        where: { id: creditNote.id },
        data: {
          posShiftId: openShift?.id || invoice.posShiftId || undefined,
          customFieldsJson: {
            refundOfInvoiceId: invoice.id,
            refundOfNumber: invoice.number,
            refundMethod,
          },
        },
      });
    } catch {
      /* ignore */
    }

    try {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          notes: `${notes}\n[Refunded ${creditNote.number}]`.slice(0, 4000),
        },
      });
    } catch {
      /* ignore */
    }

    const customerNotify = await this.awaitCustomerNotify(
      'refund',
      companyId,
      invoice.id,
      invoice.contactId,
      creditNote.id,
    );

    return {
      refunded: true,
      creditNote,
      originalInvoiceId: invoice.id,
      originalNumber: invoice.number,
      customerNotify: customerNotify ?? null,
    };
  }

  /**
   * Blind / no-receipt return: credit note + stock restore without linking to
   * an original sale. Always dual-control (POS_BLIND_RETURN).
   */
  async blindReturn(
    companyId: string,
    actor: TokenPayload,
    dto: BlindReturnDto,
  ) {
    await this.dualControl.assertApproved(
      companyId,
      actor,
      'POS_BLIND_RETURN',
      dto.approval,
    );

    const reason = dto.reason.trim();
    if (reason.length < 3) {
      throw new BadRequestException('Reason is required (min 3 characters)');
    }
    if (!dto.items?.length) {
      throw new BadRequestException('Return items are required');
    }

    await this.periods.assertOpen(companyId, new Date());

    const refundMethod = dto.refundMethod || 'CASH';
    if (refundMethod === 'STORE_CREDIT' && !dto.contactId) {
      throw new BadRequestException('Customer required for store-credit return');
    }

    const contact = await this.resolveSaleContact(companyId, dto.contactId);
    if (refundMethod === 'STORE_CREDIT' && contact.name === WALK_IN_NAME) {
      throw new BadRequestException('Store-credit return requires a customer');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { ftaConfig: true },
    });
    const taxCfg =
      (company?.ftaConfig as { applyVat?: boolean; vatRate?: number } | null) ||
      {};
    const taxRate =
      taxCfg.applyVat === false
        ? 0
        : typeof taxCfg.vatRate === 'number'
          ? taxCfg.vatRate
          : 5;

    const cnItems: {
      productId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
    }[] = [];

    for (const row of dto.items) {
      const product = await this.products.findOne(companyId, row.productId);
      if (!product.isActive) {
        throw new BadRequestException(`Product inactive: ${product.name}`);
      }
      const qty = Number(row.quantity);
      if (!(qty > 0.0005)) {
        throw new BadRequestException('Quantity must be greater than zero');
      }
      const unitPrice =
        row.unitPrice != null ? Number(row.unitPrice) : Number(product.salePrice);
      if (!(unitPrice >= 0)) {
        throw new BadRequestException('Invalid unit price');
      }
      cnItems.push({
        productId: product.id,
        description: product.name,
        quantity: qty,
        unitPrice,
        discount: 0,
      });
    }

    const openShift = await this.findOpenShift(
      companyId,
      dto.warehouseId || null,
    );
    const warehouseId =
      dto.warehouseId ||
      openShift?.warehouseId ||
      (
        await this.prisma.warehouse.findFirst({
          where: { companyId, isActive: true },
          orderBy: { createdAt: 'asc' },
        })
      )?.id ||
      null;

    const today = new Date().toISOString().slice(0, 10);
    const refundRef = `POS-BLIND-${Date.now()}`;
    for (const item of cnItems) {
      const product = await this.prisma.product.findFirst({
        where: { id: item.productId, companyId },
      });
      if (!product?.isTracked || !warehouseId) continue;
      await this.releaseStockIn(
        companyId,
        product.id,
        item.quantity,
        warehouseId,
        refundRef,
        `POS blind return: ${reason}`,
      );
    }

    const paymentMethod =
      refundMethod === 'STORE_CREDIT'
        ? PaymentMethod.STORE_CREDIT
        : PaymentMethod.CASH;
    const notes = `Hisaby POS blind return: ${reason}${
      refundMethod === 'STORE_CREDIT' ? ' [STORE_CREDIT]' : ''
    }`;

    const creditNote = await this.invoices.create(companyId, actor.sub, {
      type: InvoiceType.CREDIT_NOTE,
      contactId: contact.id,
      date: today,
      dueDate: today,
      taxRate,
      notes,
      payImmediately: true,
      paymentMethod,
      items: cnItems,
    });

    if (refundMethod === 'STORE_CREDIT') {
      const creditNoteTotal = Number(creditNote.total);
      const wallet = await this.prisma.contact.findFirst({
        where: { id: contact.id, companyId },
        select: { currentBalance: true, creditLimit: true },
      });
      const next = Number(wallet?.currentBalance || 0) + creditNoteTotal;
      const limit = Number(wallet?.creditLimit || 0);
      if (limit > 0 && next > limit + 0.001) {
        throw new BadRequestException(
          `Store credit return would exceed credit limit ${limit.toFixed(3)}`,
        );
      }
      await this.prisma.contact.update({
        where: { id: contact.id },
        data: { currentBalance: { increment: creditNoteTotal } },
      });
    }

    try {
      await this.prisma.invoice.update({
        where: { id: creditNote.id },
        data: {
          posShiftId: openShift?.id || undefined,
          customFieldsJson: {
            blindReturn: true,
            refundMethod,
            reason,
          },
        },
      });
    } catch {
      /* ignore */
    }

    const customerNotify = await this.awaitCustomerNotify(
      'blind_return',
      companyId,
      creditNote.id,
      contact.id,
    );

    return {
      refunded: true,
      blind: true,
      creditNote,
      customerNotify: customerNotify ?? null,
    };
  }

  /** Lookup a company Hisaby POS cash sale by invoice number (for refund-by-receipt). */
  async findSaleByNumber(companyId: string, number?: string) {
    const trimmed = String(number || '').trim();
    if (!trimmed) {
      throw new BadRequestException('Receipt number is required');
    }
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        companyId,
        number: { equals: trimmed, mode: 'insensitive' },
        type: InvoiceType.SALES,
        isCash: true,
        notes: { contains: 'Hisaby POS' },
        status: { not: InvoiceStatus.CANCELLED },
      },
      include: {
        contact: true,
        items: { include: { product: true } },
        payments: true,
      },
    });
    if (!invoice) {
      throw new NotFoundException('Receipt not found');
    }
    if (!String(invoice.notes || '').includes('Hisaby POS')) {
      throw new NotFoundException('Receipt not found');
    }
    return invoice;
  }
}
