import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLAN_DETAILS,
  PLAN_FEATURES,
  PlanFeatureKey,
} from '../common/plan-features';
import {
  normalizePlanAccess,
  type PlanModuleGrant,
} from '../common/plan-access-catalog';
import {
  discountFromPrices,
  yearlyFromMonthly,
} from '../common/plan-pricing';

export type PlanCatalogItem = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyDiscountPct: number;
  invoicesLimit: number;
  usersLimit: number;
  support: string;
  /** Coarse flags for existing API guards */
  features: Record<PlanFeatureKey, boolean>;
  /** Granular sidebar/POS/resto grants */
  modules: Record<string, PlanModuleGrant>;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
  currency: string;
};

@Injectable()
export class PlanCatalogService implements OnModuleInit {
  private cache: { at: number; rows: PlanCatalogItem[] } | null = null;
  private readonly ttlMs = 5 * 60_000;

  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSeeded();
  }

  invalidate() {
    this.cache = null;
  }

  async ensureSeeded() {
    const defaults: {
      code: string;
      sortOrder: number;
    }[] = [
      { code: 'STARTER', sortOrder: 1 },
      { code: 'PROFESSIONAL', sortOrder: 2 },
      { code: 'ENTERPRISE', sortOrder: 3 },
    ];
    for (const row of defaults) {
      const details = PLAN_DETAILS[row.code as keyof typeof PLAN_DETAILS];
      if (!details) continue;
      const yearlyDiscountPct = discountFromPrices(
        details.monthlyPrice,
        details.yearlyPrice,
      );
      await this.prisma.planDefinition.upsert({
        where: { code: row.code },
        create: {
          code: row.code,
          nameAr: details.nameAr,
          nameEn: details.nameEn,
          monthlyPrice: details.monthlyPrice,
          yearlyPrice: details.yearlyPrice,
          yearlyDiscountPct,
          invoicesLimit: details.invoicesLimit,
          usersLimit: details.usersLimit,
          support: details.support,
          features: {
            ...PLAN_FEATURES[row.code],
            modules: normalizePlanAccess(
              null,
              PLAN_FEATURES[row.code],
            ).modules,
          },
          isActive: true,
          isSystem: true,
          sortOrder: row.sortOrder,
        },
        update: {},
      });
    }
  }

  private mapRow(r: {
    id: string;
    code: string;
    nameAr: string;
    nameEn: string;
    monthlyPrice: { toNumber?: () => number } | number | string;
    yearlyPrice: { toNumber?: () => number } | number | string;
    yearlyDiscountPct?: { toNumber?: () => number } | number | string | null;
    invoicesLimit: number;
    usersLimit: number;
    support: string;
    features: unknown;
    isActive: boolean;
    isSystem: boolean;
    sortOrder: number;
  }): PlanCatalogItem {
    const num = (
      v: { toNumber?: () => number } | number | string | null | undefined,
    ) => {
      if (v == null) return 0;
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return Number(v);
      if (v && typeof v.toNumber === 'function') return v.toNumber();
      return Number(v);
    };
    const access = normalizePlanAccess(
      r.features as Record<string, unknown>,
      PLAN_FEATURES[r.code] || PLAN_FEATURES.STARTER,
    );
    const monthlyPrice = num(r.monthlyPrice);
    const yearlyPrice = num(r.yearlyPrice);
    let yearlyDiscountPct = num(r.yearlyDiscountPct);
    if (!yearlyDiscountPct && monthlyPrice > 0 && yearlyPrice > 0) {
      yearlyDiscountPct = discountFromPrices(monthlyPrice, yearlyPrice);
    }
    if (!yearlyDiscountPct) yearlyDiscountPct = 20;
    return {
      id: r.id,
      code: r.code,
      nameAr: r.nameAr,
      nameEn: r.nameEn,
      monthlyPrice,
      yearlyPrice,
      yearlyDiscountPct,
      invoicesLimit: r.invoicesLimit,
      usersLimit: r.usersLimit,
      support: r.support,
      features: access.legacy as Record<PlanFeatureKey, boolean>,
      modules: access.modules,
      isActive: r.isActive,
      isSystem: r.isSystem,
      sortOrder: r.sortOrder,
      currency: 'OMR',
    };
  }

  async listAll(includeInactive = false): Promise<PlanCatalogItem[]> {
    if (
      this.cache &&
      Date.now() - this.cache.at < this.ttlMs &&
      !includeInactive
    ) {
      return this.cache.rows.filter((r) => r.isActive);
    }

    await this.ensureSeeded();
    const rows = await this.prisma.planDefinition.findMany({
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    const mapped = rows.map((r) => this.mapRow(r));
    this.cache = { at: Date.now(), rows: mapped };
    return includeInactive ? mapped : mapped.filter((r) => r.isActive);
  }

  async getByCode(code: string): Promise<PlanCatalogItem | null> {
    const all = await this.listAll(true);
    return all.find((p) => p.code === code) || null;
  }

  async detailsFor(code: string) {
    const row = await this.getByCode(code);
    if (row) {
      return {
        nameAr: row.nameAr,
        nameEn: row.nameEn,
        monthlyPrice: row.monthlyPrice,
        yearlyPrice: row.yearlyPrice,
        yearlyDiscountPct: row.yearlyDiscountPct,
        invoicesLimit: row.invoicesLimit,
        usersLimit: row.usersLimit,
        support: row.support,
      };
    }
    const fallback = PLAN_DETAILS[code as keyof typeof PLAN_DETAILS];
    if (fallback) {
      return {
        ...fallback,
        yearlyDiscountPct: discountFromPrices(
          fallback.monthlyPrice,
          fallback.yearlyPrice,
        ),
      };
    }
    return {
      nameAr: code,
      nameEn: code,
      monthlyPrice: 0,
      yearlyPrice: 0,
      yearlyDiscountPct: 20,
      invoicesLimit: 50,
      usersLimit: 2,
      support: 'email',
    };
  }

  async featuresFor(code: string): Promise<Record<PlanFeatureKey, boolean>> {
    const row = await this.getByCode(code);
    if (row) return row.features;
    const access = normalizePlanAccess(
      null,
      PLAN_FEATURES[code] || PLAN_FEATURES.STARTER,
    );
    return access.legacy as Record<PlanFeatureKey, boolean>;
  }

  async modulesFor(code: string): Promise<Record<string, PlanModuleGrant>> {
    const row = await this.getByCode(code);
    if (row) return row.modules;
    return normalizePlanAccess(
      null,
      PLAN_FEATURES[code] || PLAN_FEATURES.STARTER,
    ).modules;
  }

  private packFeatures(input?: {
    features?: Record<string, boolean>;
    modules?: Record<string, PlanModuleGrant | boolean>;
  }) {
    const access = normalizePlanAccess(
      input?.modules
        ? { modules: input.modules as Record<string, unknown> }
        : (input?.features as Record<string, unknown>) || null,
      PLAN_FEATURES.STARTER,
    );
    return {
      ...access.legacy,
      modules: access.modules,
    };
  }

  async create(data: {
    code: string;
    nameAr: string;
    nameEn: string;
    monthlyPrice: number;
    yearlyPrice: number;
    yearlyDiscountPct?: number;
    invoicesLimit: number;
    usersLimit: number;
    support?: string;
    features?: Record<string, boolean>;
    modules?: Record<string, PlanModuleGrant | boolean>;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    const code = data.code
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9_]/g, '_')
      .slice(0, 32);
    if (!code) throw new Error('Invalid plan code');
    const features = this.packFeatures({
      features: data.features,
      modules: data.modules,
    });
    const yearlyDiscountPct =
      data.yearlyDiscountPct != null
        ? data.yearlyDiscountPct
        : discountFromPrices(data.monthlyPrice, data.yearlyPrice) || 20;
    const yearlyPrice =
      data.yearlyPrice > 0
        ? data.yearlyPrice
        : yearlyFromMonthly(data.monthlyPrice, yearlyDiscountPct);
    const created = await this.prisma.planDefinition.create({
      data: {
        code,
        nameAr: data.nameAr.trim(),
        nameEn: data.nameEn.trim(),
        monthlyPrice: data.monthlyPrice,
        yearlyPrice,
        yearlyDiscountPct,
        invoicesLimit: data.invoicesLimit,
        usersLimit: data.usersLimit,
        support: data.support || 'email',
        features,
        isActive: data.isActive !== false,
        isSystem: false,
        sortOrder: data.sortOrder ?? 100,
      },
    });
    this.invalidate();
    return this.mapRow(created);
  }

  async update(
    code: string,
    data: Partial<{
      nameAr: string;
      nameEn: string;
      monthlyPrice: number;
      yearlyPrice: number;
      yearlyDiscountPct: number;
      invoicesLimit: number;
      usersLimit: number;
      support: string;
      features: Record<string, boolean>;
      modules: Record<string, PlanModuleGrant | boolean>;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    const existing = await this.prisma.planDefinition.findUnique({
      where: { code },
    });
    if (!existing) throw new Error('Plan not found');
    const features =
      data.modules !== undefined || data.features !== undefined
        ? this.packFeatures({
            features: data.features,
            modules: data.modules,
          })
        : undefined;
    const updated = await this.prisma.planDefinition.update({
      where: { code },
      data: {
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
        ...(data.monthlyPrice !== undefined && {
          monthlyPrice: data.monthlyPrice,
        }),
        ...(data.yearlyPrice !== undefined && { yearlyPrice: data.yearlyPrice }),
        ...(data.yearlyDiscountPct !== undefined && {
          yearlyDiscountPct: data.yearlyDiscountPct,
        }),
        ...(data.invoicesLimit !== undefined && {
          invoicesLimit: data.invoicesLimit,
        }),
        ...(data.usersLimit !== undefined && { usersLimit: data.usersLimit }),
        ...(data.support !== undefined && { support: data.support }),
        ...(features && { features }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      },
    });
    this.invalidate();
    return this.mapRow(updated);
  }

  async remove(code: string) {
    const existing = await this.prisma.planDefinition.findUnique({
      where: { code },
    });
    if (!existing) throw new Error('Plan not found');
    if (existing.isSystem) {
      throw new Error(
        'System plans cannot be deleted — deactivate or edit features instead',
      );
    }
    const inUse = await this.prisma.company.count({
      where: { plan: code, deletedAt: null },
    });
    if (inUse > 0) {
      throw new Error(`Cannot delete: ${inUse} companies still on this plan`);
    }
    await this.prisma.planDefinition.delete({ where: { code } });
    this.invalidate();
    return { ok: true };
  }
}
