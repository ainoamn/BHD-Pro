import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_DETAILS } from '../common/plan-features';
import { PlanCatalogService } from '../subscriptions/plan-catalog.service';
import { EmailNotifyService } from '../notifications/email-notify.service';
import { buildPublicPlanHighlights } from '../common/plan-access-catalog';
import {
  getBootstrapAdminEmails,
  isBootstrapAdminEmail,
  isProtectedPlatformAdminEmail,
  PLATFORM_PERMISSIONS,
  PlatformPermission,
} from '../common/guards/platform-admin.guard';

@Injectable()
export class AdminService implements OnModuleInit {
  private publicStatsCache:
    | { at: number; data: Awaited<ReturnType<AdminService['computePublicStats']>> }
    | null = null;

  private publicLogosCache:
    | {
        at: number;
        data: {
          companies: { id: string; name: string; logo: string; plan?: string }[];
          updatedAt: string;
        };
      }
    | null = null;

  constructor(
    private prisma: PrismaService,
    private planCatalog: PlanCatalogService,
    private emailNotify: EmailNotifyService,
  ) {}

  async onModuleInit() {
    const bootstrapAdmins = getBootstrapAdminEmails();
    if (
      process.env.NODE_ENV === 'production' &&
      bootstrapAdmins.length === 0
    ) {
      throw new Error(
        'PLATFORM_ADMIN_EMAILS or PLATFORM_OWNER_EMAIL must be configured in production.',
      );
    }
    for (const email of bootstrapAdmins) {
      const isOwner = isProtectedPlatformAdminEmail(email);
      await this.prisma.platformOperator.upsert({
        where: { email },
        create: {
          email,
          name: email.split('@')[0],
          permissions: ['full'],
          isActive: true,
          createdBy: 'bootstrap',
        },
        // Never wipe custom perms on restart — except restore the primary owner
        update: isOwner
          ? { permissions: ['full'], isActive: true }
          : {},
      });

      // Owner login user must stay active (platformOperator ≠ User.isActive)
      if (isOwner) {
        await this.prisma.user.updateMany({
          where: { email },
          data: {
            isActive: true,
            loginAttempts: 0,
            lockedUntil: null,
          },
        });
      }
    }
  }

  async isPlatformAdmin(email?: string | null): Promise<boolean> {
    if (!email) return false;
    const normalized = email.toLowerCase();
    if (isProtectedPlatformAdminEmail(normalized)) return true;
    const op = await this.prisma.platformOperator.findUnique({
      where: { email: normalized },
    });
    if (op) return !!op.isActive;
    return isBootstrapAdminEmail(normalized);
  }

  async me(email: string) {
    const normalized = email.toLowerCase();
    const isPlatformAdmin = await this.isPlatformAdmin(normalized);
    const op = await this.prisma.platformOperator.findUnique({
      where: { email: normalized },
    });
    let permissions: PlatformPermission[] = ['full'];
    if (isProtectedPlatformAdminEmail(normalized)) {
      permissions = ['full'];
    } else if (
      op?.permissions &&
      Array.isArray(op.permissions) &&
      (op.permissions as string[]).length
    ) {
      permissions = op.permissions as PlatformPermission[];
    }
    return {
      isPlatformAdmin,
      email: normalized,
      permissions: isPlatformAdmin ? permissions : [],
      operatorId: op?.id ?? null,
      isActive: op ? op.isActive : isPlatformAdmin,
      isProtected: isProtectedPlatformAdminEmail(normalized),
    };
  }

  async listOperators() {
    const rows = await this.prisma.platformOperator.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const bootstrap = new Set(getBootstrapAdminEmails());
    return rows.map((r) => ({
      ...r,
      isBootstrap: bootstrap.has(r.email),
      isProtected: isProtectedPlatformAdminEmail(r.email),
      isDeputy: !!(r as { isDeputy?: boolean }).isDeputy,
      permissions: (r.permissions as string[]) || [],
      canEdit: true,
      canDeactivate:
        !isProtectedPlatformAdminEmail(r.email) &&
        !(r as { isDeputy?: boolean }).isDeputy,
      canDelete:
        !isProtectedPlatformAdminEmail(r.email) &&
        !(r as { isDeputy?: boolean }).isDeputy,
    }));
  }

