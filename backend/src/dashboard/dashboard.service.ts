import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  InvoiceStatus,
  PaymentStatus,
  PaymentMethod,
  Prisma,
} from '@prisma/client';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DashboardService {
  /** In-process TTL when Redis is off — reduces Neon load within a shift. */
  private readonly memCache = new Map<
    string,
    { expires: number; payload: Record<string, unknown> }
  >();
  private readonly inFlight = new Map<
    string,
    Promise<Record<string, unknown>>
  >();
  /** Longer when Redis is off so refresh doesn't recompute 10–20 heavy queries. */
  private static readonly MEM_TTL_MS = 90_000;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getStats(companyId: string) {
    const cacheKey = this.redis.dashboardStatsKey(companyId);
    if (this.redis.isConfigured()) {
      const hit = await this.redis.getJson<Record<string, unknown>>(cacheKey);
      if (hit && typeof hit === 'object') {
        return { ...hit, cached: true };
      }
    } else {
      const mem = this.memCache.get(companyId);
      if (mem && mem.expires > Date.now()) {
        return { ...mem.payload, cached: true, cache: 'memory' };
      }
    }

    const current = this.inFlight.get(companyId);
    if (current) {
      return current;
    }

    const computation = this.computeStats(companyId).then(
      (stats) => ({ ...stats, cached: false }) as Record<string, unknown>,
    );
    this.inFlight.set(companyId, computation);
    let payload: Record<string, unknown>;
    try {
      payload = await computation;
    } finally {
      this.inFlight.delete(companyId);
    }
    if (this.redis.isConfigured()) {
      void this.redis
        .setJson(cacheKey, payload, this.redis.dashboardStatsTtlSec())
        .catch(() => undefined);
    } else {
      this.memCache.set(companyId, {
        expires: Date.now() + DashboardService.MEM_TTL_MS,
        payload,
      });
    }
    return payload;
  }

  /**
   * First-paint dashboard: fewer Neon round-trips (was ~21).
   * Secondary KPIs filled with zeros where dropped to keep API shape stable.
   */
  private async computeStats(companyId: string) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    // Never block first paint on legacy repair
    void this.repairStalePaidRows(companyId).catch(() => undefined);

    const notCancelled = {
      companyId,
      status: { not: InvoiceStatus.CANCELLED as InvoiceStatus },
    };

    const [
      monthSales,
      monthPurchases,
      allInvoices,
      contacts,
      products,
      recentInvoices,
      cashFlowRows,
      todaySalesAgg,
      todayReceivedAgg,
      todayExpenseAgg,
      pendingCollection,
      overdueAmountAgg,
      companyProfile,
      openPosShifts,
      openManagementAlerts,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...notCancelled, type: 'SALES', date: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...notCancelled,
          type: 'PURCHASE',
          date: { gte: startOfMonth },
        },
        _sum: { total: true },
      }),
      this.prisma.invoice.count({ where: { companyId } }),
      this.prisma.contact.count({
        where: {
          companyId,
          isActive: true,
          type: { in: ['CUSTOMER', 'BOTH'] },
        },
      }),
      this.prisma.product.count({ where: { companyId, isActive: true } }),
      this.prisma.invoice.findMany({
        where: { companyId },
        select: {
          id: true,
          number: true,
          total: true,
          date: true,
          status: true,
          type: true,
          contact: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.$queryRaw<
        Array<{
          month: Date;
          type: string;
          total: Prisma.Decimal | number | string;
        }>
      >(Prisma.sql`
        SELECT
          DATE_TRUNC('month', "date") AS "month",
          "type"::text AS "type",
          COALESCE(SUM("total"), 0) AS "total"
        FROM "invoices"
        WHERE "company_id" = ${companyId}
          AND "status"::text <> ${InvoiceStatus.CANCELLED}
          AND "type"::text IN ('SALES', 'PURCHASE')
          AND "date" >= ${sixMonthsAgo}
        GROUP BY DATE_TRUNC('month', "date"), "type"
        ORDER BY DATE_TRUNC('month', "date") ASC
      `),
      this.prisma.invoice.aggregate({
        where: {
          ...notCancelled,
          type: 'SALES',
          date: { gte: startOfDay },
        },
        _sum: { total: true },
        _count: { _all: true },
      }),
      // Today received = payments on SALES (no per-row join fetch)
      this.prisma.payment.aggregate({
        where: {
          date: { gte: startOfDay },
          invoice: {
            companyId,
            type: 'SALES',
            status: { not: InvoiceStatus.CANCELLED },
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          date: { gte: startOfDay },
          invoice: {
            companyId,
            type: 'PURCHASE',
            status: { not: InvoiceStatus.CANCELLED },
          },
        },
        _sum: { amount: true },
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          status: {
            in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.VIEWED],
          },
          paymentStatus: {
            in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL],
          },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          type: 'SALES',
          status: { not: InvoiceStatus.CANCELLED },
          OR: [
            { status: InvoiceStatus.OVERDUE },
            {
              dueDate: { lt: startOfDay },
              paymentStatus: {
                in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL],
              },
            },
          ],
        },
        _sum: { total: true, paidAmount: true },
        _count: { _all: true },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          logo: true,
          vatNumber: true,
          crNumber: true,
          address: true,
          phone: true,
        },
      }),
      this.prisma.posShift.count({
        where: { companyId, status: 'OPEN' },
      }),
      this.prisma.managementAlert.count({
        where: { companyId, status: 'OPEN' },
      }),
    ]);

    const revenue = Number(monthSales._sum.total || 0);
    const expenses = Number(monthPurchases._sum.total || 0);
    const profit = revenue - expenses;
    const todayReceived = Number(todayReceivedAgg._sum.amount || 0);
    const todayExpenses = Number(todayExpenseAgg._sum.amount || 0);
    const todaySales = Number(todaySalesAgg._sum.total || 0);
    const todaySalesCount = Number(todaySalesAgg._count?._all || 0);
    const overdueCount = Number(overdueAmountAgg._count?._all || 0);
    const overdueAmount = Math.max(
      0,
      Number(overdueAmountAgg._sum.total || 0) -
        Number(overdueAmountAgg._sum.paidAmount || 0),
    );

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = new Map<string, { revenue: number; expenses: number }>();
    for (const row of cashFlowRows) {
      const key = monthKey(new Date(row.month));
      const cur = bucket.get(key) || { revenue: 0, expenses: 0 };
      if (row.type === 'SALES') cur.revenue += Number(row.total);
      if (row.type === 'PURCHASE') cur.expenses += Number(row.total);
      bucket.set(key, cur);
    }
    const cashFlow = [...bucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({
        month,
        revenue: v.revenue,
        expenses: v.expenses,
      }));

    const onboarding = {
      hasLogo: !!(
        companyProfile?.logo && String(companyProfile.logo).trim()
      ),
      hasVat: !!(
        companyProfile?.vatNumber && String(companyProfile.vatNumber).trim()
      ),
      hasCr: !!(
        companyProfile?.crNumber && String(companyProfile.crNumber).trim()
      ),
      hasAddress: !!(
        companyProfile?.address && String(companyProfile.address).trim()
      ),
      hasPhone: !!(
        companyProfile?.phone && String(companyProfile.phone).trim()
      ),
      hasCustomers: contacts > 0,
      hasProducts: products > 0,
      hasInvoices: allInvoices > 0,
    };

    return {
      revenue,
      expenses,
      profit,
      invoiceCount: allInvoices,
      customerCount: contacts,
      productCount: products,
      todayReceived,
      todayExpenses,
      todaySales,
      todaySalesCount,
      pendingCollectionCount: pendingCollection,
      overdueCount,
      overdueAmount,
      // Secondary KPIs: cheap zeros — full scans (POS notes ILIKE / low-stock raw) removed from first paint
      lowStockCount: 0,
      vatPendingCount: 0,
      pendingApprovalsCount: 0,
      todayPosSales: 0,
      todayPosSalesCount: 0,
      todayPosVoidedCount: 0,
      todayPosVoidedTotal: 0,
      openPosShiftsCount: openPosShifts,
      openManagementAlertsCount: openManagementAlerts,
      openCustomerDisputesCount: 0,
      alerts: {
        overdue: overdueCount > 0,
        lowStock: false,
        vatPending: false,
        pendingCollection: pendingCollection > 0,
        pendingApprovals: false,
        openPosShifts: openPosShifts > 0,
        openManagementAlerts: openManagementAlerts > 0,
        openCustomerDisputes: false,
      },
      onboarding,
      recentInvoices: recentInvoices.map((inv) => ({
        id: inv.id,
        number: inv.number,
        customer: inv.contact?.name,
        date: inv.date,
        amount: Number(inv.total),
        status: inv.status,
        type: inv.type,
      })),
      cashFlow,
    };
  }

  private async repairStalePaidRows(companyId: string) {
    const stalePaid = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status: InvoiceStatus.PAID,
        NOT: { paymentStatus: PaymentStatus.PAID },
      },
      select: { id: true, total: true },
      take: 50,
    });
    await Promise.all(
      stalePaid.map(async (inv) => {
        const count = await this.prisma.payment.count({
          where: { invoiceId: inv.id },
        });
        if (count === 0) {
          await this.prisma.payment.create({
            data: {
              invoiceId: inv.id,
              amount: inv.total,
              method: PaymentMethod.OTHER,
              date: new Date(),
              notes: 'Marked as paid',
            },
          });
        }
        await this.prisma.invoice.update({
          where: { id: inv.id },
          data: { paymentStatus: PaymentStatus.PAID, paidAmount: inv.total },
        });
      }),
    );
  }
}
