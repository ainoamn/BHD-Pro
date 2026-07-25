import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Plan, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PLAN_DETAILS } from '../subscriptions/subscriptions.service';
import { isPlatformAdminEmail } from '../common/guards/platform-admin.guard';

@Injectable()
export class AdminService {
  private publicStatsCache:
    | { at: number; data: Awaited<ReturnType<AdminService['computePublicStats']>> }
    | null = null;

  constructor(private prisma: PrismaService) {}

  me(email: string) {
    return {
      isPlatformAdmin: isPlatformAdminEmail(email),
      email,
    };
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

  async overview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      companiesTotal,
      companiesActive,
      usersTotal,
      usersActive,
      registeredThisMonth,
      visitsToday,
      visits7d,
      uniqueIps7d,
      subPaid,
      subPending,
      planGroups,
      countryGroups,
      paidThisMonth,
    ] = await Promise.all([
      this.prisma.company.count({ where: { deletedAt: null } }),
      this.prisma.company.count({ where: { deletedAt: null, isActive: true } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: startOfMonth } } }),
      this.prisma.siteVisit.count({ where: { createdAt: { gte: startOfDay } } }),
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
    ]);

    const companiesWithUsers = await this.prisma.company.findMany({
      where: { deletedAt: null },
      select: { id: true, _count: { select: { users: true } } },
    });
    const avgUsersPerCompany =
      companiesWithUsers.length > 0
        ? companiesWithUsers.reduce((s, c) => s + c._count.users, 0) /
          companiesWithUsers.length
        : 0;

    return {
      companies: { total: companiesTotal, active: companiesActive },
      users: {
        total: usersTotal,
        active: usersActive,
        registeredThisMonth,
        avgPerCompany: Number(avgUsersPerCompany.toFixed(2)),
      },
      visits: {
        today: visitsToday,
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
          ...PLAN_DETAILS[g.plan],
        })),
        revenueTotalOmr: Number(subPaid._sum.amount || 0),
        paidInvoices: subPaid._count,
        pendingInvoices: subPending,
        revenueThisMonthOmr: Number(paidThisMonth._sum.amount || 0),
        paidThisMonth: paidThisMonth._count,
      },
      plansCatalog: Object.entries(PLAN_DETAILS).map(([id, d]) => ({
        id,
        ...d,
        currency: 'OMR',
      })),
    };
  }

  async listTenants(q?: string, plan?: Plan, active?: boolean) {
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
            lastLoginAt: true,
            sessions: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: { ipAddress: true, userAgent: true, createdAt: true },
            },
          },
          take: 5,
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    return rows.map((c) => {
      const planDetails = PLAN_DETAILS[c.plan];
      const usersLimit =
        c.usersLimitOverride != null ? c.usersLimitOverride : planDetails.usersLimit;
      const invoicesLimit =
        c.invoicesLimitOverride != null
          ? c.invoicesLimitOverride
          : planDetails.invoicesLimit;
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
        usersLimit,
        invoicesLimit,
        isActive: c.isActive,
        createdAt: c.createdAt,
        usersCount: c._count.users,
        invoicesCount: c._count.invoices,
        sampleUsers: c.users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          lastLoginAt: u.lastLoginAt,
          lastIp: u.sessions[0]?.ipAddress || null,
          lastUserAgent: u.sessions[0]?.userAgent || null,
          lastSessionAt: u.sessions[0]?.createdAt || null,
        })),
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
    const planDetails = PLAN_DETAILS[c.plan];
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
      plan?: Plan;
      planExpiry?: string | null;
      planStartedAt?: string | null;
      name?: string;
      usersLimitOverride?: number | null;
      invoicesLimitOverride?: number | null;
    },
  ) {
    const existing = await this.prisma.company.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) throw new NotFoundException('Company not found');

    const planChanging = data.plan !== undefined && data.plan !== existing.plan;

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
      },
      select: {
        id: true,
        name: true,
        plan: true,
        planExpiry: true,
        planStartedAt: true,
        usersLimitOverride: true,
        invoicesLimitOverride: true,
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
          take: 20,
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
          take: 30,
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
      take: 30,
    });
    const planDetails = PLAN_DETAILS[u.company.plan];
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
      sessions: u.sessions,
      auditLogs: u.auditLogs,
      subscriptionPayments: billing,
    };
  }

  async listUsers(q?: string) {
    const where: Prisma.UserWhereInput = {};
    if (q?.trim()) {
      const term = q.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 300,
      include: {
        company: {
          select: { id: true, name: true, plan: true, city: true, country: true },
        },
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { ipAddress: true, userAgent: true, createdAt: true },
        },
        _count: { select: { sessions: true } },
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
      lastIp: u.sessions[0]?.ipAddress || null,
      lastUserAgent: u.sessions[0]?.userAgent || null,
      sessionsCount: u._count.sessions,
    }));
  }

  async setUserActive(id: string, isActive: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { isActive },
      select: { id: true, email: true, isActive: true },
    });
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
    plan: Plan;
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
        GROUP BY path
        ORDER BY count DESC
        LIMIT 15
      `,
      this.prisma.$queryRaw<Array<{ country: string | null; count: bigint }>>`
        SELECT country, COUNT(*)::bigint AS count
        FROM site_visits
        WHERE country IS NOT NULL
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
