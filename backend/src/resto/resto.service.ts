import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  PaymentMethod,
  Prisma,
  RestoOrderChannel,
  RestoOrderItemStatus,
  RestoOrderStatus,
  RestoTableStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PosService } from '../pos/pos.service';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import {
  AddRestoOrderItemDto,
  CloseRestoOrderDto,
  CreateRestoReservationDto,
  CreateRestoStationDto,
  CreateRestoTableDto,
  CreateRestoZoneDto,
  OpenRestoOrderDto,
  UpdateRestoOrderDto,
  UpdateRestoOrderItemDto,
  UpsertRestoRecipeDto,
} from './dto/resto.dto';
import { productWhereForWarehouse } from '../common/warehouse-product-scope';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly pos: PosService,
  ) {}

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
        restoWarehouseId: true,
        posLinkedAt: true,
        restoWarehouse: {
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
      linked: !!company.restoLinkedAt,
      companyId: company.id,
      companyName: company.name,
      keyPrefix: company.restoIntegrationKeyPrefix,
      warehouseId: company.restoWarehouseId,
      warehouse: company.restoWarehouse,
      posLinked: !!company.posLinkedAt,
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
        restoWarehouseId: wh.id,
        restoLinkedAt: new Date(),
      },
      select: {
        id: true,
        name: true,
        restoLinkedAt: true,
        restoWarehouseId: true,
      },
    });
    return {
      linked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.restoLinkedAt,
      warehouseId: company.restoWarehouseId,
      warehouse: wh,
    };
  }

  /** Same-login SSO: mark Accounting/POS ↔ Restaurants as linked */
  async activateLink(companyId: string, warehouseId?: string) {
    if (warehouseId) {
      return this.setWarehouse(companyId, warehouseId);
    }
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: { restoLinkedAt: new Date() },
      select: {
        id: true,
        name: true,
        restoLinkedAt: true,
        restoWarehouseId: true,
        restoWarehouse: {
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
    return {
      linked: true,
      companyId: company.id,
      companyName: company.name,
      linkedAt: company.restoLinkedAt,
      warehouseId: company.restoWarehouseId,
      warehouse: company.restoWarehouse,
      needsWarehouse: !company.restoWarehouseId,
    };
  }

  async deactivateLink(companyId: string) {
    const company = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        restoLinkedAt: null,
        restoIntegrationKeyHash: null,
        restoIntegrationKeyPrefix: null,
        restoWarehouseId: null,
      },
      select: { id: true, name: true, restoLinkedAt: true },
    });
    return {
      linked: false,
      companyId: company.id,
      companyName: company.name,
      linkedAt: null,
      warehouseId: null,
    };
  }

  async generateIntegrationKey(companyId: string, warehouseId?: string) {
    if (warehouseId) {
      await this.assertCompanyWarehouse(companyId, warehouseId);
    }
    const secret = 'hresto_' + randomBytes(24).toString('hex');
    const prefix = secret.slice(0, 12);
    await this.prisma.company.update({
      where: { id: companyId },
      data: {
        restoIntegrationKeyHash: this.hashKey(secret),
        restoIntegrationKeyPrefix: prefix,
        restoLinkedAt: new Date(),
        ...(warehouseId ? { restoWarehouseId: warehouseId } : {}),
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
    return this.activateLink(companyId, warehouseId);
  }

  async resolveWarehouseId(companyId: string): Promise<string | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { restoWarehouseId: true },
    });
    return company?.restoWarehouseId ?? null;
  }

  /** Menu = products in the linked restaurant warehouse only */
  async getMenu(companyId: string, q?: string) {
    const warehouseId = await this.resolveWarehouseId(companyId);
    if (!warehouseId) {
      return {
        items: [],
        count: 0,
        warehouseId: null,
        needsWarehouse: true,
        message:
          'Select a restaurant warehouse in settings — menu shows only products in that warehouse',
      };
    }

    const products = await this.prisma.product.findMany({
      where: productWhereForWarehouse(companyId, warehouseId, q),
      select: {
        id: true,
        name: true,
        nameEn: true,
        sku: true,
        barcode: true,
        salePrice: true,
        unit: true,
        category: true,
        isTracked: true,
        images: true,
      },
      orderBy: { name: 'asc' },
      take: 500,
    });
    const routes = await this.prisma.restoProductStation.findMany({
      where: {
        companyId,
        productId: { in: products.map((p) => p.id) },
      },
      include: {
        station: { select: { id: true, name: true, nameEn: true } },
      },
    });
    const recipes = await this.prisma.restoRecipe.findMany({
      where: {
        companyId,
        productId: { in: products.map((p) => p.id) },
      },
      select: { productId: true },
    });
    const byProduct = new Map(routes.map((r) => [r.productId, r]));
    const withRecipe = new Set(recipes.map((r) => r.productId));
    return {
      items: products.map((p) => {
        const route = byProduct.get(p.id);
        return {
          id: p.id,
          name: p.name,
          nameEn: p.nameEn,
          sku: p.sku,
          barcode: p.barcode,
          price: p.salePrice,
          unit: p.unit,
          category: p.category,
          isTracked: p.isTracked,
          images: p.images || [],
          image: (p.images && p.images[0]) || null,
          hasRecipe: withRecipe.has(p.id),
          defaultStationId: route?.stationId ?? null,
          defaultStationName: route?.station?.name ?? null,
        };
      }),
      count: products.length,
      warehouseId,
      needsWarehouse: false,
    };
  }

  async setProductStation(
    companyId: string,
    productId: string,
    stationId: string | null,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    if (!stationId) {
      await this.prisma.restoProductStation.deleteMany({
        where: { companyId, productId },
      });
      return { productId, stationId: null };
    }

    const station = await this.prisma.restoStation.findFirst({
      where: { id: stationId, companyId, isActive: true },
    });
    if (!station) throw new NotFoundException('Station not found');

    await this.prisma.restoProductStation.upsert({
      where: {
        companyId_productId: { companyId, productId },
      },
      create: { companyId, productId, stationId },
      update: { stationId },
    });
    return {
      productId,
      stationId: station.id,
      stationName: station.name,
    };
  }

  /** Ensure at least one kitchen station exists (Kitchen; Bar seeded via seedFloor). */
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

  async listStations(companyId: string) {
    await this.ensureStation(companyId);
    const stations = await this.prisma.restoStation.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    return { stations, count: stations.length };
  }

  async createStation(companyId: string, dto: CreateRestoStationDto) {
    const name = dto.name.trim();
    if (!name) throw new BadRequestException('Station name required');
    return this.prisma.restoStation.create({
      data: {
        companyId,
        name,
        nameEn: dto.nameEn?.trim() || null,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  /**
   * Seed a starter floor: Main hall + N tables + kitchen/bar stations.
   * Idempotent when tables already exist.
   */
  async seedFloor(companyId: string, tableCount = 8) {
    await this.ensureStation(companyId);
    const stationCount = await this.prisma.restoStation.count({
      where: { companyId },
    });
    if (stationCount < 2) {
      await this.prisma.restoStation.create({
        data: {
          companyId,
          name: 'البار',
          nameEn: 'Bar',
          sortOrder: 1,
        },
      });
    }
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
    invoiceId?: string | null;
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
    const items = order.items
      .filter((it) => it.status !== RestoOrderItemStatus.CANCELLED)
      .map((it) => ({
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
      invoiceId: order.invoiceId ?? null,
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
    const channel = dto.channel ?? RestoOrderChannel.DINE_IN;

    if (channel === RestoOrderChannel.DINE_IN) {
      if (!dto.tableId) {
        throw new BadRequestException('tableId is required for dine-in orders');
      }
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
            openedById: userId || null,
            status: RestoOrderStatus.OPEN,
            channel: RestoOrderChannel.DINE_IN,
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

    const number = await this.nextOrderNumber(companyId);
    const order = await this.prisma.restoOrder.create({
      data: {
        companyId,
        tableId: null,
        number,
        guests: dto.guests ?? 1,
        notes: dto.notes?.trim() || null,
        openedById: userId || null,
        status: RestoOrderStatus.OPEN,
        channel,
      },
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

    let stationId = dto.stationId || null;
    if (!stationId) {
      const route = await this.prisma.restoProductStation.findUnique({
        where: {
          companyId_productId: { companyId, productId: product.id },
        },
        select: { stationId: true },
      });
      stationId = route?.stationId ?? null;
    }
    const station = stationId
      ? await this.prisma.restoStation.findFirst({
          where: { id: stationId, companyId, isActive: true },
        })
      : await this.ensureStation(companyId);
    if (!station) throw new NotFoundException('Station not found');
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

  async updateOrder(
    companyId: string,
    orderId: string,
    dto: UpdateRestoOrderDto,
  ) {
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
    await this.prisma.restoOrder.update({
      where: { id: orderId },
      data: {
        ...(dto.guests !== undefined ? { guests: dto.guests } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
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

  async listActiveOrders(
    companyId: string,
    channel?: 'DINE_IN' | 'TAKEAWAY' | 'DELIVERY',
  ) {
    const rows = await this.prisma.restoOrder.findMany({
      where: {
        companyId,
        status: { in: ACTIVE_ORDER },
        ...(channel ? { channel } : {}),
      },
      include: {
        table: { select: { id: true, code: true, name: true } },
        items: {
          where: { status: { not: RestoOrderItemStatus.CANCELLED } },
          select: {
            id: true,
            name: true,
            qty: true,
            status: true,
            unitPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return {
      count: rows.length,
      channel: channel || null,
      orders: rows.map((o) => {
        const total = o.items.reduce(
          (s, i) => s + Number(i.qty) * Number(i.unitPrice),
          0,
        );
        return {
          id: o.id,
          number: o.number,
          channel: o.channel,
          status: o.status,
          guests: o.guests,
          notes: o.notes,
          createdAt: o.createdAt,
          table: o.table,
          itemCount: o.items.length,
          total,
          items: o.items.map((i) => ({
            id: i.id,
            name: i.name,
            qty: Number(i.qty),
            status: i.status,
            unitPrice: i.unitPrice,
          })),
        };
      }),
    };
  }

  async getKitchenQueue(companyId: string, stationId?: string) {
    await this.ensureStation(companyId);
    const stations = await this.prisma.restoStation.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, nameEn: true, sortOrder: true },
    });

    const items = await this.prisma.restoOrderItem.findMany({
      where: {
        status: {
          in: [
            RestoOrderItemStatus.SENT,
            RestoOrderItemStatus.PREPARING,
            RestoOrderItemStatus.READY,
          ],
        },
        ...(stationId ? { stationId } : {}),
        order: {
          companyId,
          status: { in: ACTIVE_ORDER },
        },
      },
      orderBy: [{ sentAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        station: { select: { id: true, name: true, nameEn: true } },
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
      stations,
      stationId: stationId || null,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        qty: Number(it.qty),
        notes: it.notes,
        status: it.status,
        sentAt: it.sentAt,
        stationId: it.stationId,
        stationName: it.station?.name ?? null,
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

  /**
   * Close order. Default: POS sale (invoice + stock + GL) then free table.
   * Pass `{ soft: true }` for operational close without accounting.
   */
  async closeOrder(
    companyId: string,
    actor: TokenPayload,
    orderId: string,
    dto: CloseRestoOrderDto = {},
  ) {
    const order = await this.loadOrder(companyId, orderId);
    if (order.status === RestoOrderStatus.CLOSED) {
      return {
        ...this.mapOrder(order),
        invoice: order.invoiceId ? { id: order.invoiceId } : null,
      };
    }
    if (order.status === RestoOrderStatus.CANCELLED) {
      throw new BadRequestException('Order is cancelled');
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

    let invoiceId: string | null = order.invoiceId ?? null;

    if (!dto.soft) {
      const billable = order.items.filter(
        (i) =>
          i.status !== RestoOrderItemStatus.CANCELLED &&
          i.status !== RestoOrderItemStatus.PENDING &&
          !!i.productId,
      );
      const fallback = order.items.filter(
        (i) => i.status !== RestoOrderItemStatus.CANCELLED && !!i.productId,
      );
      const lines = billable.length > 0 ? billable : fallback;
      if (lines.length === 0) {
        throw new BadRequestException(
          'No billable items — add products or use soft close',
        );
      }

      await this.prisma.restoOrderItem.updateMany({
        where: { orderId, status: RestoOrderItemStatus.PENDING },
        data: {
          status: RestoOrderItemStatus.SERVED,
          readyAt: new Date(),
        },
      });

      const warehouseId =
        dto.warehouseId ||
        (await this.resolveWarehouseId(companyId)) ||
        undefined;

      await this.deductRecipeComponents(
        companyId,
        order.number,
        lines.map((i) => ({
          productId: i.productId as string,
          qty: Number(i.qty),
        })),
        warehouseId,
      );

      const invoice = await this.pos.createSale(companyId, actor, {
        items: lines.map((i) => ({
          productId: i.productId as string,
          quantity: Number(i.qty),
          unitPrice: Number(i.unitPrice),
        })),
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        warehouseId,
        contactId: dto.contactId,
        tipAmount: dto.tipAmount,
        notes: `Hisaby Resto ${order.number} [${order.channel}]`,
        clientSaleId: `resto-${order.id}`,
      });
      invoiceId = invoice.id;
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.restoOrder.update({
        where: { id: orderId },
        data: {
          status: RestoOrderStatus.CLOSED,
          closedAt: new Date(),
          ...(invoiceId ? { invoiceId } : {}),
        },
      });
      if (order.tableId) {
        await tx.restoTable.update({
          where: { id: order.tableId },
          data: { status: RestoTableStatus.FREE },
        });
      }
    });

    const mapped = await this.getOrder(companyId, orderId);
    return {
      ...mapped,
      invoice: invoiceId ? { id: invoiceId } : null,
    };
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

  async getReportsSummary(companyId: string, days = 7) {
    const safeDays = Math.min(Math.max(days || 7, 1), 90);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    from.setDate(from.getDate() - (safeDays - 1));

    const orders = await this.prisma.restoOrder.findMany({
      where: {
        companyId,
        createdAt: { gte: from },
      },
      include: {
        table: { select: { id: true, code: true, name: true } },
        items: {
          where: { status: { not: RestoOrderItemStatus.CANCELLED } },
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    let revenue = 0;
    let closed = 0;
    let cancelled = 0;
    let openNow = 0;
    const prepSamples: number[] = [];
    const byHour = new Map<number, number>();
    const byTable = new Map<string, { label: string; orders: number; revenue: number }>();
    const byItem = new Map<string, { name: string; qty: number; revenue: number }>();

    for (const order of orders) {
      if (order.status === RestoOrderStatus.CLOSED) closed += 1;
      else if (order.status === RestoOrderStatus.CANCELLED) cancelled += 1;
      else if (ACTIVE_ORDER.includes(order.status)) openNow += 1;

      const hour = order.createdAt.getHours();
      byHour.set(hour, (byHour.get(hour) || 0) + 1);

      const orderRevenue = order.items.reduce(
        (s, i) => s + Number(i.qty) * Number(i.unitPrice),
        0,
      );
      /** Paid close only — soft closes have no invoiceId */
      const paidClose =
        order.status === RestoOrderStatus.CLOSED && !!order.invoiceId;
      if (paidClose) {
        revenue += orderRevenue;
      }

      const tableKey = order.table?.id || 'none';
      const tableLabel = order.table
        ? order.table.code
        : order.channel === 'TAKEAWAY'
          ? 'TAKEAWAY'
          : '—';
      const tableRow = byTable.get(tableKey) || {
        label: tableLabel,
        orders: 0,
        revenue: 0,
      };
      tableRow.orders += 1;
      if (paidClose) {
        tableRow.revenue += orderRevenue;
      }
      byTable.set(tableKey, tableRow);

      for (const item of order.items) {
        if (!paidClose) continue;
        const key = item.productId || item.name;
        const row = byItem.get(key) || {
          name: item.name,
          qty: 0,
          revenue: 0,
        };
        row.qty += Number(item.qty);
        row.revenue += Number(item.qty) * Number(item.unitPrice);
        byItem.set(key, row);

        if (item.sentAt && item.readyAt) {
          const mins =
            (item.readyAt.getTime() - item.sentAt.getTime()) / 60000;
          if (mins >= 0 && mins < 240) prepSamples.push(mins);
        }
      }
    }

    const avgPrepMinutes =
      prepSamples.length > 0
        ? Number(
            (
              prepSamples.reduce((s, n) => s + n, 0) / prepSamples.length
            ).toFixed(1),
          )
        : 0;

    return {
      from: from.toISOString(),
      to: new Date().toISOString(),
      days: safeDays,
      orders: orders.length,
      closed,
      cancelled,
      openNow,
      revenue: Number(revenue.toFixed(3)),
      avgPrepMinutes,
      byHour: Array.from({ length: 24 }, (_, h) => ({
        hour: h,
        orders: byHour.get(h) || 0,
      })),
      byTable: Array.from(byTable.values())
        .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
        .slice(0, 20),
      topItems: Array.from(byItem.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 15),
    };
  }

  private mapReservation(r: {
    id: string;
    guestName: string;
    phone: string | null;
    guests: number;
    reservedAt: Date;
    status: string;
    notes: string | null;
    tableId: string | null;
    createdAt: Date;
    table?: { id: string; code: string; name: string | null } | null;
  }) {
    return {
      id: r.id,
      guestName: r.guestName,
      phone: r.phone,
      guests: r.guests,
      reservedAt: r.reservedAt,
      status: r.status,
      notes: r.notes,
      tableId: r.tableId,
      table: r.table
        ? { id: r.table.id, code: r.table.code, name: r.table.name }
        : null,
      createdAt: r.createdAt,
    };
  }

  async listReservations(companyId: string, days = 2) {
    const safeDays = Math.min(Math.max(days || 2, 1), 30);
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + safeDays);

    const rows = await this.prisma.restoReservation.findMany({
      where: {
        companyId,
        reservedAt: { gte: from, lt: to },
      },
      include: {
        table: { select: { id: true, code: true, name: true } },
      },
      orderBy: { reservedAt: 'asc' },
      take: 200,
    });
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      reservations: rows.map((r) => this.mapReservation(r)),
      count: rows.length,
    };
  }

  async createReservation(
    companyId: string,
    dto: {
      guestName: string;
      phone?: string;
      guests?: number;
      reservedAt: string;
      tableId?: string;
      notes?: string;
    },
  ) {
    const guestName = dto.guestName.trim();
    if (!guestName) throw new BadRequestException('Guest name required');
    const reservedAt = new Date(dto.reservedAt);
    if (Number.isNaN(reservedAt.getTime())) {
      throw new BadRequestException('Invalid reservation time');
    }
    if (dto.tableId) {
      const table = await this.prisma.restoTable.findFirst({
        where: { id: dto.tableId, companyId },
      });
      if (!table) throw new NotFoundException('Table not found');

      const windowMs = 90 * 60 * 1000;
      const conflict = await this.prisma.restoReservation.findFirst({
        where: {
          companyId,
          tableId: dto.tableId,
          status: { in: ['PENDING', 'CONFIRMED'] },
          reservedAt: {
            gte: new Date(reservedAt.getTime() - windowMs),
            lte: new Date(reservedAt.getTime() + windowMs),
          },
        },
        select: { id: true, guestName: true, reservedAt: true },
      });
      if (conflict) {
        throw new BadRequestException(
          `Table already reserved near that time (${conflict.guestName} @ ${conflict.reservedAt.toISOString()})`,
        );
      }
    }
    const created = await this.prisma.restoReservation.create({
      data: {
        companyId,
        guestName,
        phone: dto.phone?.trim() || null,
        guests: dto.guests ?? 2,
        reservedAt,
        tableId: dto.tableId || null,
        notes: dto.notes?.trim() || null,
        status: 'PENDING',
      },
      include: {
        table: { select: { id: true, code: true, name: true } },
      },
    });
    // Only lock the floor table when the booking is imminent (within 2 hours)
    const soonMs = 2 * 60 * 60 * 1000;
    if (
      created.tableId &&
      reservedAt.getTime() - Date.now() <= soonMs &&
      reservedAt.getTime() >= Date.now() - 15 * 60 * 1000
    ) {
      const active = await this.prisma.restoOrder.findFirst({
        where: {
          companyId,
          tableId: created.tableId,
          status: { in: ACTIVE_ORDER },
        },
      });
      if (!active) {
        await this.prisma.restoTable.update({
          where: { id: created.tableId },
          data: { status: RestoTableStatus.RESERVED },
        });
      }
    }
    return this.mapReservation(created);
  }

  async updateReservationStatus(
    companyId: string,
    id: string,
    status: 'PENDING' | 'CONFIRMED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW',
    userId?: string,
  ) {
    const row = await this.prisma.restoReservation.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('Reservation not found');

    const updated = await this.prisma.restoReservation.update({
      where: { id },
      data: { status },
      include: {
        table: { select: { id: true, code: true, name: true } },
      },
    });

    if (row.tableId) {
      if (status === 'CANCELLED' || status === 'NO_SHOW') {
        const active = await this.prisma.restoOrder.findFirst({
          where: {
            companyId,
            tableId: row.tableId,
            status: { in: ACTIVE_ORDER },
          },
        });
        if (!active) {
          await this.prisma.restoTable.update({
            where: { id: row.tableId },
            data: { status: RestoTableStatus.FREE },
          });
        }
      } else if (status === 'SEATED') {
        await this.prisma.restoTable.update({
          where: { id: row.tableId },
          data: { status: RestoTableStatus.OCCUPIED },
        });
      } else if (status === 'CONFIRMED' || status === 'PENDING') {
        // Only lock floor when booking is imminent (within 2h) — matches createReservation
        const soonMs = 2 * 60 * 60 * 1000;
        const at = row.reservedAt.getTime();
        if (at - Date.now() <= soonMs && at >= Date.now() - 15 * 60 * 1000) {
          const active = await this.prisma.restoOrder.findFirst({
            where: {
              companyId,
              tableId: row.tableId,
              status: { in: ACTIVE_ORDER },
            },
          });
          if (!active) {
            await this.prisma.restoTable.update({
              where: { id: row.tableId },
              data: { status: RestoTableStatus.RESERVED },
            });
          }
        }
      }
    }

    let openedOrderId: string | null = null;
    if (status === 'SEATED' && row.tableId) {
      const existing = await this.prisma.restoOrder.findFirst({
        where: {
          companyId,
          tableId: row.tableId,
          status: { in: ACTIVE_ORDER },
        },
        select: { id: true },
      });
      if (existing) {
        openedOrderId = existing.id;
      } else {
        const opened = await this.openOrder(companyId, userId || '', {
          tableId: row.tableId,
          guests: row.guests,
          notes: `Reservation: ${row.guestName}`,
          channel: RestoOrderChannel.DINE_IN,
        });
        openedOrderId = opened.id;
      }
    }

    return {
      ...this.mapReservation(updated),
      openedOrderId,
    };
  }

  /**
   * Deduct recipe components for untracked menu dishes only.
   * Tracked dishes keep POS finished-goods deduct — recipes are ignored to avoid double stock-out.
   */
  private async deductRecipeComponents(
    companyId: string,
    orderNumber: string,
    lines: Array<{ productId: string; qty: number }>,
    warehouseId?: string,
  ) {
    const productIds = [...new Set(lines.map((l) => l.productId))];
    if (productIds.length === 0) return;

    const products = await this.prisma.product.findMany({
      where: { companyId, id: { in: productIds } },
      select: { id: true, isTracked: true, name: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const recipes = await this.prisma.restoRecipe.findMany({
      where: {
        companyId,
        productId: { in: productIds },
      },
      include: {
        items: {
          include: {
            component: { select: { id: true, name: true, isTracked: true } },
          },
        },
      },
    });
    const recipeByProduct = new Map(recipes.map((r) => [r.productId, r]));

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product) continue;
      if (product.isTracked) continue; // POS will deduct finished good
      const recipe = recipeByProduct.get(line.productId);
      if (!recipe || recipe.items.length === 0) continue;

      for (const item of recipe.items) {
        const need = Number(item.qty) * line.qty;
        if (!(need > 0)) continue;
        await this.pos.consumeStock(
          companyId,
          item.componentProductId,
          need,
          warehouseId,
          `resto-${orderNumber}`,
          `Recipe for ${product.name}`,
        );
      }
    }
  }

  async listRecipes(companyId: string) {
    const rows = await this.prisma.restoRecipe.findMany({
      where: { companyId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            sku: true,
            isTracked: true,
            salePrice: true,
          },
        },
        items: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                nameEn: true,
                sku: true,
                unit: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return {
      count: rows.length,
      recipes: rows.map((r) => this.mapRecipe(r)),
    };
  }

  async getRecipe(companyId: string, productId: string) {
    const row = await this.prisma.restoRecipe.findFirst({
      where: { companyId, productId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            nameEn: true,
            sku: true,
            isTracked: true,
            salePrice: true,
          },
        },
        items: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                nameEn: true,
                sku: true,
                unit: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException('Recipe not found');
    return this.mapRecipe(row);
  }

  async upsertRecipe(
    companyId: string,
    productId: string,
    dto: UpsertRestoRecipeDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true, isTracked: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const items = (dto.items || []).filter((i) => i.qty > 0);
    if (items.length === 0) {
      throw new BadRequestException('Recipe needs at least one component');
    }

    const componentIds = items.map((i) => i.componentProductId);
    if (componentIds.includes(productId)) {
      throw new BadRequestException('Dish cannot be its own ingredient');
    }
    if (new Set(componentIds).size !== componentIds.length) {
      throw new BadRequestException('Duplicate components in recipe');
    }

    const components = await this.prisma.product.findMany({
      where: { companyId, id: { in: componentIds } },
      select: { id: true },
    });
    if (components.length !== componentIds.length) {
      throw new BadRequestException('One or more components not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const recipe = await tx.restoRecipe.upsert({
        where: { productId },
        create: {
          companyId,
          productId,
          notes: dto.notes?.trim() || null,
        },
        update: {
          notes: dto.notes?.trim() || null,
        },
      });
      await tx.restoRecipeItem.deleteMany({ where: { recipeId: recipe.id } });
      await tx.restoRecipeItem.createMany({
        data: items.map((i) => ({
          recipeId: recipe.id,
          componentProductId: i.componentProductId,
          qty: this.decimal(i.qty),
        })),
      });
    });

    return this.getRecipe(companyId, productId);
  }

  async deleteRecipe(companyId: string, productId: string) {
    const row = await this.prisma.restoRecipe.findFirst({
      where: { companyId, productId },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Recipe not found');
    await this.prisma.restoRecipe.delete({ where: { id: row.id } });
    return { ok: true, productId };
  }

  private mapRecipe(r: {
    id: string;
    productId: string;
    notes: string | null;
    product: {
      id: string;
      name: string;
      nameEn: string | null;
      sku: string;
      isTracked: boolean;
      salePrice: Prisma.Decimal;
    };
    items: Array<{
      id: string;
      componentProductId: string;
      qty: Prisma.Decimal;
      component: {
        id: string;
        name: string;
        nameEn: string | null;
        sku: string;
        unit: string;
      };
    }>;
  }) {
    return {
      id: r.id,
      productId: r.productId,
      notes: r.notes,
      deductsIngredients: !r.product.isTracked,
      warningTracked:
        r.product.isTracked
          ? 'Dish is stock-tracked — POS deducts the dish itself; recipe is not used on close'
          : null,
      product: {
        id: r.product.id,
        name: r.product.name,
        nameEn: r.product.nameEn,
        sku: r.product.sku,
        isTracked: r.product.isTracked,
        price: r.product.salePrice,
      },
      items: r.items.map((i) => ({
        id: i.id,
        componentProductId: i.componentProductId,
        qty: i.qty,
        component: i.component,
      })),
    };
  }
}
