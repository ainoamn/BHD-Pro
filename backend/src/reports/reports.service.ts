import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private notCancelled(companyId: string) {
    return {
      companyId,
      status: { not: InvoiceStatus.CANCELLED },
    };
  }

  async profitAndLoss(companyId: string) {
    const base = this.notCancelled(companyId);

    const [sales, purchases] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...base, type: 'SALES' },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, type: 'PURCHASE' },
        _sum: { total: true },
      }),
    ]);

    const revenue = Number(sales._sum.total || 0);
    const expenses = Number(purchases._sum.total || 0);

    return {
      revenue,
      expenses,
      netProfit: revenue - expenses,
      margin: revenue > 0 ? ((revenue - expenses) / revenue) * 100 : 0,
      currency: 'OMR',
    };
  }

  async balanceSheet(companyId: string) {
    const base = this.notCancelled(companyId);

    const [salesUnpaid, purchasesUnpaid, salesPaid, purchasesPaid] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...base, type: 'SALES', paymentStatus: 'UNPAID' },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, type: 'PURCHASE', paymentStatus: 'UNPAID' },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, type: 'SALES', paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, type: 'PURCHASE', paymentStatus: 'PAID' },
        _sum: { total: true },
      }),
    ]);

    const receivables = Number(salesUnpaid._sum.total || 0);
    const payables = Number(purchasesUnpaid._sum.total || 0);
    const cashFromSales = Number(salesPaid._sum.total || 0);
    const cashToSuppliers = Number(purchasesPaid._sum.total || 0);
    const netCash = cashFromSales - cashToSuppliers;

    const assets = [
      { code: '1100', name: 'الصندوق / البنك (صافي التحصيل)', balance: netCash },
      { code: '1300', name: 'ذمم العملاء (مستحق)', balance: receivables },
    ];
    const liabilities = [
      { code: '2100', name: 'ذمم الموردين (مستحق)', balance: payables },
    ];
    const equity = [
      {
        code: '3000',
        name: 'حقوق الملكية / الأرباح المحتجزة',
        balance: netCash + receivables - payables,
      },
    ];

    const totalAssets = assets.reduce((s, a) => s + a.balance, 0);
    const totalLiabilities = liabilities.reduce((s, a) => s + a.balance, 0);
    const totalEquity = equity.reduce((s, a) => s + a.balance, 0);

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      currency: 'OMR',
    };
  }

  async trialBalance(companyId: string) {
    const pl = await this.profitAndLoss(companyId);

    const lines = [
      {
        code: '4000',
        name: 'إيرادات المبيعات',
        debit: 0,
        credit: pl.revenue,
      },
      {
        code: '5000',
        name: 'مصروفات المشتريات',
        debit: pl.expenses,
        credit: 0,
      },
      {
        code: '3000',
        name: 'صافي الربح',
        debit: pl.netProfit < 0 ? Math.abs(pl.netProfit) : 0,
        credit: pl.netProfit > 0 ? pl.netProfit : 0,
      },
    ];

    const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0);

    return { lines, totalDebit, totalCredit, currency: 'OMR' };
  }

  async cashFlow(companyId: string) {
    const base = this.notCancelled(companyId);

    const invoices = await this.prisma.invoice.findMany({
      where: base,
      select: { type: true, total: true, paymentStatus: true, paidAmount: true },
    });

    const inflow = invoices
      .filter((i) => i.type === 'SALES')
      .reduce(
        (s, i) =>
          s +
          (i.paymentStatus === 'PAID'
            ? Number(i.paidAmount || i.total)
            : Number(i.paidAmount || 0)),
        0,
      );

    const outflow = invoices
      .filter((i) => i.type === 'PURCHASE')
      .reduce(
        (s, i) =>
          s +
          (i.paymentStatus === 'PAID'
            ? Number(i.paidAmount || i.total)
            : Number(i.paidAmount || 0)),
        0,
      );

    return {
      operating: inflow - outflow,
      inflow,
      outflow,
      netCashFlow: inflow - outflow,
      currency: 'OMR',
    };
  }
}
