import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import {
  PaymentMethod,
  Prisma,
  ContactType,
  RestoOrderChannel,
  RestoOrderItemStatus,
  RestoOrderStatus,
  RestoTableStatus,
  UserRole,
} from '@prisma/client';
import { Observable, Subject, from, interval, merge, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { PosService } from '../pos/pos.service';
import { PosIncentivesService } from '../pos/pos-incentives.service';
import { DualControlService } from '../dual-control/dual-control.service';
import { DualApprovalDto } from '../dual-control/dto/approval.dto';
import { TokenPayload } from '../auth/interfaces/token-payload.interface';
import {
  dialCodeForCountry,
  isValidMobileE164,
  toE164Digits,
} from '../common/phone';
import {
  AddRestoOrderItemDto,
  AttachRestoLoyaltyDto,
  CloseRestoOrderDto,
  CreateRestoModifierDto,
  CreateRestoReservationDto,
  CreateRestoStationDto,
  CreateRestoTableDto,
  CreateRestoWaitlistDto,
  CreateRestoZoneDto,
  CreateRestoPayLinkDto,
  MergeRestoOrderDto,
  OpenRestoOrderDto,
  PublicGuestPayDto,
  PublicGuestLoyaltyDto,
  SetRestoMenu86Dto,
  SetRestoProductAllergensDto,
  SetRestoProductDietaryDto,
  SetRestoProductDayPartsDto,
  RESTO_ALLERGEN_CODES,
  RESTO_DIETARY_TAGS,
  RESTO_DAY_PARTS,
  SplitRestoOrderDto,
  TransferRestoOrderDto,
  UpdateRestoOrderDto,
  UpdateRestoOrderItemDto,
  UpdateRestoDeliveryDto,
  UpsertRestoRecipeDto,
  PublicGuestOrderDto,
  PublicGuestCallDto,
  AssignRestoSectionDto,
  UpdateRestoConfigDto,
  IngestExternalRestoOrderDto,
  SettleRestoBySeatDto,
  SettleRestoEqualDto,
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

const RESTO_SERVER_ROLES: UserRole[] = [
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.RESTO_MANAGER,
  UserRole.WAITER,
  UserRole.CASHIER,
];

@Injectable()
export class RestoService {
  private readonly kitchenBuses = new Map<string, Subject<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly pos: PosService,
    private readonly incentives: PosIncentivesService,
    private readonly dualControl: DualControlService,
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

  /** Default day-part windows (hour start inclusive, end exclusive; late wraps). */
  private static readonly DEFAULT_DAY_PARTS: Record<
    (typeof RESTO_DAY_PARTS)[number],
    { start: number; end: number }
  > = {
    breakfast: { start: 5, end: 11 },
    lunch: { start: 11, end: 16 },
    dinner: { start: 16, end: 22 },
    late: { start: 22, end: 5 },
  };

  private hourInZone(timeZone: string, now = new Date()): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
      hour12: false,
    }).formatToParts(now);
    let hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    if (hour === 24) hour = 0;
    return hour;
  }

  private hourInWindow(hour: number, start: number, end: number): boolean {
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  private normalizeDayPartWindow(
    raw: unknown,
    fallback: { start: number; end: number },
  ): { start: number; end: number } {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
    const o = raw as Record<string, unknown>;
    const start = Number(o.start);
    const end = Number(o.end);
    if (
      !Number.isInteger(start) ||
      !Number.isInteger(end) ||
      start < 0 ||
      start > 23 ||
      end < 0 ||
      end > 23
    ) {
      return fallback;
    }
    return { start, end };
  }

  private parseRestoConfig(raw: unknown): {
    dayParts: Record<
      (typeof RESTO_DAY_PARTS)[number],
      { start: number; end: number }
    >;
  } {
    const base = { ...RestoService.DEFAULT_DAY_PARTS };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { dayParts: base };
    }
    const cfg = raw as Record<string, unknown>;
    const dp =
      cfg.dayParts && typeof cfg.dayParts === 'object' && !Array.isArray(cfg.dayParts)
        ? (cfg.dayParts as Record<string, unknown>)
        : {};
    return {
      dayParts: {
        breakfast: this.normalizeDayPartWindow(
          dp.breakfast,
          base.breakfast,
        ),
        lunch: this.normalizeDayPartWindow(dp.lunch, base.lunch),
        dinner: this.normalizeDayPartWindow(dp.dinner, base.dinner),
        late: this.normalizeDayPartWindow(dp.late, base.late),
      },
    };
  }

  /** Resolve breakfast|lunch|dinner|late from local hour (0–23) using schedule. */
  resolveDayPart(
    hour = new Date().getHours(),
    schedule?: Record<
      (typeof RESTO_DAY_PARTS)[number],
      { start: number; end: number }
    >,
  ): (typeof RESTO_DAY_PARTS)[number] {
    const windows = schedule || RestoService.DEFAULT_DAY_PARTS;
    for (const key of RESTO_DAY_PARTS) {
      if (this.hourInWindow(hour, windows[key].start, windows[key].end)) {
        return key;
      }
    }
    return 'late';
  }

  async resolveDayPartForCompany(companyId: string): Promise<{
    dayPart: (typeof RESTO_DAY_PARTS)[number];
    hour: number;
    timezone: string;
    dayParts: Record<
      (typeof RESTO_DAY_PARTS)[number],
      { start: number; end: number }
    >;
  }> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true, restoConfig: true },
    });
    const timezone = company?.timezone || 'Asia/Muscat';
    const parsed = this.parseRestoConfig(company?.restoConfig);
    const hour = this.hourInZone(timezone);
    return {
      dayPart: this.resolveDayPart(hour, parsed.dayParts),
      hour,
      timezone,
      dayParts: parsed.dayParts,
    };
  }

  async getRestoConfig(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true, restoConfig: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const parsed = this.parseRestoConfig(company.restoConfig);
    const hour = this.hourInZone(company.timezone || 'Asia/Muscat');
    return {
      timezone: company.timezone || 'Asia/Muscat',
      dayParts: parsed.dayParts,
      currentDayPart: this.resolveDayPart(hour, parsed.dayParts),
      currentHour: hour,
      defaults: RestoService.DEFAULT_DAY_PARTS,
    };
  }

  async updateRestoConfig(companyId: string, dto: UpdateRestoConfigDto) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, restoConfig: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const current = this.parseRestoConfig(company.restoConfig);
    const nextDayParts = { ...current.dayParts };
    if (dto.dayParts) {
      for (const key of RESTO_DAY_PARTS) {
        const w = dto.dayParts[key];
        if (w) {
          nextDayParts[key] = {
            start: Number(w.start),
            end: Number(w.end),
          };
        }
      }
    }
    const next = { dayParts: nextDayParts };
    await this.prisma.company.update({
      where: { id: companyId },
      data: { restoConfig: next as Prisma.InputJsonValue },
    });
    return this.getRestoConfig(companyId);
  }

  private async normalizeGuestPhone(companyId: string, phone: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { country: true },
    });
    const dial = dialCodeForCountry(company?.country || 'OM');
    const digits = toE164Digits(phone, dial);
    if (!isValidMobileE164(digits)) {
      throw new BadRequestException(
        'Invalid phone number — use mobile with country code',
      );
    }
    return { e164: `+${digits}`, digits };
  }

  private async findOrCreateLoyaltyContact(
    companyId: string,
    phone: string,
    name?: string,
  ) {
    const { e164, digits } = await this.normalizeGuestPhone(companyId, phone);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { country: true },
    });
    let contact = await this.prisma.contact.findFirst({
      where: {
        companyId,
        isActive: true,
        type: { in: [ContactType.CUSTOMER, ContactType.BOTH] },
        OR: [{ phone: e164 }, { phone: digits }, { phone: `00${digits}` }],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        loyaltyPoints: true,
      },
    });
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          companyId,
          type: ContactType.CUSTOMER,
          name: (name || '').trim() || `Guest ${digits.slice(-4)}`,
          phone: e164,
          country: (company?.country || 'OM').toUpperCase(),
        },
        select: {
          id: true,
          name: true,
          phone: true,
          loyaltyPoints: true,
        },
      });
    } else if (name?.trim() && contact.name.startsWith('Guest ')) {
      contact = await this.prisma.contact.update({
        where: { id: contact.id },
        data: { name: name.trim() },
        select: {
          id: true,
          name: true,
          phone: true,
          loyaltyPoints: true,
        },
      });
    }
    const pointsInfo = await this.incentives.getContactPoints(
      companyId,
      contact.id,
    );
    return { contact, pointsInfo };
  }

  async lookupLoyaltyByPhone(companyId: string, phone: string) {
    const { e164, digits } = await this.normalizeGuestPhone(companyId, phone);
    const contact = await this.prisma.contact.findFirst({
      where: {
        companyId,
        isActive: true,
        type: { in: [ContactType.CUSTOMER, ContactType.BOTH] },
        OR: [{ phone: e164 }, { phone: digits }],
      },
      select: { id: true, name: true, phone: true, loyaltyPoints: true },
    });
    if (!contact) {
      return {
        found: false,
        phone: e164,
        contactId: null,
        name: null,
        points: 0,
        customerEnabled: false,
        redeemEnabled: false,
      };
    }
    const pointsInfo = await this.incentives.getContactPoints(
      companyId,
      contact.id,
    );
    return {
      found: true,
      phone: contact.phone,
      contactId: contact.id,
      name: contact.name,
      points: pointsInfo.points,
      customerEnabled: pointsInfo.customerEnabled,
      redeemEnabled: pointsInfo.redeemEnabled,
      pointsPerUnit: pointsInfo.pointsPerUnit,
      redeemPointsPerUnit: pointsInfo.redeemPointsPerUnit,
    };
  }

  async attachLoyaltyToOrder(
    companyId: string,
    orderId: string,
    dto: AttachRestoLoyaltyDto,
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

    if (dto.contactId === null && !dto.phone) {
      await this.prisma.restoOrder.update({
        where: { id: orderId },
        data: { contactId: null },
      });
      return this.getOrder(companyId, orderId);
    }

    let contactId = dto.contactId || null;
    if (!contactId && dto.phone) {
      const { contact } = await this.findOrCreateLoyaltyContact(
        companyId,
        dto.phone,
        dto.name,
      );
      contactId = contact.id;
    }
    if (!contactId) {
      throw new BadRequestException('Provide contactId or phone');
    }
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId, isActive: true },
      select: { id: true, name: true, phone: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    await this.prisma.restoOrder.update({
      where: { id: orderId },
      data: {
        contactId: contact.id,
        guestPhone: contact.phone || order.guestPhone,
        guestName: order.guestName || contact.name,
      },
    });
    return this.getOrder(companyId, orderId);
  }

  async publicAttachLoyalty(token: string, dto: PublicGuestLoyaltyDto) {
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
        guests: 1,
      });
      order = await this.prisma.restoOrder.findFirst({
        where: { id: opened.id, companyId: table.companyId },
      });
      if (!order) throw new BadRequestException('Could not open check');
    }
    const { contact, pointsInfo } = await this.findOrCreateLoyaltyContact(
      table.companyId,
      dto.phone,
      dto.name,
    );
    await this.prisma.restoOrder.update({
      where: { id: order.id },
      data: {
        contactId: contact.id,
        guestPhone: contact.phone,
        guestName: order.guestName || contact.name,
      },
    });
    return {
      orderId: order.id,
      contactId: contact.id,
      name: contact.name,
      phone: contact.phone,
      points: pointsInfo.points,
      customerEnabled: pointsInfo.customerEnabled,
      redeemEnabled: pointsInfo.redeemEnabled,
      pointsPerUnit: pointsInfo.pointsPerUnit,
      redeemPointsPerUnit: pointsInfo.redeemPointsPerUnit,
    };
  }

  private productAvailableInDayPart(
    dayParts: string[] | null | undefined,
    dayPart: string,
  ) {
    const parts = dayParts || [];
    if (parts.length === 0) return true;
    return parts.includes(dayPart);
  }

  /** Menu = products in the linked restaurant warehouse only */
  async getMenu(
    companyId: string,
    q?: string,
    opts?: { dayPart?: string | null },
  ) {
    const warehouseId = await this.resolveWarehouseId(companyId);
    if (!warehouseId) {
      return {
        items: [],
        count: 0,
        warehouseId: null,
        needsWarehouse: true,
        dayPart: null as string | null,
        message:
          'Select a restaurant warehouse in settings — menu shows only products in that warehouse',
      };
    }

    const resolved = await this.resolveDayPartForCompany(companyId);
    let dayPart: string | null = null;
    if (opts?.dayPart === 'now' || opts?.dayPart === 'auto') {
      dayPart = resolved.dayPart;
    } else if (
      opts?.dayPart &&
      (RESTO_DAY_PARTS as readonly string[]).includes(opts.dayPart)
    ) {
      dayPart = opts.dayPart;
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
        allergens: true,
        dietaryTags: true,
        dayParts: true,
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
    let available = products.filter((p) => !eightySixMap.has(p.id));
    if (dayPart) {
      available = available.filter((p) =>
        this.productAvailableInDayPart(p.dayParts, dayPart!),
      );
    }
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
          allergens: p.allergens || [],
          dietaryTags: p.dietaryTags || [],
          dayParts: p.dayParts || [],
          hasRecipe: withRecipe.has(p.id),
          defaultStationId: route?.stationId ?? null,
          defaultStationName: route?.station?.name ?? null,
        };
      }),
      count: available.length,
      warehouseId,
      needsWarehouse: false,
      dayPart,
      currentDayPart: resolved.dayPart,
      timezone: resolved.timezone,
      dayPartSchedule: resolved.dayParts,
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

    const [zones, activeAssignments] = await Promise.all([
      this.prisma.restoZone.findMany({
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
      }),
      this.prisma.restoServerSection.findMany({
        where: { companyId, endsAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    const serverByZone = new Map(
      activeAssignments.map((a) => [
        a.zoneId,
        {
          id: a.user.id,
          name: a.user.name || a.user.email,
          assignmentId: a.id,
        },
      ]),
    );

    const mappedZones = zones.map((z) => {
      const sectionServer = serverByZone.get(z.id) || null;
      return {
        id: z.id,
        name: z.name,
        nameEn: z.nameEn,
        sectionServer,
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
          const guestItemCount = items.filter(
            (it) => it.source === 'GUEST',
          ).length;
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
      };
    });

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
    openedById?: string | null;
    tipAssigneeId?: string | null;
    contactId?: string | null;
    externalChannel?: string | null;
    externalOrderId?: string | null;
    sentAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    table?: { id: string; code: string; name: string | null; zoneId?: string } | null;
    openedBy?: { id: string; name: string; email: string } | null;
    tipAssignee?: { id: string; name: string; email: string } | null;
    contact?: {
      id: string;
      name: string;
      phone: string | null;
      loyaltyPoints?: Prisma.Decimal | number | null;
    } | null;
    items: Array<{
      id: string;
      productId: string | null;
      stationId: string | null;
      name: string;
      qty: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      notes: string | null;
      course?: number;
      seat?: number | null;
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
      seat: it.seat ?? null,
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
    const bySeat: Array<{
      seat: number | null;
      subtotal: number;
      itemIds: string[];
    }> = [];
    const sharedItems = items.filter((it) => !it.isComp && it.seat == null);
    if (sharedItems.length > 0) {
      bySeat.push({
        seat: null,
        subtotal: sharedItems.reduce((s, it) => s + it.lineTotal, 0),
        itemIds: sharedItems.map((it) => it.id),
      });
    }
    for (let s = 1; s <= (order.guests || 1); s++) {
      const seatItems = items.filter((it) => !it.isComp && it.seat === s);
      bySeat.push({
        seat: s,
        subtotal: seatItems.reduce((x, it) => x + it.lineTotal, 0),
        itemIds: seatItems.map((it) => it.id),
      });
    }
    const mapUser = (
      u: { id: string; name: string; email: string } | null | undefined,
    ) =>
      u
        ? {
            id: u.id,
            name: u.name || u.email,
            email: u.email,
          }
        : null;
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
      openedById: order.openedById ?? null,
      tipAssigneeId: order.tipAssigneeId ?? null,
      contactId: order.contactId ?? null,
      externalChannel: order.externalChannel ?? null,
      externalOrderId: order.externalOrderId ?? null,
      openedBy: mapUser(order.openedBy),
      tipAssignee: mapUser(order.tipAssignee),
      loyalty: order.contact
        ? {
            contactId: order.contact.id,
            name: order.contact.name,
            phone: order.contact.phone,
            points: Number(order.contact.loyaltyPoints || 0),
          }
        : null,
      table: order.table
        ? {
            id: order.table.id,
            code: order.table.code,
            name: order.table.name,
            zoneId: order.table.zoneId ?? null,
          }
        : null,
      sentAt: order.sentAt,
      closedAt: order.closedAt,
      createdAt: order.createdAt,
      items,
      bySeat,
      subtotal,
      total: subtotal,
      itemCount: items.length,
    };
  }

  private async loadOrder(companyId: string, orderId: string) {
    const order = await this.prisma.restoOrder.findFirst({
      where: { id: orderId, companyId },
      include: {
        table: { select: { id: true, code: true, name: true, zoneId: true } },
        openedBy: { select: { id: true, name: true, email: true } },
        tipAssignee: { select: { id: true, name: true, email: true } },
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            loyaltyPoints: true,
          },
        },
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

  private async assertRestoServerUser(companyId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
        isActive: true,
        role: { in: RESTO_SERVER_ROLES },
      },
      select: { id: true, name: true, email: true, role: true },
    });
    if (!user) {
      throw new BadRequestException(
        'Tip assignee must be an active floor staff user',
      );
    }
    return user;
  }

  /** Section server for zone → order tipAssignee → opener → closer */
  private async resolveTipAssigneeId(
    companyId: string,
    order: {
      tipAssigneeId?: string | null;
      openedById?: string | null;
      tableId?: string | null;
      table?: { zoneId?: string | null } | null;
    },
    preferredId: string | null | undefined,
    fallbackUserId: string,
  ): Promise<string> {
    if (preferredId) {
      await this.assertRestoServerUser(companyId, preferredId);
      return preferredId;
    }
    if (order.tipAssigneeId) {
      return order.tipAssigneeId;
    }
    const zoneId = order.table?.zoneId;
    if (zoneId) {
      const assignment = await this.prisma.restoServerSection.findFirst({
        where: { companyId, zoneId, endsAt: null },
        select: { userId: true },
      });
      if (assignment?.userId) return assignment.userId;
    }
    if (order.openedById) return order.openedById;
    return fallbackUserId;
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

  /**
   * Idempotent ingest from delivery aggregators (Talabat / Jahez / Careem / middleware).
   * Auth: JWT staff or company x-api-key (qk_*).
   */
  async ingestExternalOrder(
    companyId: string,
    userId: string | null,
    dto: IngestExternalRestoOrderDto,
  ) {
    const channel =
      dto.channel === RestoOrderChannel.TAKEAWAY
        ? RestoOrderChannel.TAKEAWAY
        : RestoOrderChannel.DELIVERY;
    const externalChannel = dto.externalChannel.trim().toUpperCase();
    const externalOrderId = dto.externalOrderId.trim();
    if (!externalChannel || !externalOrderId) {
      throw new BadRequestException('externalChannel and externalOrderId required');
    }

    const existing = await this.prisma.restoOrder.findFirst({
      where: { companyId, externalChannel, externalOrderId },
      select: { id: true },
    });
    if (existing) {
      const order = await this.getOrder(companyId, existing.id);
      return { ...order, idempotent: true as const };
    }

    if (!dto.items?.length) {
      throw new BadRequestException('At least one item required');
    }

    const resolved: Array<{
      productId: string;
      qty: number;
      notes?: string;
      modifiers?: AddRestoOrderItemDto['modifiers'];
    }> = [];

    for (const line of dto.items) {
      const qty = Number(line.qty) > 0 ? Number(line.qty) : 1;
      let product: { id: string } | null = null;
      if (line.productId) {
        product = await this.prisma.product.findFirst({
          where: { id: line.productId, companyId, isActive: true },
          select: { id: true },
        });
      } else if (line.sku?.trim()) {
        product = await this.prisma.product.findFirst({
          where: {
            companyId,
            isActive: true,
            sku: { equals: line.sku.trim(), mode: 'insensitive' },
          },
          select: { id: true },
        });
      } else if (line.barcode?.trim()) {
        product = await this.prisma.product.findFirst({
          where: {
            companyId,
            isActive: true,
            barcode: line.barcode.trim(),
          },
          select: { id: true },
        });
      }
      if (!product) {
        throw new BadRequestException(
          `Product not found for line (sku=${line.sku || ''} barcode=${line.barcode || ''} id=${line.productId || ''})`,
        );
      }
      resolved.push({
        productId: product.id,
        qty,
        notes: line.notes?.trim() || undefined,
        modifiers: line.modifiers,
      });
    }

    const opened = await this.openOrder(companyId, userId || '', {
      channel,
      guests: 1,
      guestName: dto.guestName,
      guestPhone: dto.guestPhone,
      deliveryAddress: dto.deliveryAddress,
      notes: [
        dto.notes?.trim(),
        `[${externalChannel} #${externalOrderId}]`,
      ]
        .filter(Boolean)
        .join(' · '),
    });

    try {
      await this.prisma.restoOrder.update({
        where: { id: opened.id },
        data: { externalChannel, externalOrderId },
      });
    } catch (err) {
      // Parallel ingest race — keep first winner, cancel this empty shell
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        await this.prisma.restoOrder
          .update({
            where: { id: opened.id },
            data: { status: RestoOrderStatus.CANCELLED, closedAt: new Date() },
          })
          .catch(() => undefined);
        const winner = await this.prisma.restoOrder.findFirst({
          where: { companyId, externalChannel, externalOrderId },
          select: { id: true },
        });
        if (winner) {
          const order = await this.getOrder(companyId, winner.id);
          return { ...order, idempotent: true as const };
        }
      }
      throw err;
    }

    for (const line of resolved) {
      await this.addItem(companyId, opened.id, {
        productId: line.productId,
        qty: line.qty,
        notes: line.notes,
        modifiers: line.modifiers,
      });
    }

    const autoSend = dto.autoSend !== false;
    if (autoSend) {
      try {
        await this.sendToKitchen(companyId, opened.id);
      } catch {
        // Items may still be pending if 86/stock blocked mid-add — return order as-is
      }
    }

    const order = await this.getOrder(companyId, opened.id);
    return { ...order, idempotent: false as const };
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
    if (order.invoiceId) {
      throw new BadRequestException(
        'Check already billed for online pay — complete payment or ask staff to reopen',
      );
    }

    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, companyId, isActive: true },
      select: { id: true, name: true, salePrice: true },
    });
    if (!product) throw new NotFoundException('Product not found');

    const eightySixed = await this.prisma.restoMenu86.findFirst({
      where: { companyId, productId: product.id },
      select: { note: true },
    });
    if (eightySixed) {
      throw new BadRequestException(
        `Item unavailable (86)${eightySixed.note ? `: ${eightySixed.note}` : ''}`,
      );
    }

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

    const seat = this.normalizeSeat(dto.seat, order.guests);

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
        seat,
        source: dto.source === 'GUEST' ? 'GUEST' : 'STAFF',
        status: RestoOrderItemStatus.PENDING,
      },
    });

    return this.getOrder(companyId, order.id);
  }

  private normalizeSeat(
    seat: number | null | undefined,
    guests: number,
  ): number | null {
    if (seat === undefined || seat === null) return null;
    const n = Math.floor(Number(seat));
    if (!Number.isFinite(n) || n < 1) {
      throw new BadRequestException('Seat must be >= 1');
    }
    if (n > Math.max(1, guests || 1)) {
      throw new BadRequestException(`Seat must be <= ${guests} guests`);
    }
    return n;
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
      include: { order: { select: { guests: true, status: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (
      item.order.status === RestoOrderStatus.CLOSED ||
      item.order.status === RestoOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order is closed');
    }
    if (item.status === RestoOrderItemStatus.CANCELLED) {
      throw new BadRequestException('Item is cancelled');
    }

    const touchesLine =
      dto.qty !== undefined ||
      dto.notes !== undefined ||
      dto.course !== undefined;
    if (touchesLine && item.status !== RestoOrderItemStatus.PENDING) {
      throw new BadRequestException('Only pending items can be edited');
    }

    let seat: number | null | undefined = undefined;
    if (dto.seat !== undefined) {
      seat = this.normalizeSeat(dto.seat, item.order.guests);
    }

    await this.prisma.restoOrderItem.update({
      where: { id: item.id },
      data: {
        ...(dto.qty !== undefined ? { qty: this.decimal(dto.qty) } : {}),
        ...(dto.notes !== undefined
          ? { notes: dto.notes?.trim() || null }
          : {}),
        ...(dto.course !== undefined ? { course: dto.course } : {}),
        ...(seat !== undefined ? { seat } : {}),
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
    let tipAssigneeId: string | null | undefined = undefined;
    if (dto.tipAssigneeId !== undefined) {
      if (dto.tipAssigneeId === null || dto.tipAssigneeId === '') {
        tipAssigneeId = null;
      } else {
        await this.assertRestoServerUser(companyId, dto.tipAssigneeId);
        tipAssigneeId = dto.tipAssigneeId;
      }
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
        ...(tipAssigneeId !== undefined ? { tipAssigneeId } : {}),
      },
    });
    if (dto.guests !== undefined) {
      await this.prisma.restoOrderItem.updateMany({
        where: {
          orderId,
          seat: { gt: dto.guests },
        },
        data: { seat: null },
      });
    }
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
   * Dual-control action: RESTO_VOID (same gate for void and comp).
   */
  async voidItem(
    companyId: string,
    actor: TokenPayload,
    orderId: string,
    itemId: string,
    reason: string,
    comp = false,
    approval?: DualApprovalDto,
  ) {
    await this.dualControl.assertApproved(
      companyId,
      actor,
      'RESTO_VOID',
      approval,
    );

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
          voidedById: actor.sub,
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
          voidedById: actor.sub,
          notes: [item.notes, `VOID: ${reasonText}`].filter(Boolean).join(' — '),
        },
      });
    }
    await this.refreshOrderStatus(companyId, orderId);
    this.notifyKitchen(companyId);
    return this.getOrder(companyId, orderId);
  }

  async setProductAllergens(
    companyId: string,
    productId: string,
    dto: SetRestoProductAllergensDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const allowed = new Set<string>(RESTO_ALLERGEN_CODES);
    const unique = [
      ...new Set(
        (dto.allergens || [])
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const invalid = unique.filter((c) => !allowed.has(c));
    if (invalid.length) {
      throw new BadRequestException(
        `Invalid allergen code(s): ${invalid.join(', ')}`,
      );
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { allergens: unique },
    });
    return { productId, allergens: unique };
  }

  async setProductDietary(
    companyId: string,
    productId: string,
    dto: SetRestoProductDietaryDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const allowed = new Set<string>(RESTO_DIETARY_TAGS);
    const unique = [
      ...new Set(
        (dto.dietaryTags || [])
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const invalid = unique.filter((c) => !allowed.has(c));
    if (invalid.length) {
      throw new BadRequestException(
        `Invalid dietary tag(s): ${invalid.join(', ')}`,
      );
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { dietaryTags: unique },
    });
    return { productId, dietaryTags: unique };
  }

  async setProductDayParts(
    companyId: string,
    productId: string,
    dto: SetRestoProductDayPartsDto,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, companyId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const allowed = new Set<string>(RESTO_DAY_PARTS);
    const unique = [
      ...new Set(
        (dto.dayParts || [])
          .map((a) => a.trim().toLowerCase())
          .filter(Boolean),
      ),
    ];
    const invalid = unique.filter((c) => !allowed.has(c));
    if (invalid.length) {
      throw new BadRequestException(
        `Invalid day part(s): ${invalid.join(', ')}`,
      );
    }
    await this.prisma.product.update({
      where: { id: productId },
      data: { dayParts: unique },
    });
    return { productId, dayParts: unique };
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
            notes: true,
            guestName: true,
            channel: true,
            table: { select: { id: true, code: true, name: true } },
          },
        },
      },
      take: 200,
    });

    const productIds = [
      ...new Set(
        items
          .map((i) => i.productId)
          .filter((id): id is string => !!id),
      ),
    ];
    const products =
      productIds.length > 0
        ? await this.prisma.product.findMany({
            where: { companyId, id: { in: productIds } },
            select: { id: true, allergens: true, nameEn: true },
          })
        : [];
    const allergenByProduct = new Map(
      products.map((p) => [p.id, p.allergens || []]),
    );
    const nameEnByProduct = new Map(
      products.map((p) => [p.id, p.nameEn || null]),
    );

    return {
      count: items.length,
      stations,
      stationId: stationId || null,
      items: items.map((it) => ({
        id: it.id,
        name: it.name,
        nameEn: it.productId
          ? nameEnByProduct.get(it.productId) || null
          : null,
        qty: Number(it.qty),
        notes: it.notes,
        course: it.course ?? 1,
        source: it.source === 'GUEST' ? 'GUEST' : 'STAFF',
        status: it.status,
        sentAt: it.sentAt,
        stationId: it.stationId,
        stationName: it.station?.name ?? null,
        allergens: it.productId
          ? allergenByProduct.get(it.productId) || []
          : [],
        orderId: it.order.id,
        orderNumber: it.order.number,
        orderNotes: it.order.notes,
        guestName: it.order.guestName,
        channel: it.order.channel,
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
   * Pay one seat: carve seat lines onto a child takeaway check, then close it.
   * Remaining seats stay open on the original table check.
   */
  async settleBySeat(
    companyId: string,
    actor: TokenPayload,
    orderId: string,
    dto: SettleRestoBySeatDto,
  ) {
    const order = await this.loadOrder(companyId, orderId);
    if (!ACTIVE_ORDER.includes(order.status)) {
      throw new BadRequestException('Order is not active');
    }
    const seat = this.normalizeSeat(dto.seat, order.guests);
    if (seat == null) {
      throw new BadRequestException('Seat required');
    }
    const seatItemIds = order.items
      .filter(
        (i) =>
          i.seat === seat &&
          !i.isComp &&
          i.status !== RestoOrderItemStatus.CANCELLED,
      )
      .map((i) => i.id);
    if (seatItemIds.length === 0) {
      throw new BadRequestException(`No billable items on seat ${seat}`);
    }
    const otherBillable = order.items.filter(
      (i) =>
        !i.isComp &&
        i.status !== RestoOrderItemStatus.CANCELLED &&
        !seatItemIds.includes(i.id),
    );
    const closeDto: CloseRestoOrderDto = {
      paymentMethod: dto.paymentMethod || PaymentMethod.CASH,
      payments: dto.payments,
      tipAmount: dto.tipAmount,
      tipAssigneeId: dto.tipAssigneeId,
      serviceChargePct: dto.serviceChargePct,
      contactId: dto.contactId || order.contactId || undefined,
      loyaltyPointsToRedeem: dto.loyaltyPointsToRedeem,
    };

    if (otherBillable.length === 0) {
      const closed = await this.closeOrder(companyId, actor, orderId, closeDto);
      return { source: null, closed, mode: 'full' as const };
    }

    const split = await this.splitOrder(companyId, orderId, actor.sub, {
      itemIds: seatItemIds,
      guests: 1,
    });
    await this.prisma.restoOrder.update({
      where: { id: split.split.id },
      data: {
        notes: `Seat ${seat} · split from ${order.number}`,
        guestName: order.guestName,
        guestPhone: order.guestPhone,
        contactId: order.contactId,
      },
    });
    const closed = await this.closeOrder(
      companyId,
      actor,
      split.split.id,
      closeDto,
    );
    return {
      source: await this.getOrder(companyId, orderId),
      closed,
      mode: 'seat' as const,
      seat,
    };
  }

  /** Equal N-way tender on one paid close (single invoice). */
  async settleEqual(
    companyId: string,
    actor: TokenPayload,
    orderId: string,
    dto: SettleRestoEqualDto,
  ) {
    const order = await this.loadOrder(companyId, orderId);
    if (!ACTIVE_ORDER.includes(order.status)) {
      throw new BadRequestException('Order is not active');
    }
    const parts = Math.floor(Number(dto.parts) || 0);
    if (parts < 2 || parts > 20) {
      throw new BadRequestException('parts must be 2–20');
    }
    const billable = order.items.filter(
      (i) => !i.isComp && i.status !== RestoOrderItemStatus.CANCELLED,
    );
    if (billable.length === 0) {
      throw new BadRequestException('No billable items');
    }
    const subtotal = billable.reduce(
      (s, i) => s + Number(i.qty) * Number(i.unitPrice),
      0,
    );
    let serviceCharge = 0;
    if (dto.serviceChargePct != null && dto.serviceChargePct > 0) {
      serviceCharge = (subtotal * Number(dto.serviceChargePct)) / 100;
    }
    const tip = Number(dto.tipAmount) || 0;
    const due = Number((subtotal + serviceCharge + tip).toFixed(3));
    const amounts = this.splitAmountEqual(due, parts);
    const method = dto.paymentMethod || PaymentMethod.CASH;
    return this.closeOrder(companyId, actor, orderId, {
      payments: amounts.map((amount) => ({ method, amount })),
      tipAmount: tip || undefined,
      tipAssigneeId: dto.tipAssigneeId,
      serviceChargePct: dto.serviceChargePct,
      contactId: dto.contactId || order.contactId || undefined,
      loyaltyPointsToRedeem: dto.loyaltyPointsToRedeem,
    });
  }

  private splitAmountEqual(total: number, parts: number): number[] {
    const cents = Math.round(Number(total) * 1000);
    const each = Math.floor(cents / parts);
    const rem = cents % parts;
    return Array.from({ length: parts }, (_, i) =>
      Number(((each + (i < rem ? 1 : 0)) / 1000).toFixed(3)),
    );
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

    if (!dto.soft && order.invoiceId) {
      const existing = await this.prisma.invoice.findFirst({
        where: { id: order.invoiceId, companyId },
        select: { id: true, paymentStatus: true, status: true },
      });
      if (
        existing &&
        existing.status !== 'CANCELLED' &&
        existing.paymentStatus !== 'PAID'
      ) {
        throw new BadRequestException(
          'Online pay link already issued — guest should pay online, or cancel that invoice first',
        );
      }
      if (existing?.paymentStatus === 'PAID') {
        return this.finalizeOrderAfterPayment(companyId, orderId);
      }
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
      const tip = Number(dto.tipAmount) || 0;
      const tipAssigneeId = await this.resolveTipAssigneeId(
        companyId,
        order,
        dto.tipAssigneeId,
        actor.sub,
      );
      const tipUser = await this.prisma.user.findFirst({
        where: { id: tipAssigneeId, companyId },
        select: { name: true, email: true },
      });
      const noteParts = [
        `Hisaby Resto ${order.number} [${order.channel}]`,
        order.guestName ? `Guest: ${order.guestName}` : '',
        order.guestPhone ? `Tel: ${order.guestPhone}` : '',
        order.deliveryAddress ? `Addr: ${order.deliveryAddress}` : '',
        serviceCharge > 0.0005
          ? `Service charge ${serviceCharge.toFixed(3)}`
          : '',
        tip > 0.0005 ? `Tip ${tip.toFixed(3)}` : '',
        tipUser
          ? `Tip → ${tipUser.name || tipUser.email}`
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
        contactId: dto.contactId || order.contactId || undefined,
        tipAmount: tip > 0.0005 ? tip : undefined,
        tipAssigneeId,
        loyaltyPointsToRedeem:
          Number(dto.loyaltyPointsToRedeem) > 0
            ? Number(dto.loyaltyPointsToRedeem)
            : undefined,
        serviceChargeAmount:
          serviceCharge > 0.0005 ? serviceCharge : undefined,
        notes: noteParts.join(' · '),
        clientSaleId: `resto-${order.id}`,
      });
      invoiceId = invoice.id;
      try {
        await this.reconcileAuto86(companyId);
      } catch {
        /* non-fatal */
      }

      await this.prisma.restoOrder.update({
        where: { id: orderId },
        data: {
          tipAssigneeId,
          ...(dto.contactId || order.contactId
            ? { contactId: dto.contactId || order.contactId }
            : {}),
        },
      });
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

  private frontendOrigin() {
    return (
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:3000'
    );
  }

  private async resolveStaffActor(
    companyId: string,
    preferredUserId?: string | null,
  ): Promise<TokenPayload> {
    if (preferredUserId) {
      const preferred = await this.prisma.user.findFirst({
        where: { id: preferredUserId, companyId, isActive: true },
        select: { id: true, email: true, role: true },
      });
      if (preferred) {
        return {
          sub: preferred.id,
          email: preferred.email,
          role: preferred.role,
          companyId,
        };
      }
    }
    const fallback = await this.prisma.user.findFirst({
      where: {
        companyId,
        isActive: true,
        role: {
          in: [
            UserRole.ADMIN,
            UserRole.MANAGER,
            UserRole.RESTO_MANAGER,
            UserRole.WAITER,
            UserRole.CASHIER,
          ],
        },
      },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, role: true },
    });
    if (!fallback) {
      throw new BadRequestException('No staff user available to bill this order');
    }
    return {
      sub: fallback.id,
      email: fallback.email,
      role: fallback.role,
      companyId,
    };
  }

  /**
   * Bill the check via partner online pay — keep table occupied until webhook marks PAID.
   */
  async createPayLink(
    companyId: string,
    actor: TokenPayload,
    orderId: string,
    dto: CreateRestoPayLinkDto = {},
  ) {
    const order = await this.loadOrder(companyId, orderId);
    if (
      order.status === RestoOrderStatus.CLOSED ||
      order.status === RestoOrderStatus.CANCELLED
    ) {
      throw new BadRequestException('Order is closed');
    }

    if (order.invoiceId) {
      const existing = await this.prisma.invoice.findFirst({
        where: { id: order.invoiceId, companyId },
        select: { id: true, paymentStatus: true, status: true, total: true },
      });
      if (existing?.paymentStatus === 'PAID') {
        await this.finalizeOrderAfterPayment(companyId, orderId);
        return {
          orderId,
          invoiceId: existing.id,
          payUrl: null as string | null,
          alreadyPaid: true,
          total: Number(existing.total),
        };
      }
      if (existing && existing.status !== 'CANCELLED') {
        return {
          orderId,
          invoiceId: existing.id,
          payUrl: `${this.frontendOrigin()}/pay/${existing.id}`,
          alreadyPaid: false,
          total: Number(existing.total),
        };
      }
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
      throw new BadRequestException('No billable items for online pay');
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
    const tip = Number(dto.tipAmount) || 0;
    const tipAssigneeId = await this.resolveTipAssigneeId(
      companyId,
      order,
      dto.tipAssigneeId,
      actor.sub,
    );
    const tipUser = await this.prisma.user.findFirst({
      where: { id: tipAssigneeId, companyId },
      select: { name: true, email: true },
    });
    const noteParts = [
      `Hisaby Resto ${order.number} [${order.channel}]`,
      'PARTNER_PAY table QR',
      order.guestName ? `Guest: ${order.guestName}` : '',
      order.guestPhone ? `Tel: ${order.guestPhone}` : '',
      serviceCharge > 0.0005
        ? `Service charge ${serviceCharge.toFixed(3)}`
        : '',
      tip > 0.0005 ? `Tip ${tip.toFixed(3)}` : '',
      tipUser ? `Tip → ${tipUser.name || tipUser.email}` : '',
    ].filter(Boolean);

    const invoice = await this.pos.createSale(companyId, actor, {
      items: lines.map((i) => ({
        productId: i.productId as string,
        quantity: Number(i.qty),
        unitPrice: Number(i.unitPrice),
      })),
      partnerCheckout: true,
      warehouseId,
      contactId: dto.contactId || order.contactId || undefined,
      tipAmount: tip > 0.0005 ? tip : undefined,
      tipAssigneeId,
      serviceChargeAmount:
        serviceCharge > 0.0005 ? serviceCharge : undefined,
      notes: noteParts.join(' · '),
      clientSaleId: `resto-${order.id}`,
    });

    await this.prisma.restoOrder.update({
      where: { id: orderId },
      data: {
        invoiceId: invoice.id,
        tipAssigneeId,
        ...(dto.contactId || order.contactId
          ? { contactId: dto.contactId || order.contactId }
          : {}),
      },
    });

    try {
      await this.reconcileAuto86(companyId);
    } catch {
      /* non-fatal */
    }

    return {
      orderId,
      invoiceId: invoice.id,
      payUrl: `${this.frontendOrigin()}/pay/${invoice.id}`,
      alreadyPaid: false,
      total: Number(invoice.total),
    };
  }

  async publicCreatePayLink(token: string, dto: PublicGuestPayDto = {}) {
    const table = await this.loadTableByGuestToken(token);
    const order = await this.prisma.restoOrder.findFirst({
      where: {
        companyId: table.companyId,
        tableId: table.id,
        status: { in: ACTIVE_ORDER },
      },
    });
    if (!order) {
      throw new BadRequestException('No open check on this table');
    }
    const actor = await this.resolveStaffActor(
      table.companyId,
      order.openedById,
    );
    return this.createPayLink(table.companyId, actor, order.id, {
      tipAmount: dto.tipAmount,
      serviceChargePct: dto.serviceChargePct,
    });
  }

  /** Called after online invoice is PAID — free table without double-billing */
  async finalizeOrderAfterPayment(companyId: string, orderId: string) {
    const order = await this.prisma.restoOrder.findFirst({
      where: { id: orderId, companyId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status === RestoOrderStatus.CLOSED) {
      return this.getOrder(companyId, orderId);
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.restoOrder.update({
        where: { id: orderId },
        data: {
          status: RestoOrderStatus.CLOSED,
          closedAt: new Date(),
          ...(order.channel === RestoOrderChannel.DELIVERY
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
    return this.getOrder(companyId, orderId);
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
        items: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 5000,
    });

    let revenue = 0;
    let closed = 0;
    let cancelled = 0;
    let openNow = 0;
    let paidCloses = 0;
    const prepSamples: number[] = [];
    const turnSamples: number[] = [];
    const byHour = new Map<number, { orders: number; revenue: number }>();
    const byTable = new Map<
      string,
      { label: string; orders: number; revenue: number; turnSum: number; turnN: number }
    >();
    const byItem = new Map<string, { name: string; qty: number; revenue: number }>();
    const byStationPrep = new Map<
      string,
      { name: string; samples: number[] }
    >();
    const voidReasons = new Map<string, number>();

    let sentLines = 0;
    let voidLines = 0;
    let compLines = 0;

    const percentile = (sorted: number[], p: number) => {
      if (!sorted.length) return 0;
      const idx = Math.min(
        sorted.length - 1,
        Math.max(0, Math.ceil((p / 100) * sorted.length) - 1),
      );
      return Number(sorted[idx].toFixed(1));
    };

    for (const order of orders) {
      if (order.status === RestoOrderStatus.CLOSED) closed += 1;
      else if (order.status === RestoOrderStatus.CANCELLED) cancelled += 1;
      else if (ACTIVE_ORDER.includes(order.status)) openNow += 1;

      const hour = order.createdAt.getHours();
      const hourRow = byHour.get(hour) || { orders: 0, revenue: 0 };
      hourRow.orders += 1;

      const activeItems = order.items.filter(
        (i) => i.status !== RestoOrderItemStatus.CANCELLED,
      );
      const billableItems = activeItems.filter((i) => !i.isComp);
      const orderRevenue = billableItems.reduce(
        (s, i) => s + Number(i.qty) * Number(i.unitPrice),
        0,
      );

      const paidClose =
        order.status === RestoOrderStatus.CLOSED && !!order.invoiceId;
      if (paidClose) {
        revenue += orderRevenue;
        paidCloses += 1;
        hourRow.revenue += orderRevenue;

        if (
          order.channel === RestoOrderChannel.DINE_IN &&
          order.closedAt &&
          order.tableId
        ) {
          const turnMin =
            (order.closedAt.getTime() - order.createdAt.getTime()) / 60000;
          if (turnMin >= 5 && turnMin <= 360) {
            turnSamples.push(turnMin);
          }
        }
      }
      byHour.set(hour, hourRow);

      const tableKey = order.table?.id || 'none';
      const tableLabel = order.table
        ? order.table.code
        : order.channel === 'TAKEAWAY'
          ? 'TAKEAWAY'
          : order.channel === 'DELIVERY'
            ? 'DELIVERY'
            : '—';
      const tableRow = byTable.get(tableKey) || {
        label: tableLabel,
        orders: 0,
        revenue: 0,
        turnSum: 0,
        turnN: 0,
      };
      tableRow.orders += 1;
      if (paidClose) {
        tableRow.revenue += orderRevenue;
        if (
          order.channel === RestoOrderChannel.DINE_IN &&
          order.closedAt
        ) {
          const turnMin =
            (order.closedAt.getTime() - order.createdAt.getTime()) / 60000;
          if (turnMin >= 5 && turnMin <= 360) {
            tableRow.turnSum += turnMin;
            tableRow.turnN += 1;
          }
        }
      }
      byTable.set(tableKey, tableRow);

      for (const item of order.items) {
        const wasSent =
          !!item.sentAt ||
          item.status !== RestoOrderItemStatus.PENDING;
        if (wasSent) sentLines += 1;
        if (item.status === RestoOrderItemStatus.CANCELLED && item.voidedAt) {
          voidLines += 1;
          const reason = (item.voidReason || '—').trim().slice(0, 80) || '—';
          voidReasons.set(reason, (voidReasons.get(reason) || 0) + 1);
        }
        if (item.isComp) {
          compLines += 1;
        }

        if (!paidClose) continue;
        if (item.status === RestoOrderItemStatus.CANCELLED || item.isComp) {
          continue;
        }

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
          if (mins >= 0 && mins < 240) {
            prepSamples.push(mins);
            const stationKey = item.stationId || 'none';
            const stationName = item.stationId || '—';
            const st = byStationPrep.get(stationKey) || {
              name: stationName,
              samples: [],
            };
            st.samples.push(mins);
            byStationPrep.set(stationKey, st);
          }
        }
      }
    }

    // Resolve station names for prep-by-station
    const stationIds = [...byStationPrep.keys()].filter((id) => id !== 'none');
    const stationRows =
      stationIds.length > 0
        ? await this.prisma.restoStation.findMany({
            where: { companyId, id: { in: stationIds } },
            select: { id: true, name: true },
          })
        : [];
    const stationNameById = new Map(stationRows.map((s) => [s.id, s.name]));

    const prepSorted = [...prepSamples].sort((a, b) => a - b);
    const avgPrepMinutes =
      prepSamples.length > 0
        ? Number(
            (
              prepSamples.reduce((s, n) => s + n, 0) / prepSamples.length
            ).toFixed(1),
          )
        : 0;
    const avgTableTurnMinutes =
      turnSamples.length > 0
        ? Number(
            (
              turnSamples.reduce((s, n) => s + n, 0) / turnSamples.length
            ).toFixed(1),
          )
        : 0;
    const avgTicket =
      paidCloses > 0 ? Number((revenue / paidCloses).toFixed(3)) : 0;
    const voidRate =
      sentLines > 0
        ? Number(((voidLines / sentLines) * 100).toFixed(1))
        : 0;
    const compRate =
      sentLines > 0
        ? Number(((compLines / sentLines) * 100).toFixed(1))
        : 0;

    // Tips / service charge from linked POS invoices
    const paidInvoiceIds = orders
      .filter(
        (o) =>
          o.status === RestoOrderStatus.CLOSED &&
          !!o.invoiceId,
      )
      .map((o) => o.invoiceId as string);
    const invoices =
      paidInvoiceIds.length > 0
        ? await this.prisma.invoice.findMany({
            where: { companyId, id: { in: paidInvoiceIds } },
            select: {
              id: true,
              customFieldsJson: true,
              items: { select: { description: true, unitPrice: true, quantity: true } },
            },
          })
        : [];
    const tipByInvoice = new Map<string, number>();
    const serviceByInvoice = new Map<string, number>();
    for (const inv of invoices) {
      const fields =
        inv.customFieldsJson &&
        typeof inv.customFieldsJson === 'object' &&
        !Array.isArray(inv.customFieldsJson)
          ? (inv.customFieldsJson as Record<string, unknown>)
          : {};
      let tip =
        typeof fields.tipAmount === 'number'
          ? fields.tipAmount
          : Number(fields.tipAmount) || 0;
      let service =
        typeof fields.serviceChargeAmount === 'number'
          ? fields.serviceChargeAmount
          : Number(fields.serviceChargeAmount) || 0;
      if (!(tip > 0.0005)) {
        for (const li of inv.items || []) {
          const d = String(li.description || '').toLowerCase();
          if (d.includes('tip') || d.includes('بقشيش')) {
            tip += Number(li.unitPrice) * Number(li.quantity);
          }
        }
      }
      if (!(service > 0.0005)) {
        for (const li of inv.items || []) {
          const d = String(li.description || '').toLowerCase();
          if (d.includes('service charge') || d.includes('رسوم خدمة')) {
            service += Number(li.unitPrice) * Number(li.quantity);
          }
        }
      }
      tipByInvoice.set(inv.id, tip);
      serviceByInvoice.set(inv.id, service);
    }

    let tipsTotal = 0;
    let serviceChargesTotal = 0;
    let tippedCloses = 0;
    const byServerTips = new Map<
      string,
      { userId: string | null; tips: number; orders: number }
    >();

    for (const order of orders) {
      if (
        order.status !== RestoOrderStatus.CLOSED ||
        !order.invoiceId
      ) {
        continue;
      }
      const tip = tipByInvoice.get(order.invoiceId) || 0;
      const service = serviceByInvoice.get(order.invoiceId) || 0;
      tipsTotal += tip;
      serviceChargesTotal += service;
      if (tip > 0.0005) tippedCloses += 1;

      const key = order.tipAssigneeId || order.openedById || 'none';
      const row = byServerTips.get(key) || {
        userId: order.tipAssigneeId || order.openedById || null,
        tips: 0,
        orders: 0,
      };
      row.orders += 1;
      row.tips += tip;
      byServerTips.set(key, row);
    }

    const serverIds = [...byServerTips.values()]
      .map((r) => r.userId)
      .filter((id): id is string => !!id);
    const servers =
      serverIds.length > 0
        ? await this.prisma.user.findMany({
            where: { companyId, id: { in: serverIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const serverNameById = new Map(
      servers.map((u) => [u.id, u.name || u.email || u.id]),
    );

    const byServer = Array.from(byServerTips.values())
      .map((r) => ({
        userId: r.userId,
        name: r.userId
          ? serverNameById.get(r.userId) || r.userId
          : '—',
        tips: Number(r.tips.toFixed(3)),
        orders: r.orders,
      }))
      .sort((a, b) => b.tips - a.tips || b.orders - a.orders);

    const poolStaff = byServer.filter((s) => s.tips > 0.0005 || s.orders > 0);
    const poolCount = Math.max(1, poolStaff.filter((s) => s.userId).length || poolStaff.length);
    const equalPoolShare =
      tipsTotal > 0.0005 && poolCount > 0
        ? Number((tipsTotal / poolCount).toFixed(3))
        : 0;
    const avgTip =
      tippedCloses > 0 ? Number((tipsTotal / tippedCloses).toFixed(3)) : 0;

    return {
      from: from.toISOString(),
      to: new Date().toISOString(),
      days: safeDays,
      orders: orders.length,
      closed,
      cancelled,
      openNow,
      paidCloses,
      revenue: Number(revenue.toFixed(3)),
      avgTicket,
      avgPrepMinutes,
      prepP50: percentile(prepSorted, 50),
      prepP90: percentile(prepSorted, 90),
      avgTableTurnMinutes,
      voidLines,
      compLines,
      sentLines,
      voidRate,
      compRate,
      tipsTotal: Number(tipsTotal.toFixed(3)),
      serviceChargesTotal: Number(serviceChargesTotal.toFixed(3)),
      tippedCloses,
      avgTip,
      equalPoolShare,
      poolStaffCount: poolCount,
      byServer,
      byHour: Array.from({ length: 24 }, (_, h) => {
        const row = byHour.get(h) || { orders: 0, revenue: 0 };
        return {
          hour: h,
          orders: row.orders,
          revenue: Number(row.revenue.toFixed(3)),
        };
      }),
      byTable: Array.from(byTable.values())
        .map((r) => ({
          label: r.label,
          orders: r.orders,
          revenue: Number(r.revenue.toFixed(3)),
          avgTurnMinutes:
            r.turnN > 0 ? Number((r.turnSum / r.turnN).toFixed(1)) : null,
        }))
        .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders)
        .slice(0, 20),
      byStationPrep: Array.from(byStationPrep.entries())
        .map(([id, row]) => {
          const samples = [...row.samples].sort((a, b) => a - b);
          const avg =
            samples.length > 0
              ? Number(
                  (
                    samples.reduce((s, n) => s + n, 0) / samples.length
                  ).toFixed(1),
                )
              : 0;
          return {
            stationId: id === 'none' ? null : id,
            name: id === 'none' ? '—' : stationNameById.get(id) || row.name,
            count: samples.length,
            avg,
            p90: percentile(samples, 90),
          };
        })
        .sort((a, b) => b.count - a.count),
      voidReasons: Array.from(voidReasons.entries())
        .map(([reason, count]) => ({ reason, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
      topItems: Array.from(byItem.values())
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 15),
    };
  }

  /** Business-day flash sheet for shift handover / print */
  async getFlashReport(companyId: string) {
    const summary = await this.getReportsSummary(companyId, 1);
    const assignments = await this.listSectionAssignments(companyId);
    return {
      ...summary,
      flash: true,
      printedAt: new Date().toISOString(),
      sectionAssignments: assignments.assignments,
    };
  }

  /** Midnight in company timezone → UTC Date */
  private startOfDayInZone(timeZone: string, now = new Date()): Date {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
      hour12: false,
    }).formatToParts(now);
    const num = (type: string) =>
      Number(parts.find((p) => p.type === type)?.value || 0);
    let hour = num('hour');
    if (hour === 24) hour = 0;
    const ms =
      hour * 3600000 +
      num('minute') * 60000 +
      num('second') * 1000 +
      now.getMilliseconds();
    return new Date(now.getTime() - ms);
  }

  private tipFromInvoiceFields(
    fields: Record<string, unknown>,
    items: Array<{ description: string | null; unitPrice: unknown; quantity: unknown }>,
  ): number {
    let tip =
      typeof fields.tipAmount === 'number'
        ? fields.tipAmount
        : Number(fields.tipAmount) || 0;
    if (!(tip > 0.0005)) {
      for (const li of items || []) {
        const d = String(li.description || '').toLowerCase();
        if (d.includes('tip') || d.includes('بقشيش')) {
          tip += Number(li.unitPrice) * Number(li.quantity);
        }
      }
    }
    return tip;
  }

  /**
   * Live floor board — open checks + today's closed KPIs by section/server.
   * Poll-friendly; no new tables.
   */
  async getLiveSectionBoard(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { timezone: true, name: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const timezone = company.timezone || 'Asia/Muscat';
    const businessDayFrom = this.startOfDayInZone(timezone);
    const asOf = new Date();

    const [zones, assignments, openOrders, closedToday] = await Promise.all([
      this.prisma.restoZone.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          nameEn: true,
          tables: {
            select: {
              id: true,
              code: true,
              seats: true,
              status: true,
            },
          },
        },
      }),
      this.prisma.restoServerSection.findMany({
        where: { companyId, endsAt: null },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.restoOrder.findMany({
        where: {
          companyId,
          status: { in: ACTIVE_ORDER },
        },
        include: {
          table: { select: { id: true, code: true, zoneId: true } },
          items: {
            where: { status: { not: RestoOrderItemStatus.CANCELLED } },
            select: {
              qty: true,
              unitPrice: true,
              isComp: true,
              status: true,
            },
          },
        },
        take: 500,
      }),
      this.prisma.restoOrder.findMany({
        where: {
          companyId,
          status: RestoOrderStatus.CLOSED,
          invoiceId: { not: null },
          closedAt: { gte: businessDayFrom },
        },
        include: {
          table: { select: { id: true, code: true, zoneId: true } },
          items: {
            where: {
              status: { not: RestoOrderItemStatus.CANCELLED },
              isComp: false,
            },
            select: { qty: true, unitPrice: true },
          },
        },
        take: 3000,
      }),
    ]);

    const serverByZone = new Map(
      assignments.map((a) => [
        a.zoneId,
        {
          id: a.user.id,
          name: a.user.name || a.user.email,
        },
      ]),
    );

    const invoiceIds = closedToday
      .map((o) => o.invoiceId)
      .filter((id): id is string => !!id);
    const invoices =
      invoiceIds.length > 0
        ? await this.prisma.invoice.findMany({
            where: { companyId, id: { in: invoiceIds } },
            select: {
              id: true,
              customFieldsJson: true,
              items: {
                select: { description: true, unitPrice: true, quantity: true },
              },
            },
          })
        : [];
    const tipByInvoice = new Map<string, number>();
    for (const inv of invoices) {
      const fields =
        inv.customFieldsJson &&
        typeof inv.customFieldsJson === 'object' &&
        !Array.isArray(inv.customFieldsJson)
          ? (inv.customFieldsJson as Record<string, unknown>)
          : {};
      tipByInvoice.set(
        inv.id,
        this.tipFromInvoiceFields(fields, inv.items || []),
      );
    }

    type SectionAcc = {
      zoneId: string;
      zoneName: string;
      zoneNameEn: string | null;
      server: { id: string; name: string } | null;
      openTables: number;
      openCovers: number;
      openChecks: number;
      openRevenue: number;
      occupiedSum: number;
      occupiedN: number;
      closedOrders: number;
      closedCovers: number;
      closedRevenue: number;
      tips: number;
    };

    const sections = new Map<string, SectionAcc>();
    for (const z of zones) {
      sections.set(z.id, {
        zoneId: z.id,
        zoneName: z.name,
        zoneNameEn: z.nameEn,
        server: serverByZone.get(z.id) || null,
        openTables: 0,
        openCovers: 0,
        openChecks: 0,
        openRevenue: 0,
        occupiedSum: 0,
        occupiedN: 0,
        closedOrders: 0,
        closedCovers: 0,
        closedRevenue: 0,
        tips: 0,
      });
    }

    const offFloor = {
      openChecks: 0,
      openCovers: 0,
      openRevenue: 0,
      closedOrders: 0,
      closedCovers: 0,
      closedRevenue: 0,
      tips: 0,
      takeawayOpen: 0,
      deliveryOpen: 0,
    };

    let houseOpenTables = 0;
    let houseOpenCovers = 0;
    let houseOpenChecks = 0;
    let houseOpenRevenue = 0;

    for (const order of openOrders) {
      const billable = order.items.filter((i) => !i.isComp);
      const rev = billable.reduce(
        (s, i) => s + Number(i.qty) * Number(i.unitPrice),
        0,
      );
      const covers = order.guests || 0;
      const occupiedMinutes = Math.max(
        0,
        Math.floor((asOf.getTime() - new Date(order.createdAt).getTime()) / 60000),
      );
      houseOpenChecks += 1;
      houseOpenCovers += covers;
      houseOpenRevenue += rev;

      const zoneId = order.table?.zoneId;
      if (zoneId && sections.has(zoneId)) {
        const sec = sections.get(zoneId)!;
        sec.openChecks += 1;
        sec.openCovers += covers;
        sec.openRevenue += rev;
        sec.openTables += 1;
        houseOpenTables += 1;
        sec.occupiedSum += occupiedMinutes;
        sec.occupiedN += 1;
      } else {
        offFloor.openChecks += 1;
        offFloor.openCovers += covers;
        offFloor.openRevenue += rev;
        if (order.channel === RestoOrderChannel.TAKEAWAY) {
          offFloor.takeawayOpen += 1;
        } else if (order.channel === RestoOrderChannel.DELIVERY) {
          offFloor.deliveryOpen += 1;
        }
      }
    }

    let houseClosedOrders = 0;
    let houseClosedCovers = 0;
    let houseRevenue = 0;
    let houseTips = 0;

    for (const order of closedToday) {
      const rev = order.items.reduce(
        (s, i) => s + Number(i.qty) * Number(i.unitPrice),
        0,
      );
      const tip = order.invoiceId
        ? tipByInvoice.get(order.invoiceId) || 0
        : 0;
      const covers = order.guests || 0;
      houseClosedOrders += 1;
      houseClosedCovers += covers;
      houseRevenue += rev;
      houseTips += tip;

      const zoneId = order.table?.zoneId;
      if (zoneId && sections.has(zoneId)) {
        const sec = sections.get(zoneId)!;
        sec.closedOrders += 1;
        sec.closedCovers += covers;
        sec.closedRevenue += rev;
        // Attribute tip to zone of the table (section board view)
        sec.tips += tip;
      } else {
        offFloor.closedOrders += 1;
        offFloor.closedCovers += covers;
        offFloor.closedRevenue += rev;
        offFloor.tips += tip;
      }
    }

    const sectionRows = Array.from(sections.values()).map((s) => ({
      zoneId: s.zoneId,
      zoneName: s.zoneName,
      zoneNameEn: s.zoneNameEn,
      server: s.server,
      openTables: s.openTables,
      openCovers: s.openCovers,
      openChecks: s.openChecks,
      openRevenue: Number(s.openRevenue.toFixed(3)),
      avgOccupiedMinutes:
        s.occupiedN > 0
          ? Number((s.occupiedSum / s.occupiedN).toFixed(1))
          : null,
      closedToday: {
        orders: s.closedOrders,
        covers: s.closedCovers,
        revenue: Number(s.closedRevenue.toFixed(3)),
        avgTicket:
          s.closedOrders > 0
            ? Number((s.closedRevenue / s.closedOrders).toFixed(3))
            : 0,
        tips: Number(s.tips.toFixed(3)),
      },
    }));

    return {
      asOf: asOf.toISOString(),
      businessDayFrom: businessDayFrom.toISOString(),
      timezone,
      companyName: company.name,
      house: {
        openTables: houseOpenTables,
        openCovers: houseOpenCovers,
        openChecks: houseOpenChecks,
        openRevenue: Number(houseOpenRevenue.toFixed(3)),
        closedOrders: houseClosedOrders,
        closedCovers: houseClosedCovers,
        revenue: Number(houseRevenue.toFixed(3)),
        avgTicket:
          houseClosedOrders > 0
            ? Number((houseRevenue / houseClosedOrders).toFixed(3))
            : 0,
        tipsTotal: Number(houseTips.toFixed(3)),
      },
      sections: sectionRows,
      offFloor: {
        openChecks: offFloor.openChecks,
        openCovers: offFloor.openCovers,
        openRevenue: Number(offFloor.openRevenue.toFixed(3)),
        takeawayOpen: offFloor.takeawayOpen,
        deliveryOpen: offFloor.deliveryOpen,
        closedToday: {
          orders: offFloor.closedOrders,
          covers: offFloor.closedCovers,
          revenue: Number(offFloor.closedRevenue.toFixed(3)),
          tips: Number(offFloor.tips.toFixed(3)),
        },
      },
    };
  }

  async listRestoStaff(companyId: string) {
    const users = await this.prisma.user.findMany({
      where: {
        companyId,
        isActive: true,
        role: { in: RESTO_SERVER_ROLES },
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: [{ name: 'asc' }, { email: 'asc' }],
      take: 200,
    });
    return {
      staff: users.map((u) => ({
        id: u.id,
        name: u.name || u.email,
        email: u.email,
        role: u.role,
      })),
    };
  }

  async listSectionAssignments(companyId: string) {
    const [zones, active] = await Promise.all([
      this.prisma.restoZone.findMany({
        where: { companyId },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        select: { id: true, name: true, nameEn: true },
      }),
      this.prisma.restoServerSection.findMany({
        where: { companyId, endsAt: null },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          zone: { select: { id: true, name: true, nameEn: true } },
        },
        orderBy: { startsAt: 'asc' },
      }),
    ]);
    const byZone = new Map(active.map((a) => [a.zoneId, a]));
    return {
      zones,
      assignments: zones.map((z) => {
        const a = byZone.get(z.id);
        return {
          zoneId: z.id,
          zoneName: z.name,
          zoneNameEn: z.nameEn,
          assignmentId: a?.id ?? null,
          userId: a?.userId ?? null,
          user: a?.user
            ? {
                id: a.user.id,
                name: a.user.name || a.user.email,
                email: a.user.email,
                role: a.user.role,
              }
            : null,
          startsAt: a?.startsAt ?? null,
        };
      }),
    };
  }

  async assignSection(companyId: string, dto: AssignRestoSectionDto) {
    const zone = await this.prisma.restoZone.findFirst({
      where: { id: dto.zoneId, companyId },
      select: { id: true },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    await this.assertRestoServerUser(companyId, dto.userId);

    await this.prisma.$transaction(async (tx) => {
      await tx.restoServerSection.updateMany({
        where: { companyId, zoneId: dto.zoneId, endsAt: null },
        data: { endsAt: new Date() },
      });
      await tx.restoServerSection.create({
        data: {
          companyId,
          zoneId: dto.zoneId,
          userId: dto.userId,
        },
      });
    });

    return this.listSectionAssignments(companyId);
  }

  async releaseSection(companyId: string, zoneId: string) {
    const zone = await this.prisma.restoZone.findFirst({
      where: { id: zoneId, companyId },
      select: { id: true },
    });
    if (!zone) throw new NotFoundException('Zone not found');
    await this.prisma.restoServerSection.updateMany({
      where: { companyId, zoneId, endsAt: null },
      data: { endsAt: new Date() },
    });
    return this.listSectionAssignments(companyId);
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

    // Keep floor/guest menus honest after stock moves
    try {
      await this.reconcileAuto86(companyId);
    } catch {
      /* non-fatal */
    }
  }

  private static readonly AUTO_86_PREFIX = 'AUTO:';

  private async stockQtyMap(
    productIds: string[],
    warehouseId: string | null,
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (!productIds.length) return map;
    if (warehouseId) {
      const rows = await this.prisma.warehouseStock.findMany({
        where: { warehouseId, productId: { in: productIds } },
        select: { productId: true, quantity: true },
      });
      for (const r of rows) map.set(r.productId, Number(r.quantity));
      for (const id of productIds) {
        if (!map.has(id)) map.set(id, 0);
      }
      return map;
    }
    const rows = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, quantity: true },
    });
    for (const r of rows) map.set(r.id, Number(r.quantity));
    return map;
  }

  /**
   * Auto-86 dishes that cannot be made from warehouse stock.
   * Only upserts/clears rows with note prefix AUTO: — manual 86 stays manager-owned.
   */
  async reconcileAuto86(companyId: string) {
    const warehouseId = await this.resolveWarehouseId(companyId);
    const should86 = new Map<string, string>();

    const recipes = await this.prisma.restoRecipe.findMany({
      where: { companyId },
      include: {
        items: {
          include: {
            component: {
              select: {
                id: true,
                name: true,
                sku: true,
                isTracked: true,
              },
            },
          },
        },
      },
    });

    const componentIds = [
      ...new Set(
        recipes.flatMap((r) =>
          r.items
            .filter((i) => i.component.isTracked)
            .map((i) => i.componentProductId),
        ),
      ),
    ];
    const componentStock = await this.stockQtyMap(componentIds, warehouseId);

    for (const recipe of recipes) {
      let blocking: string | null = null;
      for (const item of recipe.items) {
        if (!item.component.isTracked) continue;
        const need = Number(item.qty);
        if (!(need > 0)) continue;
        const onHand = componentStock.get(item.componentProductId) || 0;
        if (onHand + 0.0005 < need) {
          blocking = item.component.sku || item.component.name;
          break;
        }
      }
      if (blocking) {
        should86.set(
          recipe.productId,
          `${RestoService.AUTO_86_PREFIX}recipe:${blocking}`,
        );
      }
    }

    if (warehouseId) {
      const tracked = await this.prisma.product.findMany({
        where: {
          ...productWhereForWarehouse(companyId, warehouseId),
          isTracked: true,
        },
        select: { id: true, minQuantity: true, sku: true, name: true },
        take: 500,
      });
      const trackedStock = await this.stockQtyMap(
        tracked.map((p) => p.id),
        warehouseId,
      );
      for (const p of tracked) {
        if (should86.has(p.id)) continue;
        const onHand = trackedStock.get(p.id) || 0;
        const minQ = Number(p.minQuantity) || 0;
        if (onHand <= 0.0005 || (minQ > 0 && onHand + 0.0005 < minQ)) {
          should86.set(p.id, `${RestoService.AUTO_86_PREFIX}stock`);
        }
      }
    }

    const existing = await this.prisma.restoMenu86.findMany({
      where: { companyId },
    });
    let upserted = 0;
    let cleared = 0;
    let keptManual = 0;

    for (const [productId, note] of should86) {
      const row = existing.find((e) => e.productId === productId);
      if (
        row?.note &&
        !row.note.startsWith(RestoService.AUTO_86_PREFIX)
      ) {
        keptManual += 1;
        continue;
      }
      await this.prisma.restoMenu86.upsert({
        where: { companyId_productId: { companyId, productId } },
        create: { companyId, productId, note },
        update: { note },
      });
      upserted += 1;
    }

    for (const row of existing) {
      if (
        !row.note ||
        !row.note.startsWith(RestoService.AUTO_86_PREFIX)
      ) {
        continue;
      }
      if (should86.has(row.productId)) continue;
      await this.prisma.restoMenu86.delete({ where: { id: row.id } });
      cleared += 1;
    }

    if (upserted > 0 || cleared > 0) {
      this.notifyKitchen(companyId);
    }

    return {
      upserted,
      cleared,
      keptManual,
      auto86: should86.size,
      warehouseId,
    };
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
        auto: !!(r.note && r.note.startsWith(RestoService.AUTO_86_PREFIX)),
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
    const note = dto.note?.trim() || null;
    // Manual 86 must not use AUTO: prefix (reserved for stock reconcile)
    const safeNote =
      note && note.startsWith(RestoService.AUTO_86_PREFIX)
        ? note.slice(RestoService.AUTO_86_PREFIX.length) || 'manual'
        : note;
    const row = await this.prisma.restoMenu86.upsert({
      where: {
        companyId_productId: { companyId, productId: dto.productId },
      },
      create: {
        companyId,
        productId: dto.productId,
        note: safeNote,
      },
      update: { note: safeNote },
    });
    this.notifyKitchen(companyId);
    return {
      id: row.id,
      productId: row.productId,
      note: row.note,
      auto: false,
    };
  }

  async clearMenu86(companyId: string, productId: string) {
    await this.prisma.restoMenu86.deleteMany({
      where: { companyId, productId },
    });
    this.notifyKitchen(companyId);
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
    const menu = await this.getMenu(table.companyId, undefined, {
      dayPart: 'now',
    });
    const open = await this.prisma.restoOrder.findFirst({
      where: {
        companyId: table.companyId,
        tableId: table.id,
        status: { in: ACTIVE_ORDER },
      },
      include: {
        contact: {
          select: {
            id: true,
            name: true,
            phone: true,
            loyaltyPoints: true,
          },
        },
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

    let payUrl: string | null = null;
    let paymentStatus: string | null = null;
    let invoiceId: string | null = open?.invoiceId ?? null;
    if (invoiceId) {
      const inv = await this.prisma.invoice.findFirst({
        where: { id: invoiceId, companyId: table.companyId },
        select: { paymentStatus: true, status: true },
      });
      paymentStatus = inv?.paymentStatus ?? null;
      if (inv && inv.status !== 'CANCELLED' && inv.paymentStatus !== 'PAID') {
        payUrl = `${this.frontendOrigin()}/pay/${invoiceId}`;
      }
    }

    let loyalty: {
      contactId: string;
      name: string;
      phone: string | null;
      points: number;
      customerEnabled: boolean;
      redeemEnabled: boolean;
    } | null = null;
    if (open?.contact) {
      try {
        const pts = await this.incentives.getContactPoints(
          table.companyId,
          open.contact.id,
        );
        loyalty = {
          contactId: open.contact.id,
          name: open.contact.name,
          phone: open.contact.phone,
          points: pts.points,
          customerEnabled: pts.customerEnabled,
          redeemEnabled: pts.redeemEnabled,
        };
      } catch {
        loyalty = {
          contactId: open.contact.id,
          name: open.contact.name,
          phone: open.contact.phone,
          points: Number(open.contact.loyaltyPoints || 0),
          customerEnabled: false,
          redeemEnabled: false,
        };
      }
    } else {
      try {
        const cfg = await this.incentives.getConfig(table.companyId);
        if (cfg.customerEnabled) {
          loyalty = {
            contactId: '',
            name: '',
            phone: null,
            points: 0,
            customerEnabled: true,
            redeemEnabled: !!cfg.redeemEnabled,
          };
        }
      } catch {
        /* ignore */
      }
    }

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
        allergens: p.allergens || [],
        dietaryTags: p.dietaryTags || [],
        dayParts: p.dayParts || [],
      })),
      dayPart: menu.dayPart ?? (await this.resolveDayPartForCompany(table.companyId)).dayPart,
      dayPartSchedule: menu.dayPartSchedule ?? undefined,
      timezone: menu.timezone ?? undefined,
      loyalty,
      modifiers: (await this.listModifiers(table.companyId)).modifiers,
      openOrder: open
        ? {
            id: open.id,
            number: open.number,
            status: open.status,
            invoiceId,
            paymentStatus,
            payUrl,
            contactId: open.contactId,
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
    if (order.invoiceId) {
      throw new BadRequestException(
        'Check already billed — pay online or ask staff',
      );
    }

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
