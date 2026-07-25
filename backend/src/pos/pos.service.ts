import {
  BadRequestException,
  ForbiddenException,
  Injectable,
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
import {
  CreatePosSaleDto,
  CreatePosDraftDto,
  OpenPosShiftDto,
  ClosePosShiftDto,
  RefundPosSaleDto,
  UpdatePosDraftDto,
} from './dto/pos.dto';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

const WALK_IN_NAME = 'POS Walk-in / نقدي';

@Injectable()
export class PosService {
  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
    private products: ProductsService,
    private periods: PeriodsService,
    private dualControl: DualControlService,
    private subscriptions: SubscriptionsService,
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
    const [mapped] = await this.applyWarehouseQuantity([product], warehouseId);
    return mapped;
  }

  async searchProducts(companyId: string, q: string, warehouseId?: string) {
    const term = q.trim();
    const products = !term
      ? await this.prisma.product.findMany({
          where: { companyId, isActive: true },
          take: 40,
          orderBy: { name: 'asc' },
          include: { warehouse: { select: { id: true, code: true, name: true } } },
        })
      : await this.prisma.product.findMany({
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
    return this.applyWarehouseQuantity(products, warehouseId);
  }

  async syncCatalog(companyId: string, warehouseId?: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
      take: 5000,
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        quantity: true,
        isTracked: true,
        warehouseId: true,
      },
    });
    const withStock = await this.applyWarehouseQuantity(products, warehouseId);
    return {
      warehouseId: warehouseId || null,
      syncedAt: new Date(),
      count: withStock.length,
      products: withStock,
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

      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId: whId! },
        },
        create: { productId, warehouseId: whId!, quantity: 0 },
        update: {},
      });

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
          `Insufficient stock for ${product.name} at this warehouse (requested ${qty})`,
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
    notes = 'POS sale rollback',
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.warehouseStock.upsert({
        where: {
          productId_warehouseId: { productId, warehouseId },
        },
        create: { productId, warehouseId, quantity: qty },
        update: { quantity: { increment: qty } },
      });
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
          notes,
        },
      });
    });
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
          await this.releaseStockIn(
            companyId,
            m.productId,
            Number(m.quantity),
            m.warehouseId,
            `${invoice.number}-VOID`,
            'POS sale void',
          );
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

          await this.releaseStockIn(
            companyId,
            product.id,
            Number(item.quantity),
            whId,
            `${invoice.number}-VOID`,
            'POS sale void',
          );
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
      notes.includes('STORE_CREDIT') || fields.usedStoreCredit === true;
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

    return {
      voided: true,
      invoice: cancelled,
    };
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

  async createSale(
    companyId: string,
    actor: TokenPayload,
    dto: CreatePosSaleDto,
  ) {
    await this.subscriptions.assertCanCreateInvoice(companyId);
    const userId = actor.sub;
    const contact = await this.resolveSaleContact(companyId, dto.contactId);
    const role = await this.resolveUserRole(userId, actor.role);
    const canOverridePrice =
      role === UserRole.ADMIN || role === UserRole.MANAGER;
    const today = new Date().toISOString().slice(0, 10);
    const reserveRef = `POS-TEMP-${Date.now()}`;

    const useStoreCredit = dto.useStoreCredit === true;

    if (useStoreCredit) {
      if (contact.name === WALK_IN_NAME) {
        throw new BadRequestException('Store credit requires a non-walk-in contact');
      }
    }

    const lineItems: {
      productId: string;
      description: string;
      quantity: number;
      unitPrice: number;
      discount: number;
    }[] = [];

    let hasPriceOverride = false;
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
        if (!canOverridePrice) {
          throw new ForbiddenException(
            'Only ADMIN or MANAGER can override unit price',
          );
        }
        hasPriceOverride = true;
      }
      const qty = Number(item.quantity);
      lineItems.push({
        productId: product.id,
        description: product.name,
        quantity: qty,
        unitPrice,
        discount: item.discount || 0,
      });
    }

    if (hasPriceOverride) {
      await this.dualControl.assertApproved(
        companyId,
        actor,
        'POS_PRICE_OVERRIDE',
        dto.approval,
      );
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

    if (useStoreCredit) {
      let subtotal = 0;
      for (const item of lineItems) {
        subtotal += item.unitPrice * item.quantity - item.discount;
      }
      const taxAmount = subtotal * (taxRate / 100);
      const estimatedTotal = subtotal + taxAmount;
      const currentBalance = Number(contact.currentBalance || 0);
      if (currentBalance < estimatedTotal) {
        throw new BadRequestException(
          `Insufficient store credit: balance ${currentBalance.toFixed(3)}, required ${estimatedTotal.toFixed(3)}`,
        );
      }
    }

    const openShift = await this.findOpenShift(companyId, dto.warehouseId || null);
    if ((await this.dualControl.isRequireOpenShift(companyId)) && !openShift) {
      throw new BadRequestException(
        'An open shift is required before completing a sale. Open a shift from /pos/shifts first.',
      );
    }

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

      // 2) Create paid cash invoice (attach to open shift for this warehouse)

      const paymentMethod = useStoreCredit ? PaymentMethod.OTHER : (dto.paymentMethod ?? PaymentMethod.CASH);
      const notes = useStoreCredit
        ? `[STORE_CREDIT] ${dto.notes || 'Hisaby POS sale'}`
        : (dto.notes || 'Hisaby POS sale');

      const invoice = await this.invoices.create(companyId, userId, {
        type: InvoiceType.SALES,
        contactId: contact.id,
        date: today,
        dueDate: today,
        taxRate,
        notes,
        payImmediately: true,
        paymentMethod,
        items: lineItems,
      });
      invoiceCreated = true;

      if (useStoreCredit) {
        const invoiceTotal = Number(invoice.total);
        const debited = await this.prisma.contact.updateMany({
          where: {
            id: contact.id,
            companyId,
            currentBalance: { gte: invoiceTotal },
          },
          data: { currentBalance: { decrement: invoiceTotal } },
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
            /* best-effort reverse of unpaid wallet sale */
          }
          invoiceCreated = false;
          throw new BadRequestException(
            `Insufficient store credit: required ${invoiceTotal.toFixed(3)}`,
          );
        }
        try {
          const existingFields =
            ((invoice as { customFieldsJson?: Record<string, unknown> }).customFieldsJson ||
              {}) as Record<string, unknown>;
          await this.prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              customFieldsJson: {
                ...existingFields,
                usedStoreCredit: true,
                storeCreditAmount: invoiceTotal,
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

  async listDrafts(companyId: string) {
    return this.prisma.posDraft.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async createDraft(companyId: string, userId: string, dto: CreatePosDraftDto) {
    if (!dto.lines?.length) {
      throw new BadRequestException('Draft lines are required');
    }

    const trimmedName = dto.name?.trim();
    let name = trimmedName;
    if (!name) {
      const count = await this.prisma.posDraft.count({ where: { companyId } });
      name = `Parked ${count + 1}`;
    }

    return this.prisma.posDraft.create({
      data: {
        companyId,
        createdById: userId,
        name,
        warehouseId: dto.warehouseId || null,
        contactId: dto.contactId || null,
        linesJson: dto.lines as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async updateDraftName(companyId: string, id: string, dto: UpdatePosDraftDto) {
    const existing = await this.prisma.posDraft.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Parked cart not found');
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Draft name is required');
    return this.prisma.posDraft.update({
      where: { id },
      data: { name },
    });
  }

  async deleteDraft(companyId: string, id: string) {
    const existing = await this.prisma.posDraft.findFirst({
      where: { id, companyId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Parked cart not found');
    await this.prisma.posDraft.delete({ where: { id } });
    return { deleted: true, id };
  }

  async getCurrentShift(companyId: string, warehouseId?: string | null) {
    const shift = await this.findOpenShift(companyId, warehouseId);
    if (!shift) return { shift: null };
    const live = await this.buildZReport(
      companyId,
      shift.id,
      shift.openedAt,
      new Date(),
      Number(shift.openingFloat),
    );
    return { shift, live };
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
  async getTodayStats(companyId: string, warehouseId?: string) {
    const from = this.startOfDayMuscat();
    const warehouseFilter = warehouseId
      ? { posShift: { is: { warehouseId } } }
      : {};

    const sales = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: InvoiceType.SALES,
        isCash: true,
        notes: { contains: 'Hisaby POS' },
        createdAt: { gte: from },
        ...warehouseFilter,
      },
      select: { id: true, total: true, status: true },
    });

    let salesCount = 0;
    let salesTotal = 0;
    let voidCount = 0;
    for (const inv of sales) {
      if (inv.status === InvoiceStatus.CANCELLED) {
        voidCount += 1;
        continue;
      }
      salesCount += 1;
      salesTotal += Number(inv.total);
    }

    const refundCount = await this.prisma.invoice.count({
      where: {
        companyId,
        type: InvoiceType.CREDIT_NOTE,
        notes: { contains: 'Hisaby POS refund' },
        createdAt: { gte: from },
        ...warehouseFilter,
      },
    });

    return {
      salesCount,
      salesTotal: Number(salesTotal.toFixed(3)),
      refundCount,
      voidCount,
      from,
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
      },
    });
  }

  async openShift(companyId: string, userId: string, dto: OpenPosShiftDto) {
    const warehouseId = dto.warehouseId || null;
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
        openedById: userId,
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
    return { shift };
  }

  async closeShift(
    companyId: string,
    actor: TokenPayload,
    dto: ClosePosShiftDto & { warehouseId?: string },
  ) {
    const shift = await this.findOpenShift(companyId, dto.warehouseId || null);
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
        zReportJson: zReport as unknown as Prisma.InputJsonValue,
      },
      include: {
        openedBy: { select: { id: true, name: true, email: true } },
        closedBy: { select: { id: true, name: true, email: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });

    return { shift: updated, zReport };
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

  async listShifts(companyId: string) {
    return this.prisma.posShift.findMany({
      where: { companyId },
      orderBy: { openedAt: 'desc' },
      take: 30,
      include: {
        openedBy: { select: { id: true, name: true } },
        closedBy: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
    });
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
      const method = String(inv.payments?.[0]?.method || PaymentMethod.CASH);
      byPaymentMethod[method] = (byPaymentMethod[method] || 0) + total;
    }

    const refundsTotal = refunds.reduce((s, r) => s + Number(r.total), 0);
    const cashRefundsTotal = refunds
      .filter((r) => {
        const method = r.payments?.[0]?.method;
        return method === PaymentMethod.CASH;
      })
      .reduce((s, r) => s + Number(r.total), 0);
    const cashSales = byPaymentMethod[PaymentMethod.CASH] || 0;
    const expectedCash = Number((openingFloat + cashSales - cashRefundsTotal).toFixed(3));
    const variance =
      closingCash != null ? Number((closingCash - expectedCash).toFixed(3)) : null;

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
      byPaymentMethod: Object.fromEntries(
        Object.entries(byPaymentMethod).map(([k, v]) => [k, Number(v.toFixed(3))]),
      ),
      cashSales: Number(cashSales.toFixed(3)),
      cardSales: Number((byPaymentMethod[PaymentMethod.CREDIT_CARD] || 0).toFixed(3)),
      bankSales: Number((byPaymentMethod[PaymentMethod.BANK_TRANSFER] || 0).toFixed(3)),
      expectedCash,
      closingCash: closingCash ?? null,
      variance,
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

    let paymentMethod: PaymentMethod;
    if (refundMethod === 'STORE_CREDIT') {
      paymentMethod = PaymentMethod.OTHER;
    } else if (refundMethod === 'CASH') {
      paymentMethod = PaymentMethod.CASH;
    } else {
      // ORIGINAL: use original sale payment method, but OTHER→CASH
      const originalMethod = invoice.payments?.[0]?.method || PaymentMethod.CASH;
      paymentMethod = originalMethod === PaymentMethod.OTHER ? PaymentMethod.CASH : originalMethod;
    }

    const notesBase = `${marker}${reason ? `: ${reason}` : ''}`;
    const notes = refundMethod === 'STORE_CREDIT' ? `${notesBase} [STORE_CREDIT]` : notesBase;

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

    if (refundMethod === 'STORE_CREDIT') {
      const creditNoteTotal = Number(creditNote.total);
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

    return {
      refunded: true,
      creditNote,
      originalInvoiceId: invoice.id,
      originalNumber: invoice.number,
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
