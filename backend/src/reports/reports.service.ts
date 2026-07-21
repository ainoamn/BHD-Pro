import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, InvoiceType } from '@prisma/client';

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

  private agingBuckets() {
    return [
      { key: 'current', label: 'غير مستحق', minDays: -9999, maxDays: 0 },
      { key: 'days1_30', label: '1–30 يوم', minDays: 1, maxDays: 30 },
      { key: 'days31_60', label: '31–60 يوم', minDays: 31, maxDays: 60 },
      { key: 'days61_90', label: '61–90 يوم', minDays: 61, maxDays: 90 },
      { key: 'over90', label: 'أكثر من 90 يوم', minDays: 91, maxDays: 99999 },
    ] as const;
  }

  private daysOverdue(dueDate: Date, asOf = new Date()) {
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const today = new Date(asOf);
    today.setHours(0, 0, 0, 0);
    const diff = Math.floor((today.getTime() - due.getTime()) / 86400000);
    return diff > 0 ? diff : 0;
  }

  private bucketKey(days: number) {
    if (days <= 0) return 'current';
    if (days <= 30) return 'days1_30';
    if (days <= 60) return 'days31_60';
    if (days <= 90) return 'days61_90';
    return 'over90';
  }

  async aging(companyId: string, invoiceType: InvoiceType) {
    const base = this.notCancelled(companyId);
    const invoices = await this.prisma.invoice.findMany({
      where: {
        ...base,
        type: invoiceType,
        paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
      },
      include: {
        contact: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { dueDate: 'asc' },
    });

    const buckets = this.agingBuckets().map((b) => ({
      ...b,
      amount: 0,
      count: 0,
    }));
    const bucketMap = Object.fromEntries(buckets.map((b) => [b.key, b]));

    const byContactMap = new Map<
      string,
      {
        contactId: string;
        contactName: string;
        total: number;
        buckets: Record<string, number>;
        invoices: {
          id: string;
          number: string;
          dueDate: Date;
          daysOverdue: number;
          balance: number;
        }[];
      }
    >();

    let grandTotal = 0;

    for (const inv of invoices) {
      const total = Number(inv.total);
      const paid = Number(inv.paidAmount || 0);
      const balance = Math.max(0, total - paid);
      if (balance <= 0) continue;

      const days = this.daysOverdue(inv.dueDate);
      const key = this.bucketKey(days);
      bucketMap[key].amount += balance;
      bucketMap[key].count += 1;
      grandTotal += balance;

      const contactId = inv.contact.id;
      if (!byContactMap.has(contactId)) {
        byContactMap.set(contactId, {
          contactId,
          contactName: inv.contact.name,
          total: 0,
          buckets: { current: 0, days1_30: 0, days31_60: 0, days61_90: 0, over90: 0 },
          invoices: [],
        });
      }
      const row = byContactMap.get(contactId)!;
      row.total += balance;
      row.buckets[key] += balance;
      row.invoices.push({
        id: inv.id,
        number: inv.number,
        dueDate: inv.dueDate,
        daysOverdue: days,
        balance,
      });
    }

    return {
      type: invoiceType,
      grandTotal,
      buckets: buckets.map(({ key, label, amount, count }) => ({ key, label, amount, count })),
      contacts: Array.from(byContactMap.values()).sort((a, b) => b.total - a.total),
      currency: 'OMR',
    };
  }

  async arAging(companyId: string) {
    return this.aging(companyId, 'SALES');
  }

  async apAging(companyId: string) {
    return this.aging(companyId, 'PURCHASE');
  }

  async contactStatement(companyId: string, contactId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId },
    });
    if (!contact) throw new NotFoundException('Contact not found');

    const base = this.notCancelled(companyId);
    const [invoices, payments] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { ...base, contactId },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          number: true,
          type: true,
          date: true,
          dueDate: true,
          total: true,
          paidAmount: true,
          status: true,
          paymentStatus: true,
        },
      }),
      this.prisma.payment.findMany({
        where: { invoice: { companyId, contactId, ...base } },
        include: {
          invoice: { select: { id: true, number: true, type: true } },
        },
        orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
      }),
    ]);

    type Line = {
      date: Date;
      kind: 'invoice' | 'payment';
      reference: string;
      docType: string;
      debit: number;
      credit: number;
      invoiceId?: string;
      paymentId?: string;
    };

    const lines: Line[] = [];

    for (const inv of invoices) {
      const total = Number(inv.total);
      const isReceivable = ['SALES', 'DEBIT_NOTE'].includes(inv.type);
      const isPayable = ['PURCHASE', 'CREDIT_NOTE'].includes(inv.type);
      lines.push({
        date: inv.date,
        kind: 'invoice',
        reference: inv.number,
        docType: inv.type,
        debit: isReceivable ? total : 0,
        credit: isPayable ? total : 0,
        invoiceId: inv.id,
      });
    }

    for (const pay of payments) {
      const amount = Number(pay.amount);
      const invType = pay.invoice.type;
      const isSalesSide = ['SALES', 'CREDIT_NOTE'].includes(invType);
      lines.push({
        date: pay.date,
        kind: 'payment',
        reference: pay.reference || pay.id.slice(0, 8),
        docType: 'PAYMENT',
        debit: isSalesSide ? 0 : amount,
        credit: isSalesSide ? amount : 0,
        invoiceId: pay.invoice.id,
        paymentId: pay.id,
      });
    }

    lines.sort((a, b) => a.date.getTime() - b.date.getTime());

    let balance = 0;
    const entries = lines.map((line) => {
      balance += line.debit - line.credit;
      return { ...line, balance };
    });

    const openInvoices = invoices.filter(
      (i) => i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIAL',
    );
    const outstanding = openInvoices.reduce((s, i) => {
      const bal = Number(i.total) - Number(i.paidAmount || 0);
      return s + Math.max(0, bal);
    }, 0);

    return {
      contact: {
        id: contact.id,
        name: contact.name,
        nameEn: contact.nameEn,
        type: contact.type,
        email: contact.email,
        phone: contact.phone,
      },
      entries,
      outstanding,
      currency: 'OMR',
    };
  }
}
