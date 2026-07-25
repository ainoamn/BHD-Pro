import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, PaymentStatus, PaymentMethod } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats(companyId: string) {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const sixMonthsAgo = new Date(Date.now() - 180 * 86400000);

    // Sync paid invoices (legacy fix)
    const stalePaid = await this.prisma.invoice.findMany({
      where: {
        companyId,
        status: InvoiceStatus.PAID,
        NOT: { paymentStatus: PaymentStatus.PAID },
      },
      select: { id: true, total: true },
    });
    await Promise.all(
      stalePaid.map(async (inv) => {
        const count = await this.prisma.payment.count({ where: { invoiceId: inv.id } });
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

    const notCancelled = { companyId, status: { not: InvoiceStatus.CANCELLED as InvoiceStatus } };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const [
      monthSales,
      monthPurchases,
      allInvoices,
      contacts,
      products,
      recentInvoices,
      salesByMonth,
      purchasesByMonth,
      todayPayments,
      pendingCollection,
      todaySalesAgg,
      overdueSales,
      overdueAmountAgg,
      lowStockProducts,
      vatPending,
      hasLogo,
      pendingApprovals,
      todayPosSalesAgg,
      todayPosVoidAgg,
      openPosShifts,
      openManagementAlerts,
    ] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...notCancelled, type: 'SALES', date: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...notCancelled, type: 'PURCHASE', date: { gte: startOfMonth } },
        _sum: { total: true },
      }),
      this.prisma.invoice.count({ where: { companyId } }),
      this.prisma.contact.count({
        where: { companyId, isActive: true, type: { in: ['CUSTOMER', 'BOTH'] } },
      }),
      this.prisma.product.count({ where: { companyId, isActive: true } }),
      this.prisma.invoice.findMany({
        where: { companyId },
        include: { contact: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.invoice.findMany({
        where: { ...notCancelled, type: 'SALES', date: { gte: sixMonthsAgo } },
        select: { date: true, total: true },
      }),
      this.prisma.invoice.findMany({
        where: { ...notCancelled, type: 'PURCHASE', date: { gte: sixMonthsAgo } },
        select: { date: true, total: true },
      }),
      this.prisma.payment.findMany({
        where: {
          date: { gte: startOfDay, lte: endOfDay },
          invoice: { companyId, status: { not: InvoiceStatus.CANCELLED } },
        },
        include: { invoice: { select: { type: true, total: true } } },
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          status: {
            in: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.VIEWED],
          },
          paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          ...notCancelled,
          type: 'SALES',
          date: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          type: 'SALES',
          status: { not: InvoiceStatus.CANCELLED },
          OR: [
            { status: InvoiceStatus.OVERDUE },
            {
              dueDate: { lt: startOfDay },
              paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
            },
          ],
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
              paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
            },
          ],
        },
        _sum: { total: true, paidAmount: true },
      }),
      this.prisma.product.findMany({
        where: { companyId, isActive: true },
        select: { id: true, quantity: true, minQuantity: true },
      }),
      this.prisma.invoice.count({
        where: {
          companyId,
          type: 'SALES',
          status: { not: InvoiceStatus.CANCELLED },
          vatUuid: null,
          date: { gte: startOfMonth },
        },
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
      this.prisma.approvalRequest.count({
        where: {
          companyId,
          status: 'PENDING',
          expiresAt: { gt: new Date() },
        },
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          type: 'SALES',
          isCash: true,
          notes: { contains: 'Hisaby POS' },
          status: { not: InvoiceStatus.CANCELLED },
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: {
          companyId,
          type: 'SALES',
          isCash: true,
          notes: { contains: 'Hisaby POS' },
          status: InvoiceStatus.CANCELLED,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        _sum: { total: true },
        _count: true,
      }),
      this.prisma.posShift.count({
        where: {
          companyId,
          status: 'OPEN',
        },
      }),
      this.prisma.managementAlert.count({
        where: {
          companyId,
          status: 'OPEN',
        },
      }),
    ]);

    const revenue = Number(monthSales._sum.total || 0);
    const expenses = Number(monthPurchases._sum.total || 0);
    const profit = revenue - expenses;

    let todayReceived = 0;
    let todayExpenses = 0;
    for (const p of todayPayments) {
      const amt = Number(p.amount);
      if (p.invoice.type === 'SALES') todayReceived += amt;
      else if (p.invoice.type === 'PURCHASE') todayExpenses += amt;
    }

    const todaySales = Number(todaySalesAgg._sum.total || 0);
    const todaySalesCount = todaySalesAgg._count || 0;
    const overdueCount = overdueSales;
    const overdueAmount = Math.max(
      0,
      Number(overdueAmountAgg._sum.total || 0) - Number(overdueAmountAgg._sum.paidAmount || 0),
    );
    const lowStockCount = lowStockProducts.filter(
      (p) => Number(p.quantity) <= Number(p.minQuantity),
    ).length;

    const monthKey = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const bucket = new Map<string, { revenue: number; expenses: number }>();

    for (const inv of salesByMonth) {
      const key = monthKey(new Date(inv.date));
      const cur = bucket.get(key) || { revenue: 0, expenses: 0 };
      cur.revenue += Number(inv.total);
      bucket.set(key, cur);
    }
    for (const inv of purchasesByMonth) {
      const key = monthKey(new Date(inv.date));
      const cur = bucket.get(key) || { revenue: 0, expenses: 0 };
      cur.expenses += Number(inv.total);
      bucket.set(key, cur);
    }

    const cashFlow = [...bucket.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, revenue: v.revenue, expenses: v.expenses }));

    const onboarding = {
      hasLogo: !!(hasLogo?.logo && String(hasLogo.logo).trim()),
      hasVat: !!(hasLogo?.vatNumber && String(hasLogo.vatNumber).trim()),
      hasCr: !!(hasLogo?.crNumber && String(hasLogo.crNumber).trim()),
      hasAddress: !!(hasLogo?.address && String(hasLogo.address).trim()),
      hasPhone: !!(hasLogo?.phone && String(hasLogo.phone).trim()),
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
      lowStockCount,
      vatPendingCount: vatPending,
      pendingApprovalsCount: pendingApprovals,
      todayPosSales: Number(todayPosSalesAgg._sum.total || 0),
      todayPosSalesCount: todayPosSalesAgg._count || 0,
      todayPosVoidedCount: todayPosVoidAgg._count || 0,
      todayPosVoidedTotal: Number(todayPosVoidAgg._sum.total || 0),
      openPosShiftsCount: openPosShifts,
      openManagementAlertsCount: openManagementAlerts,
      alerts: {
        overdue: overdueCount > 0,
        lowStock: lowStockCount > 0,
        vatPending: vatPending > 0,
        pendingCollection: pendingCollection > 0,
        pendingApprovals: pendingApprovals > 0,
        openPosShifts: openPosShifts > 0,
        openManagementAlerts: openManagementAlerts > 0,
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
}
