import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  Prisma,
  RestoOrderItemStatus,
  RestoOrderStatus,
  RestoTableStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddRestoOrderItemDto,
  CreateRestoTableDto,
  CreateRestoZoneDto,
  OpenRestoOrderDto,
  UpdateRestoOrderItemDto,
} from './dto/resto.dto';

const ACTIVE_ORDER: RestoOrderStatus[] = [
  RestoOrderStatus.OPEN,
  RestoOrderStatus.SENT,
  RestoOrderStatus.PARTIAL,
  RestoOrderStatus.READY,
];

const KITCHEN_ITEM: RestoOrderItemStatus[] = [
  RestoOrderItemStatus.SENT,
  RestoOrderItemStatus.PREPARING,
  RestoOrderItemStatus.READY,
];

@Injectable()
export class RestoService {
  constructor(private readonly prisma: PrismaService) {}

  private hashKey(secret: string) {
    return createHash('sha256').update(secret).digest('hex');
  }

  private decimal(n: number | string | Prisma.Decimal) {
    return new Prisma.Decimal(n);
  }

  async getLinkStatus(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        restoLinkedAt: true,
        restoIntegrationKeyPrefix: true,
        posLinkedAt: true,
      },
    });
    if (!company) throw new NotFoundException('Company not found');
    return {
      linked: !!company.restoLinkedAt,
      companyId: company.id,
      companyName: company.name,
      keyPrefix: company.restoIntegrationKeyPrefix,
      posLinked: !!company.posLinkedAt,
      apps: { accounting: true, pos: true, resto: true },
    };
  }

  /** Same-login SSO: mark Accounting/POS ↔ Restaurants as linked */
  async activateLink(companyId: string) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { restoLinkedAt: new Date() },
      select: { id: true, name: true, restoLinkedAt: true },
    });
    return {
      linked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.restoLinkedAt,
    };
  }

  async deactivateLink(companyId: string) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        restoLinkedAt: null,
        restoIntegrationKeyHash: null,
        restoIntegrationKeyPrefix: null,
      },
      select: { id: true, name: true, restoLinkedAt: true },
    });
    return {
      linked: false,
      companyId: company.id,
      companyName: company.name,
      linkedAt: null,
    };
  }

  async generateIntegrationKey(companyId: string) {
    const secret = `hresto_${randomBytes(24).toString('hex')}`;
    const prefix = secret.slice(0, 12);
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        restoIntegrationKeyHash: this.hashKey(secret),
        restoIntegrationKeyPrefix: prefix,
        restoLinkedAt: new Date(),
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
    if (!trimmed.startsWith('hresto_')) {
      throw new BadRequestException('Invalid restaurant integration key');
    }
    const hash = this.hashKey(trimmed);
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, restoIntegrationKeyHash: hash },
      select: { id: true },
    });
    if (!company) {
      throw new BadRequestException(
        'Integration key does not match this company — generate a key while signed into the same company, or use shared login to link',
      );
    }
    return this.activateLink(companyId);
  }

  /** Active products as restaurant menu (shared inventory) */
  async getMenu(companyId: string, q?: string) {
    const query = q?.trim();
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        isActive: true,
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { nameEn: { contains: query, mode: 'insensitive' } },
                { sku: { contains: query, mode: 'insensitive' } },
                { barcode: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        sku: true,
        barcode: true,
        salePrice: true,
        unit: true,
        category: true,
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
    return {
      items: products.map((p) => ({
        id: p.id,
        name: p.name,
        nameEn: p.nameEn,
        sku: p.sku,
        barcode: p.barcode,
        price: p.salePrice,
        unit: p.unit,
        category: p.category,
      })),
      count: products.length,
    };
  }

  /** Ensure at least one kitchen station exists */
  private async ensureStation(companyId: string) {
    const existing = await this.prisma.restoStation.findFirst({
      where: { companyId, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    if (existing) return existing;
    return this.prisma.restoStation.create({
      data: {
        companyId,
        name: 'المطبخ',
        nameEn: 'Kitchen',
        sortOrder: 0,
      },
    });
  }

  /**
   * Seed a starter floor: Main hall + N tables + kitchen station.
   * Idempotent when tables already exist.
   */
  async seedFloor(companyId: string, tableCount = 8) {
    await this.ensureStation(companyId);
    const existing = await this.prisma.restoTable.count({ where: { companyId } });
    if (existing > 0) {
      return this.getFloor(companyId);
    }
    const n = Math.min(40, Math.max(1, tableCount));
    const zone = await this.prisma.restoZone.create({
      data: {
        companyId,
        name: 'الصالة الرئيسية',
        nameEn: 'Main hall',
        sortOrder: 0,
      },
    });
    await this.prisma.restoTable.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        companyId,
        zoneId: zone.id,
        code: `T${i + 1}`,
        name: `طاولة ${i + 1}`,
        seats: i < 4 ? 2 : 4,
        sortOrder: i,
        status: RestoTableStatus.FREE,
      })),
    });
    return this.getFloor(companyId);
  }

  async createZone(companyId: string, dto: CreateRestoZoneDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Zone name required');
    return this.prisma.restoZone.create({
      data: {
        companyId,
        name,
        nameEn: dto.nameEn?.trim() || null,
        sortOrder: 0,
      },
    });
  }

  async createTable(companyId: string, dto: CreateRestoTableDto) {
    const zone = await this.prisma.restoZone.findFirst({
      where: { id: dto.zoneId, companyId },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    const code = dto.code.trim().toUpperCase();
    if (!code) throw new BadRequestException('Table code required');
    try {
      return await this.prisma.restoTable.create({
        data: {
          companyId,
          zoneId: zone.id,
          code,
          name: dto.name?.trim() || null,
          seats: dto.seats ?? 4,
          status: RestoTableStatus.FREE,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new BadRequestException('Table code already exists');
      }
      throw e;
    }
  }

  async getFloor(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, restoLinkedAt: true },
    });
    if (!company) throw new NotFoundException('Company not found');

    const zones = await this.prisma.restoZone.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        tables: {
          orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
          include: {
            orders: {
              where: { status: { in: ACTIVE_ORDER } },
              orderBy: { createdAt: 'desc' },
              take: 1,
              include: {
                items: {
                  where: { status: { not: RestoOrderItemStatus.CANCELLED } },
                  select: {
                    id: true,
                    qty: true,
                    unitPrice: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const mappedZones = zones.map((z) => ({
      id: z.id,
      name: z.name,
      nameEn: z.nameEn,
      tables: z.tables.map((t) => {
        const open = t.orders[0] ?? null;
        const items = open?.items ?? [];
        const total = items.reduce(
          (sum, it) => sum + Number(it.qty) * Number(it.unitPrice),
          0,
        );
        return {
          id: t.id,
          code: t.code,
          name: t.name,
          seats: t.seats,
          status: open ? RestoTableStatus.OCCUPIED : t.status,
          openOrder: open
            ? {
                id: open.id,
                number: open.number,
                status: open.status,
                guests: open.guests,
                itemCount: items.length,
                total,
                createdAt: open.createdAt,
              }
            : null,
        };
      }),
    }));

    const tables = mappedZones.flatMap((z) =>
      z.tables.map((t) => ({ ...t, zoneId: z.id, zoneName: z.name })),
    );

    return {
      companyId: company.id,
      companyName: company.name,
      linked: !!company.restoLinkedAt,
      zones: mappedZones,
      tables,
      empty: tables.length === 0,
      needsSetup: tables.length === 0,
    };
  }

  private async nextOrderNumber(companyId: string) {
    const day = new Date();
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const d = String(day.getDate()).padStart(2, '0');
    const prefix = `R-${y}${m}${d}-`;
    const last = await this.prisma.restoOrder.findFirst({
      where: { companyId, number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    let seq = 1;
    if (last?.number) {
      const part = last.number.slice(prefix.length);
      const n = parseInt(part, 10);
      if (!Number.isNaN(n)) seq = n + 1;
    }
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private mapOrder(order: {
    id: string;
    number: string;
    status: RestoOrderStatus;
    channel: string;
    guests: number;
    notes: string | null;
    tableId: string | null;
    sentAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    table?: { id: string; code: string; name: string | null } | null;
    items: Array<{
      id: string;
      productId: string | null;
      stationId: string | null;
      name: string;
      qty: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      notes: string | null;
      status: RestoOrderItemStatus;
      sentAt: Date | null;
      readyAt: Date | null;
      station?: { id: string; name: string; nameEn: string | null } | null;
    }>;
  }) {
    const items = order.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      stationId: it.stationId,
      stationName: it.station?.name ?? null,
      name: it.name,
      qty: Number(it.qty),
      unitPrice: Number(it.unitPrice),
      lineTotal: Number(it.qty) * Number(it.unitPrice),
      notes: it.notes,
      status: it.status,
      sentAt: it.sentAt,
      readyAt: it.readyAt,
    }));
    const subtotal = items.reduce((s, it) => s + it.lineTotal, 0);
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      channel: order.channel,
      guests: order.guests,
      notes: order.notes,
      tableId: order.tableId,
      table: order.table
        ? {
            id: order.table.id,
            code: order.table.code,
            name: order.table.name,
          }
        : null,
      sentAt: order.sentAt,
      closedAt: order.closedAt,
      createdAt: order.createdAt,
      items,
      subtotal,
      total: subtotal,
      itemCount: items.length,
    };
  }

  private async loadOrder(companyId: string, orderId: string) {
    const order = await this.prisma.restoOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        table: { select: { id: true, code: true, name: true } },
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            station: { select: { id: true, name: true, nameEn: true } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  async getOrder(companyId: string, orderId: string) {
    return this.mapOrder(await this.loadOrder(companyId, orderId));
  }

  async openOrder(companyId: string, userId: string, dto: OpenRestoOrderDto) {
    const table = await this.prisma.restoTable.findFirst({
      where: { id: dto.tableId, companyId },
    });
    if (!table) throw new NotFoundException('Table not found');

    const existing = await this.prisma.restoOrder.findFirst({
      where: {
        companyId,
        tableId: table.id,
        status: { in: ACTIVE_ORDER },
      },
    });
    if (existing) {
      return this.getOrder(companyId, existing.id);
    }

    const number = await this.nextOrderNumber(companyId);
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.restoOrder.create({
        data: {
          companyId,
          tableId: table.id,
          number,
          guests: dto.guests ?? 1,
          notes: dto.notes?.trim() || null,
          openedById: userId,
          status: RestoOrderStatus.OPEN,
          channel: 'DINE_IN',
        },
      });
      await tx.restoTable.update({
        where: { id: table.id },
        data: { status: RestoTableStatus.OCCUPIED },
      });
      return created;
    });
    return this.getOrder(companyId, order.id);
  }

  async addItem(companyId: string, orderId: string, dto: AddRestoOrderItemDto) {
    const order = await this.prisma.restoOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (
      order.status === RestoOrderStatus.CLOSED ||
      order.status === RestoOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order is closed');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, companyId, isActive: true },
      select: { id: true, name: true, salePrice: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const station = await this.ensureStation(companyId);
    const qty = dto.qty ?? 1;

    await this.prisma.restoOrderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        stationId: station.id,
        name: product.name,
        qty: this.decimal(qty),
        unitPrice: this.decimal(product.salePrice),
        notes: dto.notes?.trim() || null,
        status: RestoOrderItemStatus.PENDING,
      },
    });

    return this.getOrder(companyId, order.id);
  }

  async updateItem(
    companyId: string,
    orderId: string,
    itemId: string,
    dto: UpdateRestoOrderItemDto,
  ) {
    const item = await this.prisma.restoOrderItem.findFirst({
      where: { id: itemId, orderId, order: { companyId } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status !== RestoOrderItemStatus.PENDING) {
      throw new BadRequestException('Only pending items can be edited');
    }
    await this.prisma.restoOrderItem.update({
      where: { id: item.id },
      data: {
        ...(dto.qty !== undefined ? { qty: this.decimal(dto.qty) } : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
      },
    });
    return this.getOrder(companyId, orderId);
  }

  async removeItem(companyId: string, orderId: string, itemId: string) {
    const item = await this.prisma.restoOrderItem.findFirst({
      where: { id: itemId, orderId, order: { companyId } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (
      item.status !== RestoOrderItemStatus.PENDING &&
      item.status !== RestoOrderItemStatus.CANCELLED
    ) {
      throw new BadRequestException('Only pending items can be removed');
    }
    await this.prisma.restoOrderItem.delete({ where: { id: item.id } });
    await this.refreshOrderStatus(companyId, orderId);
    return this.getOrder(companyId, orderId);
  }

  /** Fire pending items to kitchen (KDS) */
  async sendToKitchen(companyId: string, orderId: string) {
    const order = await this.loadOrder(companyId, orderId);
    if (
      order.status === RestoOrderStatus.CLOSED ||
      order.status === RestoOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order is closed');
    }
    const pending = order.items.filter(
      (i) => i.status === RestoOrderItemStatus.PENDING,
    );
    if (pending.length === 0) {
      throw new BadRequestException('No pending items to send');
    }
    const now = new Date();
    await this.prisma.restoOrderItem.updateMany({
      where: {
        orderId,
        status: RestoOrderItemStatus.PENDING,
      },
      data: {
        status: RestoOrderItemStatus.SENT,
        sentAt: now,
      },
    });
    await this.prisma.restoOrder.update({
      where: { id: orderId },
      data: {
        sentAt: order.sentAt ?? now,
        status: RestoOrderStatus.SENT,
      },
    });
    await this.refreshOrderStatus(companyId, orderId);
    return this.getOrder(companyId, orderId);
  }

  private async refreshOrderStatus(companyId: string, orderId: string) {
    const order = await this.prisma.restoOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        items: {
          where: { status: { not: RestoOrderItemStatus.CANCELLED } },
        },
      },
    });
    if (!order || order.status === RestoOrderStatus.CLOSED) return;

    if (order.items.length === 0) {
      await this.prisma.restoOrder.update({
        where: { id: orderId },
        data: { status: RestoOrderStatus.OPEN },
      });
      return;
    }

    const statuses = order.items.map((i) => i.status);
    const allReadyOrServed = statuses.every(
      (s) =>
        s === RestoOrderItemStatus.READY ||
        s === RestoOrderItemStatus.SERVED,
    );
    const anyKitchen = statuses.some((s) => KITCHEN_ITEM.includes(s));
    const anyPending = statuses.some((s) => s === RestoOrderItemStatus.PENDING);
    const anyPreparing = statuses.some(
      (s) =>
        s === RestoOrderItemStatus.PREPARING ||
        s === RestoOrderItemStatus.SENT,
    );

    let next: RestoOrderStatus = order.status;
    if (allReadyOrServed && anyKitchen) {
      next = RestoOrderStatus.READY;
    } else if (anyPreparing && anyPending) {
      next = RestoOrderStatus.PARTIAL;
    } else if (anyPreparing) {
      next = RestoOrderStatus.SENT;
    } else if (anyPending) {
      next = RestoOrderStatus.OPEN;
    }

    if (next !== order.status) {
      await this.prisma.restoOrder.update({
        where: { id: orderId },
        data: { status: next },
      });
    }
  }

  async getKitchenQueue(companyId: string) {
    await this.ensureStation(companyId);
    const items = await this.prisma.restoOrderItem.findMany({
      where: {
        status: {
          in: [
            RestoOrderItemStatus.SENT,
            RestoOrderItemStatus.PREPARING,
            RestoOrderItemStatus.READY,
          ],
        },
        order: {
          companyId,
          status: { in: ACTIVE_ORDER },
        },
      },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        order: {
          select: {
            id: true,
            number: true,
            table: { select: { id: true, code: true, name: true } },
          },
        },
      },
      take: 200,
    });

    return {
      count: items.length,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        qty: Number(it.qty),
        notes: it.notes,
        status: it.status,
        sentAt: it.sentAt,
        orderId: it.order.id,
        orderNumber: it.order.number,
        table: it.order.table
          ? {
              id: it.order.table.id,
              code: it.order.table.code,
              name: it.order.table.name,
            }
          : null,
      })),
    };
  }

  async setKitchenItemStatus(
    companyId: string,
    itemId: string,
    status: 'PREPARING' | 'READY' | 'SERVED',
  ) {
    const item = await this.prisma.restoOrderItem.findFirst({
      where: { id: itemId, order: { companyId } },
    });
    if (!item) throw new NotFoundException('Item not found');

    const data: Prisma.RestoOrderItemUpdateInput = {
      status: status as RestoOrderItemStatus,
    };
    if (status === 'READY' || status === 'SERVED') {
      data.readyAt = item.readyAt ?? new Date();
    }
    await this.prisma.restoOrderItem.update({
      where: { id: item.id },
      data,
    });
    await this.refreshOrderStatus(companyId, item.orderId);
    return this.getOrder(companyId, item.orderId);
  }

  /** Soft close — frees table. POS invoice close arrives in R4. */
  async closeOrder(companyId: string, orderId: string) {
    const order = await this.loadOrder(companyId, orderId);
    if (order.status === RestoOrderStatus.CLOSED) {
      return this.mapOrder(order);
    }
    const pendingKitchen = order.items.some(
      (i) =>
        i.status === RestoOrderItemStatus.SENT ||
        i.status === RestoOrderItemStatus.PREPARING,
    );
    if (pendingKitchen) {
      throw new BadRequestException(
        'Kitchen still has open items — mark ready/served or cancel first',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.restoOrder.update({
        where: { id: orderId },
        data: {
          status: RestoOrderStatus.CLOSED,
          closedAt: new Date(),
        },
      });
      if (order.tableId) {
        await tx.restoTable.update({
          where: { id: order.tableId },
          data: { status: RestoTableStatus.FREE },
        });
      }
    });
    return this.getOrder(companyId, orderId);
  }

  async cancelOrder(companyId: string, orderId: string) {
    const order = await this.loadOrder(companyId, orderId);
    if (order.status === RestoOrderStatus.CLOSED) {
      throw new BadRequestException('Order already closed');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.restoOrderItem.updateMany({
        where: {
          orderId,
          status: {
            in: [
              RestoOrderItemStatus.PENDING,
              RestoOrderItemStatus.SENT,
              RestoOrderItemStatus.PREPARING,
            ],
          },
        },
        data: { status: RestoOrderItemStatus.CANCELLED },
      });
      await tx.restoOrder.update({
        where: { id: orderId },
        data: {
          status: RestoOrderStatus.CANCELLED,
          closedAt: new Date(),
        },
      });
      if (order.tableId) {
        await tx.restoTable.update({
          where: { id: order.tableId },
          data: { status: RestoTableStatus.FREE },
        });
      }
    });
    return this.getOrder(companyId, orderId);
  }
}
