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

    return {
      revenue,
      expenses,
      profit,
      invoiceCount: allInvoices,
      customerCount: contacts,
      productCount: products,
      todayReceived,
      todayExpenses,
      pendingCollectionCount: pendingCollection,
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
