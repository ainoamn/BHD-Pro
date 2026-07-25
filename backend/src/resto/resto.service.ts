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
import { Observable, Subject, from, interval, merge, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { PosService } from '../pos/pos.service';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import {
  AddRestoOrderItemDto,
  CloseRestoOrderDto,
  CreateRestoModifierDto,
  CreateRestoReservationDto,
  CreateRestoStationDto,
  CreateRestoTableDto,
  CreateRestoWaitlistDto,
  CreateRestoZoneDto,
  MergeRestoOrderDto,
  OpenRestoOrderDto,
  SetRestoMenu86Dto,
  SplitRestoOrderDto,
  TransferRestoOrderDto,
  UpdateRestoOrderDto,
  UpdateRestoOrderItemDto,
  UpdateRestoDeliveryDto,
  UpsertRestoRecipeDto,
  PublicGuestOrderDto,
  PublicGuestCallDto,
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

const ACTIVE_WAITLIST = ['WAITING', 'NOTIFIED'] as const;

@Injectable()
export class RestoService {
  private readonly kitchenBuses = new Map<string, Subject<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pos: PosService,
  ) {}

  private kitchenBus(companyId: string) {
    let bus = this.kitchenBuses.get(companyId);
    if (!bus) {
      bus = new Subject<void>();
      this.kitchenBuses.set(companyId, bus);
    }
    return bus;
  }

  /** Push KDS clients (SSE) after ticket changes */
  notifyKitchen(companyId: string) {
    this.kitchenBus(companyId).next();
  }

  kitchenStream(
    companyId: string,
    stationId?: string,
  ): Observable<{ data: unknown }> {
    return merge(
      of(null),
      this.kitchenBus(companyId),
      interval(25000),
    ).pipe(
      switchMap(() =>
        from(this.getKitchenQueue(companyId, stationId)).pipe(
          map((data) => ({ data })),
        ),
      ),
    );
  }

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
    const eightySixed = await this.prisma.restoMenu86.findMany({
      where: { companyId },
      select: { productId: true, note: true },
    });
    const eightySixMap = new Map(
      eightySixed.map((r) => [r.productId, r.note || true]),
    );
    const available = products.filter((p) => !eightySixMap.has(p.id));
    const routes = await this.prisma.restoProductStation.findMany({
      where: {
        companyId,
        productId: { in: available.map((p) => p.id) },
      },
      include: {
        station: { select: { id: true, name: true, nameEn: true } },
      },
    });
    const recipes = await this.prisma.restoRecipe.findMany({
      where: {
        companyId,
        productId: { in: available.map((p) => p.id) },
      },
      select: { productId: true },
    });
    const byProduct = new Map(routes.map((r) => [r.productId, r]));
    const withRecipe = new Set(recipes.map((r) => r.productId));
    return {
      items: available.map((p) => {
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
      count: available.length,
      eightySixedCount: eightySixed.length,
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
        guestToken: randomBytes(9).toString('base64url'),
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
          sortOrder: 0,
          status: RestoTableStatus.FREE,
          guestToken: randomBytes(9).toString('base64url'),
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
                    source: true,
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
        const occupiedMinutes = open
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - new Date(open.createdAt).getTime()) / 60000,
              ),
            )
          : 0;
        const guestItemCount = items.filter((it) => it.source === 'GUEST').length;
        return {
          id: t.id,
          code: t.code,
          name: t.name,
          seats: t.seats,
          status: open ? RestoTableStatus.OCCUPIED : t.status,
          guestToken: t.guestToken,
          guestCallAt: t.guestCallAt,
          guestCallType: t.guestCallType,
          openOrder: open
            ? {
                id: open.id,
                number: open.number,
                status: open.status,
                guests: open.guests,
                itemCount: items.length,
                total,
                createdAt: open.createdAt,
                occupiedMinutes,
                guestItemCount,
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
    guestName?: string | null;
    guestPhone?: string | null;
    deliveryAddress?: string | null;
    deliveryStatus?: string | null;
    driverName?: string | null;
    driverPhone?: string | null;
    deliveredAt?: Date | null;
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
      course?: number;
      isComp?: boolean;
      voidReason?: string | null;
      source?: string | null;
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
      course: it.course ?? 1,
      isComp: !!it.isComp,
      voidReason: it.voidReason ?? null,
      source: it.source === 'GUEST' ? 'GUEST' : 'STAFF',
      status: it.status,
      sentAt: it.sentAt,
      readyAt: it.readyAt,
    }));
    const subtotal = items
      .filter((it) => !it.isComp)
      .reduce((s, it) => s + it.lineTotal, 0);
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      channel: order.channel,
      guests: order.guests,
      notes: order.notes,
      guestName: order.guestName ?? null,
      guestPhone: order.guestPhone ?? null,
      deliveryAddress: order.deliveryAddress ?? null,
      deliveryStatus: order.deliveryStatus ?? null,
      driverName: order.driverName ?? null,
      driverPhone: order.driverPhone ?? null,
      deliveredAt: order.deliveredAt ?? null,
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
            guestName: dto.guestName?.trim() || null,
            guestPhone: dto.guestPhone?.trim() || null,
            deliveryAddress: dto.deliveryAddress?.trim() || null,
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
        guestName: dto.guestName?.trim() || null,
        guestPhone: dto.guestPhone?.trim() || null,
        deliveryAddress: dto.deliveryAddress?.trim() || null,
        deliveryStatus:
          channel === RestoOrderChannel.DELIVERY ? 'QUEUED' : null,
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

    const mods = dto.modifiers || [];
    const priceDelta = mods.reduce(
      (s, m) => s + (Number(m.priceDelta) || 0),
      0,
    );
    const modLabels = mods.map((m) => m.name.trim()).filter(Boolean);
    const displayName =
      modLabels.length > 0
        ? `${product.name} (${modLabels.join(' · ')})`
        : product.name;
    const noteParts = [
      dto.notes?.trim() || '',
      modLabels.length ? `+ ${modLabels.join(', ')}` : '',
    ].filter(Boolean);

    await this.prisma.restoOrderItem.create({
      data: {
        orderId: order.id,
        productId: product.id,
        stationId: station.id,
        name: displayName,
        qty: this.decimal(qty),
        unitPrice: this.decimal(Number(product.salePrice) + priceDelta),
        notes: noteParts.join(' — ') || null,
        course: dto.course ?? 1,
        source: dto.source === 'GUEST' ? 'GUEST' : 'STAFF',
        status: RestoOrderItemStatus.PENDING,
      },
    });

    return this.getOrder(companyId, order.id);
  }

  private async assertActiveOrder(companyId: string, orderId: string) {
    const order = await this.prisma.restoOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (!ACTIVE_ORDER.includes(order.status)) {
      throw new BadRequestException('Order is not active');
    }
    return order;
  }

  private async freeTableIfIdle(companyId: string, tableId: string | null) {
    if (!tableId) return;
    const active = await this.prisma.restoOrder.findFirst({
      where: {
        companyId,
        tableId,
        status: { in: ACTIVE_ORDER },
      },
      select: { id: true },
    });
    if (!active) {
      await this.prisma.restoTable.update({
        where: { id: tableId },
        data: { status: RestoTableStatus.FREE },
      });
    }
  }

  /** Move an open check to another free table */
  async transferOrder(
    companyId: string,
    orderId: string,
    dto: TransferRestoOrderDto,
  ) {
    const order = await this.assertActiveOrder(companyId, orderId);
    const table = await this.prisma.restoTable.findFirst({
      where: { id: dto.tableId, companyId },
    });
    if (!table) throw new NotFoundException('Table not found');
    if (order.tableId === table.id) {
      return this.getOrder(companyId, orderId);
    }
    const occupied = await this.prisma.restoOrder.findFirst({
      where: {
        companyId,
        tableId: table.id,
        status: { in: ACTIVE_ORDER },
        id: { not: orderId },
      },
    });
    if (occupied) {
      throw new BadRequestException('Target table already has an open order');
    }
    const fromTableId = order.tableId;
    await this.prisma.$transaction(async (tx) => {
      await tx.restoOrder.update({
        where: { id: orderId },
        data: {
          tableId: table.id,
          channel: RestoOrderChannel.DINE_IN,
        },
      });
      await tx.restoTable.update({
        where: { id: table.id },
        data: { status: RestoTableStatus.OCCUPIED },
      });
    });
    await this.freeTableIfIdle(companyId, fromTableId);
    this.notifyKitchen(companyId);
    return this.getOrder(companyId, orderId);
  }

  /** Merge source check into target — frees source table */
  async mergeOrders(
    companyId: string,
    sourceOrderId: string,
    dto: MergeRestoOrderDto,
  ) {
    if (sourceOrderId === dto.targetOrderId) {
      throw new BadRequestException('Cannot merge an order into itself');
    }
    const source = await this.assertActiveOrder(companyId, sourceOrderId);
    const target = await this.assertActiveOrder(companyId, dto.targetOrderId);

    await this.prisma.$transaction(async (tx) => {
      await tx.restoOrderItem.updateMany({
        where: { orderId: source.id },
        data: { orderId: target.id },
      });
      await tx.restoOrder.update({
        where: { id: source.id },
        data: {
          status: RestoOrderStatus.CANCELLED,
          closedAt: new Date(),
          notes: [source.notes, `Merged → ${target.number}`]
            .filter(Boolean)
            .join(' | '),
        },
      });
    });
    await this.freeTableIfIdle(companyId, source.tableId);
    await this.refreshOrderStatus(companyId, target.id);
    this.notifyKitchen(companyId);
    return this.getOrder(companyId, target.id);
  }

  /** Split selected lines onto a new check (free table or takeaway) */
  async splitOrder(
    companyId: string,
    orderId: string,
    userId: string,
    dto: SplitRestoOrderDto,
  ) {
    const source = await this.assertActiveOrder(companyId, orderId);
    const itemIds = [...new Set(dto.itemIds || [])];
    if (itemIds.length === 0) {
      throw new BadRequestException('Select at least one item to split');
    }
    const items = await this.prisma.restoOrderItem.findMany({
      where: {
        id: { in: itemIds },
        orderId: source.id,
        status: { not: RestoOrderItemStatus.CANCELLED },
      },
    });
    if (items.length !== itemIds.length) {
      throw new BadRequestException('Some items do not belong to this order');
    }
    const remaining = await this.prisma.restoOrderItem.count({
      where: {
        orderId: source.id,
        status: { not: RestoOrderItemStatus.CANCELLED },
        id: { notIn: itemIds },
      },
    });
    if (remaining === 0) {
      throw new BadRequestException(
        'Cannot split all items — transfer the whole order instead',
      );
    }

    let tableId: string | null = null;
    let channel: RestoOrderChannel = RestoOrderChannel.TAKEAWAY;
    if (dto.tableId) {
      const table = await this.prisma.restoTable.findFirst({
        where: { id: dto.tableId, companyId },
      });
      if (!table) throw new NotFoundException('Table not found');
      const occupied = await this.prisma.restoOrder.findFirst({
        where: {
          companyId,
          tableId: table.id,
          status: { in: ACTIVE_ORDER },
        },
      });
      if (occupied) {
        throw new BadRequestException('Target table already has an open order');
      }
      tableId = table.id;
      channel = RestoOrderChannel.DINE_IN;
    }

    const number = await this.nextOrderNumber(companyId);
    const created = await this.prisma.$transaction(async (tx) => {
      const order = await tx.restoOrder.create({
        data: {
          companyId,
          tableId,
          number,
          guests: dto.guests ?? Math.max(1, Math.floor(source.guests / 2)),
          notes: `Split from ${source.number}`,
          openedById: userId || null,
          status: RestoOrderStatus.OPEN,
          channel,
        },
      });
      await tx.restoOrderItem.updateMany({
        where: { id: { in: itemIds } },
        data: { orderId: order.id },
      });
      if (tableId) {
        await tx.restoTable.update({
          where: { id: tableId },
          data: { status: RestoTableStatus.OCCUPIED },
        });
      }
      return order;
    });

    await this.refreshOrderStatus(companyId, source.id);
    await this.refreshOrderStatus(companyId, created.id);
    this.notifyKitchen(companyId);
    return {
      source: await this.getOrder(companyId, source.id),
      split: await this.getOrder(companyId, created.id),
    };
  }

  async listModifiers(companyId: string) {
    let rows = await this.prisma.restoModifier.findMany({
      where: { companyId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    if (rows.length === 0) {
      await this.seedDefaultModifiers(companyId);
      rows = await this.prisma.restoModifier.findMany({
        where: { companyId, isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }
    return {
      modifiers: rows.map((m) => ({
        id: m.id,
        name: m.name,
        nameEn: m.nameEn,
        priceDelta: Number(m.priceDelta),
        sortOrder: m.sortOrder,
      })),
    };
  }

  private async seedDefaultModifiers(companyId: string) {
    const defaults = [
      { name: 'جبن إضافي', nameEn: 'Extra cheese', priceDelta: 0.5, sortOrder: 1 },
      { name: 'حار', nameEn: 'Spicy', priceDelta: 0, sortOrder: 2 },
      { name: 'بدون بصل', nameEn: 'No onion', priceDelta: 0, sortOrder: 3 },
      { name: 'كبير', nameEn: 'Large', priceDelta: 1, sortOrder: 4 },
      { name: 'صلصة إضافية', nameEn: 'Extra sauce', priceDelta: 0.25, sortOrder: 5 },
    ];
    for (const d of defaults) {
      await this.prisma.restoModifier.create({
        data: {
          companyId,
          name: d.name,
          nameEn: d.nameEn,
          priceDelta: this.decimal(d.priceDelta),
          sortOrder: d.sortOrder,
        },
      });
    }
  }

  async createModifier(companyId: string, dto: CreateRestoModifierDto) {
    const row = await this.prisma.restoModifier.create({
      data: {
        companyId,
        name: dto.name.trim(),
        nameEn: dto.nameEn?.trim() || null,
        priceDelta: this.decimal(dto.priceDelta ?? 0),
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return {
      id: row.id,
      name: row.name,
      nameEn: row.nameEn,
      priceDelta: Number(row.priceDelta),
      sortOrder: row.sortOrder,
    };
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
        ...(dto.course !== undefined ? { course: dto.course } : {}),
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
        ...(dto.guestName !== undefined
          ? { guestName: dto.guestName?.trim() || null }
          : {}),
        ...(dto.guestPhone !== undefined
          ? { guestPhone: dto.guestPhone?.trim() || null }
          : {}),
        ...(dto.deliveryAddress !== undefined
          ? { deliveryAddress: dto.deliveryAddress?.trim() || null }
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

  /**
   * Void or comp a line after it was sent to kitchen.
   * Comp: stays SERVED/READY at 0 price for audit. Void: CANCELLED with reason.
   */
  async voidItem(
    companyId: string,
    orderId: string,
    itemId: string,
    reason: string,
    comp = false,
  ) {
    const item = await this.prisma.restoOrderItem.findFirst({
      where: { id: itemId, orderId, order: { companyId } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.status === RestoOrderItemStatus.CANCELLED) {
      throw new BadRequestException('Item already voided');
    }
    if (item.status === RestoOrderItemStatus.PENDING) {
      throw new BadRequestException('Remove pending items instead of voiding');
    }
    const reasonText = reason.trim();
    if (reasonText.length < 2) {
      throw new BadRequestException('Void reason required');
    }

    if (comp) {
      await this.prisma.restoOrderItem.update({
        where: { id: item.id },
        data: {
          isComp: true,
          unitPrice: this.decimal(0),
          voidReason: reasonText,
          voidedAt: new Date(),
          notes: [item.notes, `COMP: ${reasonText}`].filter(Boolean).join(' — '),
        },
      });
    } else {
      await this.prisma.restoOrderItem.update({
        where: { id: item.id },
        data: {
          status: RestoOrderItemStatus.CANCELLED,
          voidReason: reasonText,
          voidedAt: new Date(),
          notes: [item.notes, `VOID: ${reasonText}`].filter(Boolean).join(' — '),
        },
      });
    }
    await this.refreshOrderStatus(companyId, orderId);
    this.notifyKitchen(companyId);
    return this.getOrder(companyId, orderId);
  }

  /** Expo / runner pass — READY tickets awaiting SERVED */
  async getExpoQueue(companyId: string) {
    const items = await this.prisma.restoOrderItem.findMany({
      where: {
        status: RestoOrderItemStatus.READY,
        order: {
          companyId,
          status: { in: ACTIVE_ORDER },
        },
      },
      orderBy: [{ readyAt: 'asc' }, { sentAt: 'asc' }],
      include: {
        station: { select: { id: true, name: true, nameEn: true } },
        order: {
          select: {
            id: true,
            number: true,
            channel: true,
            guestName: true,
            table: { select: { id: true, code: true, name: true } },
          },
        },
      },
      take: 100,
    });
    return {
      count: items.length,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        qty: Number(it.qty),
        notes: it.notes,
        course: it.course ?? 1,
        status: it.status,
        readyAt: it.readyAt,
        sentAt: it.sentAt,
        stationName: it.station?.name ?? null,
        orderId: it.order.id,
        orderNumber: it.order.number,
        channel: it.order.channel,
        guestName: it.order.guestName,
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

  /** Fire pending items to kitchen (KDS), optionally by course */
  async sendToKitchen(
    companyId: string,
    orderId: string,
    course?: number,
  ) {
    const order = await this.loadOrder(companyId, orderId);
    if (
      order.status === RestoOrderStatus.CLOSED ||
      order.status === RestoOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order is closed');
    }
    const pending = order.items.filter(
      (i) =>
        i.status === RestoOrderItemStatus.PENDING &&
        (course === undefined || (i.course ?? 1) === course),
    );
    if (pending.length === 0) {
      throw new BadRequestException(
        course !== undefined
          ? `No pending items for course ${course}`
          : 'No pending items to send',
      );
    }
    const now = new Date();
    await this.prisma.restoOrderItem.updateMany({
      where: {
        orderId,
        status: RestoOrderItemStatus.PENDING,
        ...(course !== undefined ? { course } : {}),
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
        ...(order.channel === RestoOrderChannel.DELIVERY
          ? { deliveryStatus: 'KITCHEN' }
          : {}),
      },
    });
    await this.refreshOrderStatus(companyId, orderId);
    this.notifyKitchen(companyId);
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
        data: {
          status: next,
          ...(next === RestoOrderStatus.READY &&
          order.channel === RestoOrderChannel.DELIVERY &&
          order.deliveryStatus !== 'OUT' &&
          order.deliveryStatus !== 'DELIVERED'
            ? { deliveryStatus: 'READY' }
            : {}),
        },
      });
    } else if (
      next === RestoOrderStatus.READY &&
      order.channel === RestoOrderChannel.DELIVERY &&
      order.deliveryStatus !== 'READY' &&
      order.deliveryStatus !== 'OUT' &&
      order.deliveryStatus !== 'DELIVERED'
    ) {
      await this.prisma.restoOrder.update({
        where: { id: orderId },
        data: { deliveryStatus: 'READY' },
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
          guestName: o.guestName,
          guestPhone: o.guestPhone,
          deliveryAddress: o.deliveryAddress,
          deliveryStatus: o.deliveryStatus,
          driverName: o.driverName,
          driverPhone: o.driverPhone,
          deliveredAt: o.deliveredAt,
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
        course: it.course ?? 1,
        source: it.source === 'GUEST' ? 'GUEST' : 'STAFF',
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
    this.notifyKitchen(companyId);
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
          !i.isComp &&
          !!i.productId &&
          Number(i.unitPrice) > 0,
      );
      const fallback = order.items.filter(
        (i) =>
          i.status !== RestoOrderItemStatus.CANCELLED &&
          !i.isComp &&
          !!i.productId &&
          Number(i.unitPrice) > 0,
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

      const subtotal = lines.reduce(
        (s, i) => s + Number(i.qty) * Number(i.unitPrice),
        0,
      );
      let serviceCharge = Number(dto.serviceChargeAmount) || 0;
      if (dto.serviceChargePct != null && dto.serviceChargePct > 0) {
        serviceCharge += (subtotal * Number(dto.serviceChargePct)) / 100;
      }
      const tip = (Number(dto.tipAmount) || 0) + serviceCharge;
      const noteParts = [
        `Hisaby Resto ${order.number} [${order.channel}]`,
        order.guestName ? `Guest: ${order.guestName}` : '',
        order.guestPhone ? `Tel: ${order.guestPhone}` : '',
        order.deliveryAddress ? `Addr: ${order.deliveryAddress}` : '',
        serviceCharge > 0.0005
          ? `Service charge ${serviceCharge.toFixed(3)}`
          : '',
      ].filter(Boolean);

      const split =
        Array.isArray(dto.payments) && dto.payments.length > 0
          ? dto.payments.map((p) => ({
              method: p.method,
              amount: Number(p.amount),
            }))
          : null;

      const invoice = await this.pos.createSale(companyId, actor, {
        items: lines.map((i) => ({
          productId: i.productId as string,
          quantity: Number(i.qty),
          unitPrice: Number(i.unitPrice),
        })),
        paymentMethod: dto.paymentMethod ?? PaymentMethod.CASH,
        ...(split ? { payments: split } : {}),
        warehouseId,
        contactId: dto.contactId,
        tipAmount: tip > 0.0005 ? tip : undefined,
        notes: noteParts.join(' · '),
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
          ...(order.channel === RestoOrderChannel.DELIVERY && !dto.soft
            ? {
                deliveryStatus: 'DELIVERED',
                deliveredAt: new Date(),
              }
            : {}),
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

  async updateDeliveryStatus(
    companyId: string,
    orderId: string,
    dto: UpdateRestoDeliveryDto,
  ) {
    const order = await this.prisma.restoOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.channel !== RestoOrderChannel.DELIVERY) {
      throw new BadRequestException('Order is not a delivery order');
    }
    if (
      order.status === RestoOrderStatus.CLOSED ||
      order.status === RestoOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order is closed');
    }
    if (dto.deliveryStatus === 'OUT' && !dto.driverName?.trim() && !order.driverName) {
      throw new BadRequestException('driverName is required when dispatching OUT');
    }

    await this.prisma.restoOrder.update({
      where: { id: orderId },
      data: {
        deliveryStatus: dto.deliveryStatus,
        ...(dto.driverName !== undefined
          ? { driverName: dto.driverName?.trim() || null }
          : {}),
        ...(dto.driverPhone !== undefined
          ? { driverPhone: dto.driverPhone?.trim() || null }
          : {}),
        ...(dto.deliveryStatus === 'DELIVERED'
          ? { deliveredAt: new Date() }
          : {}),
      },
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

  async listWaitlist(companyId: string) {
    const rows = await this.prisma.restoWaitlistEntry.findMany({
      where: {
        companyId,
        status: { in: [...ACTIVE_WAITLIST] },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return {
      count: rows.length,
      entries: rows.map((r) => this.mapWaitlist(r)),
    };
  }

  async createWaitlist(companyId: string, dto: CreateRestoWaitlistDto) {
    const row = await this.prisma.restoWaitlistEntry.create({
      data: {
        companyId,
        guestName: dto.guestName.trim(),
        phone: dto.phone?.trim() || null,
        guests: dto.guests ?? 2,
        quotedMinutes: dto.quotedMinutes ?? null,
        notes: dto.notes?.trim() || null,
        status: 'WAITING',
      },
    });
    return this.mapWaitlist(row);
  }

  async updateWaitlistStatus(
    companyId: string,
    id: string,
    userId: string,
    status: 'WAITING' | 'NOTIFIED' | 'SEATED' | 'CANCELLED' | 'NO_SHOW',
    tableId?: string,
  ) {
    const row = await this.prisma.restoWaitlistEntry.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('Waitlist entry not found');

    if (status === 'SEATED') {
      if (!tableId) {
        throw new BadRequestException('tableId required to seat waitlist guest');
      }
      const order = await this.openOrder(companyId, userId, {
        tableId,
        channel: RestoOrderChannel.DINE_IN,
        guests: row.guests,
        notes: [`Waitlist: ${row.guestName}`, row.notes]
          .filter(Boolean)
          .join(' — '),
      });
      const updated = await this.prisma.restoWaitlistEntry.update({
        where: { id },
        data: {
          status: 'SEATED',
          tableId,
          seatedOrderId: order.id,
          seatedAt: new Date(),
        },
      });
      return { ...this.mapWaitlist(updated), order };
    }

    const updated = await this.prisma.restoWaitlistEntry.update({
      where: { id },
      data: {
        status,
        ...(status === 'NOTIFIED' ? { notifiedAt: new Date() } : {}),
      },
    });
    return this.mapWaitlist(updated);
  }

  private mapWaitlist(r: {
    id: string;
    guestName: string;
    phone: string | null;
    guests: number;
    quotedMinutes: number | null;
    status: string;
    notes: string | null;
    tableId: string | null;
    seatedOrderId: string | null;
    notifiedAt: Date | null;
    seatedAt: Date | null;
    createdAt: Date;
  }) {
    const waitedMin = Math.max(
      0,
      Math.floor((Date.now() - r.createdAt.getTime()) / 60000),
    );
    return {
      id: r.id,
      guestName: r.guestName,
      phone: r.phone,
      guests: r.guests,
      quotedMinutes: r.quotedMinutes,
      status: r.status,
      notes: r.notes,
      tableId: r.tableId,
      seatedOrderId: r.seatedOrderId,
      notifiedAt: r.notifiedAt,
      seatedAt: r.seatedAt,
      createdAt: r.createdAt,
      waitedMinutes: waitedMin,
    };
  }

  async listMenu86(companyId: string) {
    const rows = await this.prisma.restoMenu86.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    const products = await this.prisma.product.findMany({
      where: {
        companyId,
        id: { in: rows.map((r) => r.productId) },
      },
      select: { id: true, name: true, nameEn: true, sku: true },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    return {
      items: rows.map((r) => ({
        id: r.id,
        productId: r.productId,
        note: r.note,
        createdAt: r.createdAt,
        product: byId.get(r.productId) || null,
      })),
    };
  }

  async setMenu86(companyId: string, dto: SetRestoMenu86Dto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const row = await this.prisma.restoMenu86.upsert({
      where: {
        companyId_productId: { companyId, productId: dto.productId },
      },
      create: {
        companyId,
        productId: dto.productId,
        note: dto.note?.trim() || null,
      },
      update: { note: dto.note?.trim() || null },
    });
    return { id: row.id, productId: row.productId, note: row.note };
  }

  async clearMenu86(companyId: string, productId: string) {
    await this.prisma.restoMenu86.deleteMany({
      where: { companyId, productId },
    });
    return { ok: true, productId };
  }

  /** Ensure every table has a guest QR token; return staff QR list */
  async ensureGuestTokens(companyId: string) {
    const tables = await this.prisma.restoTable.findMany({
      where: { companyId },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
      select: {
        id: true,
        code: true,
        name: true,
        guestToken: true,
        zone: { select: { name: true } },
      },
    });
    const out: Array<{
      id: string;
      code: string;
      name: string | null;
      zoneName: string;
      guestToken: string;
      path: string;
    }> = [];
    for (const t of tables) {
      let token = t.guestToken;
      if (!token) {
        token = randomBytes(9).toString('base64url');
        await this.prisma.restoTable.update({
          where: { id: t.id },
          data: { guestToken: token },
        });
      }
      out.push({
        id: t.id,
        code: t.code,
        name: t.name,
        zoneName: t.zone.name,
        guestToken: token,
        path: `/order/${token}`,
      });
    }
    return { count: out.length, tables: out };
  }

  async clearGuestCall(companyId: string, tableId: string) {
    const table = await this.prisma.restoTable.findFirst({
      where: { id: tableId, companyId },
    });
    if (!table) throw new NotFoundException('Table not found');
    await this.prisma.restoTable.update({
      where: { id: tableId },
      data: { guestCallAt: null, guestCallType: null },
    });
    return { ok: true, tableId };
  }

  private async loadTableByGuestToken(token: string) {
    const clean = token.trim();
    if (!clean) throw new NotFoundException('Invalid table link');
    const table = await this.prisma.restoTable.findFirst({
      where: { guestToken: clean },
      include: {
        zone: { select: { name: true, nameEn: true } },
        company: {
          select: {
            id: true,
            name: true,
            logo: true,
            currency: true,
            restoLinkedAt: true,
            restoWarehouseId: true,
          },
        },
      },
    });
    if (!table || !table.company.restoLinkedAt) {
      throw new NotFoundException('Table menu not available');
    }
    return table;
  }

  /** Public guest session: company + table + menu + open check summary */
  async getPublicGuestSession(token: string) {
    const table = await this.loadTableByGuestToken(token);
    const menu = await this.getMenu(table.companyId);
    const open = await this.prisma.restoOrder.findFirst({
      where: {
        companyId: table.companyId,
        tableId: table.id,
        status: { in: ACTIVE_ORDER },
      },
      include: {
        items: {
          where: { status: { not: RestoOrderItemStatus.CANCELLED } },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            qty: true,
            unitPrice: true,
            notes: true,
            status: true,
            course: true,
          },
        },
      },
    });
    return {
      company: {
        id: table.company.id,
        name: table.company.name,
        logo: table.company.logo,
        currency: table.company.currency || 'OMR',
      },
      table: {
        id: table.id,
        code: table.code,
        name: table.name,
        seats: table.seats,
        zoneName: table.zone.name,
      },
      menu: menu.items.map((p) => ({
        id: p.id,
        name: p.name,
        nameEn: p.nameEn,
        price: p.price,
        category: p.category,
        image: p.image,
        images: p.images,
      })),
      modifiers: (await this.listModifiers(table.companyId)).modifiers,
      openOrder: open
        ? {
            id: open.id,
            number: open.number,
            status: open.status,
            items: open.items.map((i) => ({
              id: i.id,
              name: i.name,
              qty: Number(i.qty),
              unitPrice: Number(i.unitPrice),
              lineTotal: Number(i.qty) * Number(i.unitPrice),
              notes: i.notes,
              status: i.status,
              course: i.course ?? 1,
            })),
            subtotal: open.items.reduce(
              (s, i) => s + Number(i.qty) * Number(i.unitPrice),
              0,
            ),
          }
        : null,
    };
  }

  async publicAddItems(token: string, dto: PublicGuestOrderDto) {
    if (!dto.items?.length) {
      throw new BadRequestException('Add at least one item');
    }
    if (dto.items.length > 30) {
      throw new BadRequestException('Too many items in one request');
    }
    const table = await this.loadTableByGuestToken(token);
    let order = await this.prisma.restoOrder.findFirst({
      where: {
        companyId: table.companyId,
        tableId: table.id,
        status: { in: ACTIVE_ORDER },
      },
    });
    if (!order) {
      const opened = await this.openOrder(table.companyId, '', {
        tableId: table.id,
        channel: RestoOrderChannel.DINE_IN,
        guests: 2,
        notes: dto.guestNote?.trim() || 'Guest QR order',
      });
      order = await this.prisma.restoOrder.findFirst({
        where: { id: opened.id },
      });
    }
    if (!order) throw new BadRequestException('Could not open order');

    for (const line of dto.items) {
      await this.addItem(table.companyId, order.id, {
        productId: line.productId,
        qty: line.qty ?? 1,
        notes: line.notes,
        course: line.course ?? 1,
        modifiers: line.modifiers,
        source: 'GUEST',
      });
    }
    if (dto.guestNote?.trim()) {
      await this.prisma.restoOrder.update({
        where: { id: order.id },
        data: {
          notes: [order.notes, `Guest: ${dto.guestNote.trim()}`]
            .filter(Boolean)
            .join(' | '),
        },
      });
    }
    // World-class: guest lines fire to KDS immediately
    try {
      await this.sendToKitchen(table.companyId, order.id);
    } catch {
      /* no pending left / race — still return order */
    }
    this.notifyKitchen(table.companyId);
    const mapped = await this.getOrder(table.companyId, order.id);
    return {
      ok: true,
      order: {
        id: mapped.id,
        number: mapped.number,
        status: mapped.status,
        items: mapped.items,
        subtotal: mapped.subtotal,
      },
      message: 'Sent to kitchen',
      firedToKitchen: true,
    };
  }

  async publicCallStaff(token: string, dto: PublicGuestCallDto) {
    const table = await this.loadTableByGuestToken(token);
    await this.prisma.restoTable.update({
      where: { id: table.id },
      data: {
        guestCallAt: new Date(),
        guestCallType: dto.type,
      },
    });
    return {
      ok: true,
      type: dto.type,
      tableCode: table.code,
      message: 'Staff notified',
    };
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