  async appointOperator(opts: {
    email: string;
    name?: string;
    permissions?: string[];
    createdBy?: string;
    isDeputy?: boolean;
    actorEmail?: string;
  }) {
    const email = opts.email.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new BadRequestException('Invalid email');
    }
    const perms = this.normalizePermissions(opts.permissions);
    const wantsFullOrDeputy =
      !!opts.isDeputy || perms.includes('full');
    if (
      wantsFullOrDeputy &&
      !isProtectedPlatformAdminEmail(opts.actorEmail)
    ) {
      throw new BadRequestException(
        'Only the primary platform owner can appoint a full/deputy operator',
      );
    }
    return this.prisma.platformOperator.upsert({
      where: { email },
      create: {
        email,
        name: opts.name?.trim() || email.split('@')[0],
        permissions: perms,
        isActive: true,
        isDeputy: !!opts.isDeputy,
        createdBy: opts.createdBy,
      },
      update: {
        name: opts.name?.trim() || undefined,
        permissions: perms,
        isActive: true,
        ...(opts.isDeputy !== undefined && { isDeputy: !!opts.isDeputy }),
      },
    });
  }

  async updateOperator(
    id: string,
    data: {
      name?: string;
      permissions?: string[];
      isActive?: boolean;
      isDeputy?: boolean;
    },
    actorEmail?: string,
  ) {
    const existing = await this.prisma.platformOperator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Operator not found');
    if (isProtectedPlatformAdminEmail(existing.email)) {
      if (data.isActive === false) {
        throw new BadRequestException(
          'Cannot deactivate the configured primary platform owner account.',
        );
      }
      if (data.permissions !== undefined) {
        throw new BadRequestException(
          'Cannot restrict the primary platform owner — permissions stay full.',
        );
      }
    }
    if (
      ((existing as { isDeputy?: boolean }).isDeputy || data.isDeputy) &&
      !isProtectedPlatformAdminEmail(actorEmail)
    ) {
      if (data.isActive === false || data.permissions !== undefined || data.isDeputy === false) {
        throw new BadRequestException(
          'Only the primary owner can modify or deactivate a deputy operator',
        );
      }
    }
    const nextPerms =
      data.permissions !== undefined
        ? this.normalizePermissions(data.permissions)
        : undefined;
    if (
      nextPerms?.includes('full') &&
      !isProtectedPlatformAdminEmail(actorEmail)
    ) {
      throw new BadRequestException(
        'Only the primary platform owner can grant full operator access',
      );
    }
    return this.prisma.platformOperator.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(nextPerms !== undefined && { permissions: nextPerms }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.isDeputy !== undefined && { isDeputy: data.isDeputy }),
      },
    });
  }

  async removeOperator(id: string, actorEmail?: string) {
    const existing = await this.prisma.platformOperator.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Operator not found');
    if (isProtectedPlatformAdminEmail(existing.email)) {
      throw new BadRequestException(
        'Cannot delete the primary platform owner. You may restrict their permissions instead.',
      );
    }
    if (
      (existing as { isDeputy?: boolean }).isDeputy &&
      !isProtectedPlatformAdminEmail(actorEmail)
    ) {
      throw new BadRequestException(
        'Only the primary owner can remove a deputy operator',
      );
    }
    // Soft-remove: deactivate so seed/env emails lose access until re-appointed
    if (isBootstrapAdminEmail(existing.email)) {
      await this.prisma.platformOperator.update({
        where: { id },
        data: { isActive: false },
      });
      return { ok: true, soft: true };
    }
    await this.prisma.platformOperator.delete({ where: { id } });
    return { ok: true, soft: false };
  }

  private normalizePermissions(raw?: string[]): PlatformPermission[] {
    if (!raw?.length) return ['full'];
    const allowed = new Set<string>(PLATFORM_PERMISSIONS);
    const next = Array.from(
      new Set(raw.map((p) => p.trim().toLowerCase()).filter((p) => allowed.has(p))),
    ) as PlatformPermission[];
    return next.length ? next : ['full'];
  }

  /** Public marketing metrics for the landing page (cached ~60s). */
  async publicStats() {
    const now = Date.now();
    if (this.publicStatsCache && now - this.publicStatsCache.at < 60_000) {
      return this.publicStatsCache.data;
    }
    const data = await this.computePublicStats();
    this.publicStatsCache = { at: now, data };
    return data;
  }

  /** Active plans for landing-page pricing (monthly / yearly). Always fresh from DB. */
  async publicPlans() {
    this.planCatalog.invalidate();
    const rows = await this.planCatalog.listAll(false);
    return rows.map((p) => ({
      id: p.code,
      code: p.code,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      yearlyDiscountPct: p.yearlyDiscountPct,
      currency: p.currency,
      invoicesLimit: p.invoicesLimit,
      usersLimit: p.usersLimit,
      support: p.support,
      sortOrder: p.sortOrder,
      features: p.features,
      highlights: buildPublicPlanHighlights(p.modules),
    }));
  }

  /**
   * Logos of paid active companies for the landing page.
   * Paid = planExpiry in the future (set after successful subscription payment).
   * Unpaid/default STARTER signups have null planExpiry and are excluded.
   * Ordered by plan tier (ENTERPRISE → PROFESSIONAL → STARTER), then newest paid first.
   * Cached ~2 minutes.
   */
  async publicCustomerLogos() {
    const now = Date.now();
    if (this.publicLogosCache && now - this.publicLogosCache.at < 120_000) {
      return this.publicLogosCache.data;
    }

    const planRank: Record<string, number> = {
      ENTERPRISE: 3,
      PROFESSIONAL: 2,
      STARTER: 1,
    };

    const rows = await this.prisma.company.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        planExpiry: { gt: new Date() },
        logo: { not: null },
      },
      select: {
        id: true,
        name: true,
        logo: true,
        plan: true,
        planStartedAt: true,
        createdAt: true,
      },
      take: 80,
    });

    const companies = rows
      .filter((r) => typeof r.logo === 'string' && r.logo.trim().length > 8)
      .sort((a, b) => {
        const rankDiff = (planRank[b.plan] || 0) - (planRank[a.plan] || 0);
        if (rankDiff !== 0) return rankDiff;
        const aStart = a.planStartedAt?.getTime() || a.createdAt.getTime();
        const bStart = b.planStartedAt?.getTime() || b.createdAt.getTime();
        return bStart - aStart;
      })
      .slice(0, 48)
      .map((r) => ({
        id: r.id,
        name: r.name,
        logo: r.logo!.trim(),
        plan: r.plan,
      }));

    const data = { companies, updatedAt: new Date().toISOString() };
    this.publicLogosCache = { at: now, data };
    return data;
  }

  private async computePublicStats() {
    const now = new Date();
    const startThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    /** Convert company-base currency amounts → approximate OMR. */
    const omrFactor = `
      CASE UPPER(COALESCE(c.currency, 'OMR'))
        WHEN 'OMR' THEN 1
        WHEN 'SAR' THEN 0.100
        WHEN 'AED' THEN 0.105
        WHEN 'KWD' THEN 1.270
        WHEN 'BHD' THEN 1.030
        WHEN 'QAR' THEN 0.107
        WHEN 'USD' THEN 0.385
        WHEN 'EUR' THEN 0.420
        WHEN 'GBP' THEN 0.490
        ELSE 0.385
      END
    `;

    const [
      companies,
      users,
      companiesThisMonth,
      companiesLastMonth,
      usersThisMonth,
      usersLastMonth,
      visitsTotal,
      visits30d,
      visitsPrev30d,
      uniqueVisitsTotal,
      uniqueVisits30d,
      financeRows,
      financeThisMonthRows,
      financeLastMonthRows,
    ] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.company.count({
        where: { deletedAt: null, isActive: true, createdAt: { gte: startThisMonth } },
      }),
      this.prisma.company.count({
        where: {
          deletedAt: null,
          isActive: true,
          createdAt: { gte: startLastMonth, lt: startThisMonth },
        },
      }),
      this.prisma.user.count({
        where: { isActive: true, createdAt: { gte: startThisMonth } },
      }),
      this.prisma.user.count({
        where: {
          isActive: true,
          createdAt: { gte: startLastMonth, lt: startThisMonth },
        },
      }),
      this.prisma.siteVisit.count(),
      this.prisma.siteVisit.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.siteVisit.count({
        where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      this.prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
        `SELECT COUNT(DISTINCT ip_address)::bigint AS c FROM site_visits WHERE ip_address IS NOT NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
        `SELECT COUNT(DISTINCT ip_address)::bigint AS c FROM site_visits WHERE created_at >= $1 AND ip_address IS NOT NULL`,
        thirtyDaysAgo,
      ),
      this.prisma.$queryRawUnsafe<
        Array<{ sales: unknown; purchases: unknown; collected: unknown }>
      >(
        `SELECT
          COALESCE(SUM(CASE WHEN i.type = 'SALES' THEN i.total * (${omrFactor}) ELSE 0 END), 0) AS sales,
          COALESCE(SUM(CASE WHEN i.type = 'PURCHASE' THEN i.total * (${omrFactor}) ELSE 0 END), 0) AS purchases,
          COALESCE(SUM(CASE WHEN i.type = 'SALES' THEN i.paid_amount * (${omrFactor}) ELSE 0 END), 0) AS collected
        FROM invoices i
        INNER JOIN companies c ON c.id = i.company_id
        WHERE i.status NOT IN ('DRAFT', 'CANCELLED')
          AND c.deleted_at IS NULL`,
      ),
      this.prisma.$queryRawUnsafe<Array<{ volume: unknown }>>(
        `SELECT
          COALESCE(SUM(CASE WHEN i.type IN ('SALES', 'PURCHASE') THEN i.total * (${omrFactor}) ELSE 0 END), 0) AS volume
        FROM invoices i
        INNER JOIN companies c ON c.id = i.company_id
        WHERE i.status NOT IN ('DRAFT', 'CANCELLED')
          AND c.deleted_at IS NULL
          AND i.created_at >= $1`,
        startThisMonth,
      ),
      this.prisma.$queryRawUnsafe<Array<{ volume: unknown }>>(
        `SELECT
          COALESCE(SUM(CASE WHEN i.type IN ('SALES', 'PURCHASE') THEN i.total * (${omrFactor}) ELSE 0 END), 0) AS volume
        FROM invoices i
        INNER JOIN companies c ON c.id = i.company_id
        WHERE i.status NOT IN ('DRAFT', 'CANCELLED')
          AND c.deleted_at IS NULL
          AND i.created_at >= $1
          AND i.created_at < $2`,
        startLastMonth,
        startThisMonth,
      ),
    ]);

    const sales = Number(financeRows[0]?.sales || 0);
    const purchases = Number(financeRows[0]?.purchases || 0);
    const collected = Number(financeRows[0]?.collected || 0);
    const receivables = Math.max(0, sales - collected);
    const volumeManaged = sales + purchases;
    const volumeThisMonth = Number(financeThisMonthRows[0]?.volume || 0);
    const volumeLastMonth = Number(financeLastMonthRows[0]?.volume || 0);

    const growthPct = (current: number, previous: number): number | null => {
      if (previous <= 0) return current > 0 ? 100 : null;
      return Math.round(((current - previous) / previous) * 100);
    };

    return {
      companies,
      users,
      visits: {
        total: visitsTotal,
        last30Days: visits30d,
        uniqueTotal: Number(uniqueVisitsTotal[0]?.c || 0),
        uniqueLast30Days: Number(uniqueVisits30d[0]?.c || 0),
      },
      finance: {
        sales: Math.round(sales * 1000) / 1000,
        purchases: Math.round(purchases * 1000) / 1000,
        collected: Math.round(collected * 1000) / 1000,
        receivables: Math.round(receivables * 1000) / 1000,
        volumeManaged: Math.round(volumeManaged * 1000) / 1000,
        currency: 'OMR' as const,
      },
      growth: {
        companies: growthPct(companiesThisMonth, companiesLastMonth),
        users: growthPct(usersThisMonth, usersLastMonth),
        visits: growthPct(visits30d, visitsPrev30d),
        volume: growthPct(volumeThisMonth, volumeLastMonth),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  private overviewCache:
    | { at: number; data: Awaited<ReturnType<AdminService['computeOverview']>> }
    | null = null;

  async overview() {
    const now = Date.now();
    if (this.overviewCache && now - this.overviewCache.at < 45_000) {
      return this.overviewCache.data;
    }
    const data = await this.computeOverview();
    this.overviewCache = { at: now, data };
    return data;
  }

  private async computeOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const yesterdayStart = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);

    const [
      companiesTotal,
      companiesActive,
      usersTotal,
      usersActive,
      registeredThisMonth,
      visitsToday,
      visitsYesterday,
      visits7d,
      uniqueIps7d,
      subPaid,
      subPending,
      planGroups,
      countryGroups,
      paidThisMonth,
      posLinkedCount,
      restoLinkedCount,
    ] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.company.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.siteVisit.count({ where: { createdAt: { gte: startOfDay } } }),
      this.prisma.siteVisit.count({
        where: { createdAt: { gte: yesterdayStart, lt: startOfDay } },
      }),
      this.prisma.siteVisit.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.$queryRaw<Array<{ c: bigint }>>`
        SELECT COUNT(DISTINCT ip_address)::bigint AS c
        FROM site_visits
        WHERE created_at >= ${sevenDaysAgo} AND ip_address IS NOT NULL
      `,
      this.prisma.billingInvoice.aggregate({
        where: { purpose: 'SUBSCRIPTION', status: 'PAID' },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.billingInvoice.count({
        where: { purpose: 'SUBSCRIPTION', status: 'PENDING' },
      }),
      this.prisma.company.groupBy({
        by: ['plan'],
        where: { deletedAt: null },
        _count: true,
      }),
      this.prisma.$queryRaw<Array<{ country: string | null; count: bigint }>>`
        SELECT country, COUNT(*)::bigint AS count
        FROM site_visits
        WHERE created_at >= ${sevenDaysAgo} AND country IS NOT NULL
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10
      `,
      this.prisma.billingInvoice.aggregate({
        where: {
          purpose: 'SUBSCRIPTION',
          status: 'PAID',
          paidAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.company.count({
        where: { deletedAt: null, posLinkedAt: { not: null } },
      }),
      this.prisma.company.count({
        where: { deletedAt: null, restoLinkedAt: { not: null } },
      }),
    ]);

    const avgUsersPerCompany =
      companiesTotal > 0
        ? Number((usersTotal / companiesTotal).toFixed(2))
        : 0;

    return {
      companies: {
        total: companiesTotal,
        active: companiesActive,
        posLinked: posLinkedCount,
        restoLinked: restoLinkedCount,
      },
      users: {
        total: usersTotal,
        active: usersActive,
        registeredThisMonth,
        avgPerCompany: Number(avgUsersPerCompany.toFixed(2)),
      },
      visits: {
        today: visitsToday,
        yesterday: visitsYesterday,
        last7Days: visits7d,
        uniqueIps7d: Number(uniqueIps7d[0]?.c || 0),
        byCountry: countryGroups.map((g) => ({
          country: g.country || 'unknown',
          count: Number(g.count),
        })),
      },
      subscriptions: {
        byPlan: planGroups.map((g) => ({
          plan: g.plan,
          count: g._count,
          ...(PLAN_DETAILS[g.plan] || {
            nameAr: g.plan,
            nameEn: g.plan,
            monthlyPrice: 0,
            yearlyPrice: 0,
            invoicesLimit: 50,
            usersLimit: 2,
            support: 'email',
          }),
        })),
        revenueTotalOmr: Number(subPaid._sum.amount || 0),
        paidInvoices: subPaid._count,
        pendingInvoices: subPending,
        revenueThisMonthOmr: Number(paidThisMonth._sum.amount || 0),
        paidThisMonth: paidThisMonth._count,
      },
      plansCatalog: await this.planCatalog.listAll(true),
    };
  }

  async listTenants(q?: string, plan?: string, active?: boolean) {
    const where: Prisma.CompanyWhereInput = { deletedAt: null };
    if (plan) where.plan = plan;
    if (active !== undefined) where.isActive = active;
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { crNumber: { contains: term, mode: 'insensitive' } },
        { vatNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.company.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        _count: { select: { users: true, invoices: true } },
        users: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            sessions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { ipAddress: true, userAgent: true, createdAt: true },
            },
          },
          orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
          take: 25,
        },
      },
    });

    const activeByCompany = await this.prisma.user.groupBy({
      by: ['companyId'],
      where: {
        companyId: { in: rows.map((r) => r.id) },
        isActive: true,
      },
      _count: { _all: true },
    });
    const activeMap = new Map(
      activeByCompany.map((r) => [r.companyId, r._count._all]),
    );

    const catalog = await this.planCatalog.listAll(true);
    const byCode = new Map(catalog.map((p) => [p.code, p]));

    return rows.map((c) => {
      const fromDb = byCode.get(c.plan);
      const planDetails = fromDb
        ? {
            usersLimit: fromDb.usersLimit,
            invoicesLimit: fromDb.invoicesLimit,
          }
        : PLAN_DETAILS[c.plan] || PLAN_DETAILS.STARTER;
      const usersLimit =
        c.usersLimitOverride != null ? c.usersLimitOverride : planDetails.usersLimit;
      const invoicesLimit =
        c.invoicesLimitOverride != null
          ? c.invoicesLimitOverride
          : planDetails.invoicesLimit;
      const staff = c.users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        lastIp: u.sessions[0]?.ipAddress || null,
        lastUserAgent: u.sessions[0]?.userAgent || null,
        lastSessionAt: u.sessions[0]?.createdAt || null,
      }));
      return {
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        city: c.city,
        country: c.country,
        plan: c.plan,
        planExpiry: c.planExpiry,
        planStartedAt: c.planStartedAt,
        usersLimitOverride: c.usersLimitOverride,
        invoicesLimitOverride: c.invoicesLimitOverride,
        permanentDiscountPct: Number(c.permanentDiscountPct || 0),
        permanentDiscountNote: c.permanentDiscountNote,
        usersLimit,
        invoicesLimit,
        isActive: c.isActive,
        createdAt: c.createdAt,
        usersCount: c._count.users,
        activeUsersCount: activeMap.get(c.id) ?? staff.filter((u) => u.isActive).length,
        invoicesCount: c._count.invoices,
        posLinked: !!c.posLinkedAt,
        restoLinked: !!c.restoLinkedAt,
        posLinkedAt: c.posLinkedAt,
        restoLinkedAt: c.restoLinkedAt,
        sampleUsers: staff,
      };
    });
  }

  async getTenant(id: string) {
    const c = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { users: true, invoices: true } },
        users: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            googleId: true,
            createdAt: true,
            sessions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { ipAddress: true, userAgent: true, createdAt: true },
            },
          },
        },
        billingInvoices: {
          where: { purpose: 'SUBSCRIPTION' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!c) throw new NotFoundException('Company not found');
    const planDetails = await this.planCatalog.detailsFor(c.plan);
    return {
      ...c,
      usersLimit:
        c.usersLimitOverride != null ? c.usersLimitOverride : planDetails.usersLimit,
      invoicesLimit:
        c.invoicesLimitOverride != null
          ? c.invoicesLimitOverride
          : planDetails.invoicesLimit,
      planDetails,
    };
  }

  async updateTenant(
    id: string,
    data: {
      isActive?: boolean;
      plan?: string;
      planExpiry?: string | null;
      planStartedAt?: string | null;
      name?: string;
      usersLimitOverride?: number | null;
      invoicesLimitOverride?: number | null;
      permanentDiscountPct?: number | null;
      permanentDiscountNote?: string | null;
    },
  ) {
    const existing = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Company not found');

    const planChanging = data.plan !== undefined && data.plan !== existing.plan;

    let permanentDiscountPct: number | undefined;
    if (data.permanentDiscountPct !== undefined) {
      const n = Number(data.permanentDiscountPct);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        throw new BadRequestException('permanentDiscountPct must be between 0 and 100');
      }
      permanentDiscountPct = Math.round(n * 100) / 100;
    }

    return this.prisma.company.update({
      where: { id },
      data: {
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.plan !== undefined && { plan: data.plan }),
        ...(planChanging && { planStartedAt: new Date() }),
        ...(data.planStartedAt !== undefined && {
          planStartedAt: data.planStartedAt ? new Date(data.planStartedAt) : null,
        }),
        ...(data.planExpiry !== undefined && {
          planExpiry: data.planExpiry ? new Date(data.planExpiry) : null,
        }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.usersLimitOverride !== undefined && {
          usersLimitOverride: data.usersLimitOverride,
        }),
        ...(data.invoicesLimitOverride !== undefined && {
          invoicesLimitOverride: data.invoicesLimitOverride,
        }),
        ...(permanentDiscountPct !== undefined && {
          permanentDiscountPct,
        }),
        ...(data.permanentDiscountNote !== undefined && {
          permanentDiscountNote: data.permanentDiscountNote?.trim() || null,
        }),
      },
      select: {
        id: true,
        name: true,
        plan: true,
        planExpiry: true,
        planStartedAt: true,
        usersLimitOverride: true,
        invoicesLimitOverride: true,
        permanentDiscountPct: true,
        permanentDiscountNote: true,
        isActive: true,
      },
    });
  }

  async getUserDetail(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        company: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            expiresAt: true,
          },
        },
        auditLogs: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            action: true,
            entity: true,
            entityId: true,
            ipAddress: true,
            createdAt: true,
          },
        },
      },
    });
    if (!u) throw new NotFoundException('User not found');
    const billing = await this.prisma.billingInvoice.findMany({
      where: { companyId: u.companyId, purpose: 'SUBSCRIPTION' },
      orderBy: { createdAt: 'desc' },
      take: 12,
    });
    const planDetails = await this.planCatalog.detailsFor(u.company.plan);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      googleLinked: !!u.googleId,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      avatar: u.avatar,
      company: {
        id: u.company.id,
        name: u.company.name,
        email: u.company.email,
        phone: u.company.phone,
        city: u.company.city,
        country: u.company.country,
        plan: u.company.plan,
        planExpiry: u.company.planExpiry,
        planStartedAt: u.company.planStartedAt,
        usersLimitOverride: u.company.usersLimitOverride,
        invoicesLimitOverride: u.company.invoicesLimitOverride,
        permanentDiscountPct: Number(u.company.permanentDiscountPct || 0),
        permanentDiscountNote: u.company.permanentDiscountNote,
        usersLimit:
          u.company.usersLimitOverride != null
            ? u.company.usersLimitOverride
            : planDetails.usersLimit,
        invoicesLimit:
          u.company.invoicesLimitOverride != null
            ? u.company.invoicesLimitOverride
            : planDetails.invoicesLimit,
        isActive: u.company.isActive,
        createdAt: u.company.createdAt,
      },
      isProtected: isProtectedPlatformAdminEmail(u.email),
      sessions: u.sessions,
      auditLogs: u.auditLogs,
      subscriptionPayments: billing,
    };
  }

  async listUsers(opts?: {
    q?: string;
    role?: string;
    isActive?: boolean;
    plan?: string;
    sort?: string;
  }) {
    const where: Prisma.UserWhereInput = {};
    if (opts?.q?.trim()) {
      const term = opts.q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
        { company: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }
    if (opts?.role?.trim()) {
      const role = opts.role.trim().toUpperCase();
      if (Object.values(UserRole).includes(role as UserRole)) {
        where.role = role as UserRole;
      }
    }
    if (opts?.isActive !== undefined) {
      where.isActive = opts.isActive;
    }
    if (opts?.plan?.trim()) {
      where.company = { plan: opts.plan.trim().toUpperCase() };
    }

    const sortKey = (opts?.sort || 'createdAt_desc').toLowerCase();
    let orderBy: Prisma.UserOrderByWithRelationInput = { createdAt: 'desc' };
    switch (sortKey) {
      case 'createdat_asc':
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
      case 'name_asc':
      case 'name':
        orderBy = { name: 'asc' };
        break;
      case 'name_desc':
        orderBy = { name: 'desc' };
        break;
      case 'email_asc':
      case 'email':
        orderBy = { email: 'asc' };
        break;
      case 'email_desc':
        orderBy = { email: 'desc' };
        break;
      case 'lastlogin_desc':
      case 'lastloginat_desc':
      case 'lastlogin':
        orderBy = { lastLoginAt: 'desc' };
        break;
      case 'lastlogin_asc':
      case 'lastloginat_asc':
        orderBy = { lastLoginAt: 'asc' };
        break;
      case 'createdat_desc':
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy,
      take: 100,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        googleId: true,
        lastLoginAt: true,
        createdAt: true,
        company: {
          select: {
            id: true,
            name: true,
            plan: true,
            city: true,
            country: true,
          },
        },
      },
    });

    return users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      googleLinked: !!u.googleId,
      lastLoginAt: u.lastLoginAt,
      createdAt: u.createdAt,
      company: u.company,
      lastIp: null as string | null,
      lastUserAgent: null as string | null,
      sessionsCount: 0,
      isProtected: isProtectedPlatformAdminEmail(u.email),
    }));
  }

  async setUserActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (isProtectedPlatformAdminEmail(user.email) && !isActive) {
      throw new BadRequestException(
        'Cannot deactivate the primary platform owner account (admin@hisaby.pro)',
      );
    }
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (isProtectedPlatformAdminEmail(user.email)) {
      throw new BadRequestException(
        'Cannot delete the primary platform owner account (admin@hisaby.pro)',
      );
    }
    await this.prisma.user.delete({ where: { id } });
    return { ok: true, id };
  }

  async resetUserPassword(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (isProtectedPlatformAdminEmail(user.email)) {
      throw new BadRequestException(
        'Cannot reset password for the primary platform owner account (admin@hisaby.pro)',
      );
    }

    const temporaryPassword = this.generateTempPassword(12);
    const hashed = await bcrypt.hash(temporaryPassword, 12);
    await this.prisma.user.update({
      where: { id },
      data: {
        password: hashed,
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    let emailSent = false;
    let emailMock = false;
    let emailError: string | undefined;
    try {
      const result = await this.emailNotify.sendText({
        to: user.email,
        subject: 'Hisaby — temporary password / كلمة مرور مؤقتة',
        text: [
          `Hello ${user.name},`,
          '',
          'Your Hisaby password was reset by a platform administrator.',
          `Temporary password: ${temporaryPassword}`,
          '',
          'Please sign in and change it immediately.',
          '',
          `مرحباً ${user.name}،`,
          'تم إعادة تعيين كلمة مرور حسابي بواسطة مشرف المنصة.',
          `كلمة المرور المؤقتة: ${temporaryPassword}`,
          'يرجى تسجيل الدخول وتغييرها فوراً.',
        ].join('\n'),
      });
      emailMock = !!result.mock;
      emailSent = result.ok && !emailMock;
      emailError = result.error;
    } catch (err) {
      emailError = err instanceof Error ? err.message : 'email failed';
    }

    return {
      ok: true,
      id: user.id,
      email: user.email,
      emailSent,
      emailMock,
      ...(emailSent ? {} : { temporaryPassword }),
      ...(emailError && !emailSent ? { emailError } : {}),
    };
  }

  private generateTempPassword(length = 12): string {
    const alphabet =
      'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
    const bytes = randomBytes(length);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }

  async listBilling(status?: string) {
    const where: Prisma.BillingInvoiceWhereInput = { purpose: 'SUBSCRIPTION' };
    if (status) where.status = status as never;

    return this.prisma.billingInvoice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        company: { select: { id: true, name: true, email: true, plan: true } },
      },
    });
  }

  async listOffers() {
    return this.prisma.planOffer.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async createOffer(data: {
    plan: string;
    nameAr: string;
    nameEn: string;
    discountPct?: number;
    promoCode?: string;
    isActive?: boolean;
    startsAt?: string;
    endsAt?: string;
    monthlyPrice?: number;
    yearlyPrice?: number;
    notes?: string;
  }) {
    return this.prisma.planOffer.create({
      data: {
        plan: data.plan,
        nameAr: data.nameAr,
        nameEn: data.nameEn,
        discountPct: data.discountPct ?? 0,
        promoCode: data.promoCode || null,
        isActive: data.isActive ?? true,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        monthlyPrice: data.monthlyPrice ?? null,
        yearlyPrice: data.yearlyPrice ?? null,
        notes: data.notes || null,
      },
    });
  }

  async updateOffer(
    id: string,
    data: Partial<{
      nameAr: string;
      nameEn: string;
      discountPct: number;
      promoCode: string | null;
      isActive: boolean;
      startsAt: string | null;
      endsAt: string | null;
      monthlyPrice: number | null;
      yearlyPrice: number | null;
      notes: string | null;
    }>,
  ) {
    const existing = await this.prisma.planOffer.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Offer not found');

    return this.prisma.planOffer.update({
      where: { id },
      data: {
        ...(data.nameAr !== undefined && { nameAr: data.nameAr }),
        ...(data.nameEn !== undefined && { nameEn: data.nameEn }),
        ...(data.discountPct !== undefined && { discountPct: data.discountPct }),
        ...(data.promoCode !== undefined && { promoCode: data.promoCode }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
        ...(data.startsAt !== undefined && {
          startsAt: data.startsAt ? new Date(data.startsAt) : null,
        }),
        ...(data.endsAt !== undefined && {
          endsAt: data.endsAt ? new Date(data.endsAt) : null,
        }),
        ...(data.monthlyPrice !== undefined && { monthlyPrice: data.monthlyPrice }),
        ...(data.yearlyPrice !== undefined && { yearlyPrice: data.yearlyPrice }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  }

  async deleteOffer(id: string) {
    await this.prisma.planOffer.delete({ where: { id } }).catch(() => {
      throw new NotFoundException('Offer not found');
    });
    return { ok: true };
  }

  async listPlanDefinitions() {
    return this.planCatalog.listAll(true);
  }

  async createPlanDefinition(body: {
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
    modules?: Record<
      string,
      { enabled: boolean; transactionLimit: number | null } | boolean
    >;
    isActive?: boolean;
    sortOrder?: number;
  }) {
    try {
      return await this.planCatalog.create(body);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not create plan';
      if (msg.includes('Unique') || msg.toLowerCase().includes('unique')) {
        throw new BadRequestException('Plan code already exists');
      }
      throw new BadRequestException(msg);
    }
  }

  async updatePlanDefinition(
    code: string,
    body: Partial<{
      nameAr: string;
      nameEn: string;
      monthlyPrice: number;
      yearlyPrice: number;
      yearlyDiscountPct: number;
      invoicesLimit: number;
      usersLimit: number;
      support: string;
      features: Record<string, boolean>;
      modules: Record<string, { enabled: boolean; transactionLimit: number | null } | boolean>;
      isActive: boolean;
      sortOrder: number;
    }>,
  ) {
    try {
      return await this.planCatalog.update(code, body);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not update plan';
      if (msg === 'Plan not found') throw new NotFoundException(msg);
      throw new BadRequestException(msg);
    }
  }

  async deletePlanDefinition(code: string) {
    try {
      return await this.planCatalog.remove(code);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Could not delete plan';
      if (msg === 'Plan not found') throw new NotFoundException(msg);
      throw new BadRequestException(msg);
    }
  }

  async listVisits(limit = 100) {
    const take = Math.min(Math.max(limit, 1), 500);
    const [rows, byPath, byCountry, byDay] = await Promise.all([
      this.prisma.siteVisit.findMany({
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.$queryRaw<Array<{ path: string; count: bigint }>>`
        SELECT path, COUNT(*)::bigint AS count
        FROM site_visits
        WHERE created_at >= NOW() - INTERVAL '30 days'
        GROUP BY path
        ORDER BY count DESC
        LIMIT 15
      `,
      this.prisma.$queryRaw<Array<{ country: string | null; count: bigint }>>`
        SELECT country, COUNT(*)::bigint AS count
        FROM site_visits
        WHERE country IS NOT NULL
          AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY country
        ORDER BY count DESC
        LIMIT 15
      `,
      this.prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
        SELECT date_trunc('day', created_at) AS day, COUNT(*)::bigint AS count
        FROM site_visits
        WHERE created_at >= NOW() - INTERVAL '14 days'
        GROUP BY 1
        ORDER BY 1 ASC
      `,
    ]);

    return {
      recent: rows,
      byPath: byPath.map((p) => ({ path: p.path, count: Number(p.count) })),
      byCountry: byCountry.map((c) => ({
        country: c.country || 'unknown',
        count: Number(c.count),
      })),
      byDay: byDay.map((d) => ({
        day: d.day,
        count: Number(d.count),
      })),
    };
  }

  async recordVisit(input: {
    path: string;
    referrer?: string;
    ipAddress?: string;
    userAgent?: string;
    country?: string;
    city?: string;
    userId?: string;
    companyId?: string;
  }) {
    const path = (input.path || '/').slice(0, 500);
    if (!path.startsWith('/')) {
      throw new BadRequestException('path must start with /');
    }
    return this.prisma.siteVisit.create({
      data: {
        path,
        referrer: input.referrer?.slice(0, 500) || null,
        ipAddress: input.ipAddress?.slice(0, 80) || null,
        userAgent: input.userAgent?.slice(0, 500) || null,
        country: input.country?.slice(0, 8) || null,
        city: input.city?.slice(0, 80) || null,
        userId: input.userId || null,
        companyId: input.companyId || null,
      },
      select: { id: true },
    });
  }

  async getSettings() {
    const rows = await this.prisma.platformSetting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.valueJson]));
  }

  async upsertSetting(key: string, valueJson: unknown) {
    return this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, valueJson: valueJson as Prisma.InputJsonValue },
      update: { valueJson: valueJson as Prisma.InputJsonValue },
    });
  }

  async getMaintenancePublic() {
    const row = await this.prisma.platformSetting.findUnique({
      where: { key: 'site.maintenance' },
    });
    const v = (row?.valueJson || {}) as {
      enabled?: boolean;
      messageAr?: string;
      messageEn?: string;
    };
    return {
      enabled: !!v.enabled,
      messageAr: v.messageAr || '',
      messageEn: v.messageEn || '',
    };
  }

  async recentSessions(limit = 100) {
    return this.prisma.session.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 300),
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            company: { select: { id: true, name: true, country: true, city: true } },
          },
        },
      },
    });
  }
}
