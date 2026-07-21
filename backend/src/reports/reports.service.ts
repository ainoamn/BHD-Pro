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
    const accounts = await this.prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
    });

    if (accounts.length > 0) {
      const lines = accounts
        .map((a) => {
          const balance = Number(a.currentBalance);
          const isDebitNature = a.type === 'ASSET' || a.type === 'EXPENSE';
          return {
            code: a.code,
            name: a.name,
            debit: isDebitNature && balance > 0 ? balance : balance < 0 && !isDebitNature ? Math.abs(balance) : 0,
            credit: !isDebitNature && balance > 0 ? balance : balance < 0 && isDebitNature ? Math.abs(balance) : 0,
          };
        })
        .filter((l) => l.debit > 0 || l.credit > 0);

      const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
      return { lines, totalDebit, totalCredit, currency: 'OMR', source: 'ledger' as const };
    }

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

    return { lines, totalDebit, totalCredit, currency: 'OMR', source: 'estimated' as const };
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

  /**
   * Forward-looking cash forecast: opening cash/bank + unpaid AR/AP by due-date weeks.
   */
  async cashFlowForecast(companyId: string, weeks = 8) {
    const weeksCount = Math.min(Math.max(Number(weeks) || 8, 4), 16);
    const base = this.notCancelled(companyId);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [cashAccounts, openInvoices] = await Promise.all([
      this.prisma.account.findMany({
        where: {
          companyId,
          isActive: true,
          OR: [{ isBank: true }, { code: { in: ['1100', '1200'] } }],
        },
        select: { currentBalance: true, code: true },
      }),
      this.prisma.invoice.findMany({
        where: {
          ...base,
          type: { in: [InvoiceType.SALES, InvoiceType.PURCHASE] },
          paymentStatus: { in: ['UNPAID', 'PARTIAL'] },
        },
        select: {
          type: true,
          number: true,
          dueDate: true,
          total: true,
          paidAmount: true,
          contact: { select: { name: true } },
        },
        orderBy: { dueDate: 'asc' },
      }),
    ]);

    const openingCash = cashAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

    const weekStart = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      const day = x.getDay(); // 0 Sun
      const diff = day === 0 ? -6 : 1 - day; // Monday start
      x.setDate(x.getDate() + diff);
      return x;
    };

    const start = weekStart(today);
    const buckets: Array<{
      weekStart: string;
      weekEnd: string;
      label: string;
      inflow: number;
      outflow: number;
      net: number;
      cumulative: number;
      items: Array<{
        type: string;
        number: string;
        contactName: string;
        dueDate: string;
        amount: number;
      }>;
    }> = [];

    for (let i = 0; i < weeksCount; i++) {
      const ws = new Date(start);
      ws.setDate(start.getDate() + i * 7);
      const we = new Date(ws);
      we.setDate(ws.getDate() + 6);
      buckets.push({
        weekStart: ws.toISOString().slice(0, 10),
        weekEnd: we.toISOString().slice(0, 10),
        label: `${ws.toISOString().slice(5, 10)} → ${we.toISOString().slice(5, 10)}`,
        inflow: 0,
        outflow: 0,
        net: 0,
        cumulative: 0,
        items: [],
      });
    }

    const overdue = { inflow: 0, outflow: 0, items: [] as typeof buckets[0]['items'] };
    const beyond = { inflow: 0, outflow: 0, items: [] as typeof buckets[0]['items'] };
    const horizonEnd = new Date(start);
    horizonEnd.setDate(start.getDate() + weeksCount * 7 - 1);

    for (const inv of openInvoices) {
      const outstanding = Number(inv.total) - Number(inv.paidAmount || 0);
      if (outstanding <= 0.0005) continue;

      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      const isIn = inv.type === InvoiceType.SALES;
      const item = {
        type: inv.type,
        number: inv.number,
        contactName: inv.contact?.name || '—',
        dueDate: due.toISOString().slice(0, 10),
        amount: Number(outstanding.toFixed(3)),
      };

      if (due < today) {
        if (isIn) overdue.inflow += outstanding;
        else overdue.outflow += outstanding;
        overdue.items.push(item);
        continue;
      }

      if (due > horizonEnd) {
        if (isIn) beyond.inflow += outstanding;
        else beyond.outflow += outstanding;
        beyond.items.push(item);
        continue;
      }

      const idx = Math.floor((due.getTime() - start.getTime()) / (7 * 86400000));
      if (idx >= 0 && idx < buckets.length) {
        if (isIn) buckets[idx].inflow += outstanding;
        else buckets[idx].outflow += outstanding;
        buckets[idx].items.push(item);
      }
    }

    let running = openingCash + overdue.inflow - overdue.outflow;
    for (const b of buckets) {
      b.inflow = Number(b.inflow.toFixed(3));
      b.outflow = Number(b.outflow.toFixed(3));
      b.net = Number((b.inflow - b.outflow).toFixed(3));
      running = Number((running + b.net).toFixed(3));
      b.cumulative = running;
    }

    return {
      openingCash: Number(openingCash.toFixed(3)),
      weeks: weeksCount,
      overdue: {
        inflow: Number(overdue.inflow.toFixed(3)),
        outflow: Number(overdue.outflow.toFixed(3)),
        net: Number((overdue.inflow - overdue.outflow).toFixed(3)),
        items: overdue.items,
      },
      beyond: {
        inflow: Number(beyond.inflow.toFixed(3)),
        outflow: Number(beyond.outflow.toFixed(3)),
        net: Number((beyond.inflow - beyond.outflow).toFixed(3)),
        count: beyond.items.length,
      },
      buckets,
      projectedClosing: running,
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

  async salesSummary(companyId: string) {
    const base = this.notCancelled(companyId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: { ...base, type: InvoiceType.SALES },
      select: {
        total: true,
        taxAmount: true,
        date: true,
        status: true,
        paymentStatus: true,
        contact: { select: { id: true, name: true } },
      },
    });

    const thisMonth = invoices.filter((i) => i.date >= monthStart);
    const lastMonth = invoices.filter(
      (i) => i.date >= lastMonthStart && i.date <= lastMonthEnd,
    );

    const sum = (rows: typeof invoices) =>
      rows.reduce((s, i) => s + Number(i.total), 0);

    const byCustomer = new Map<string, { name: string; total: number; count: number }>();
    for (const inv of invoices) {
      const id = inv.contact.id;
      if (!byCustomer.has(id)) {
        byCustomer.set(id, { name: inv.contact.name, total: 0, count: 0 });
      }
      const row = byCustomer.get(id)!;
      row.total += Number(inv.total);
      row.count += 1;
    }

    const monthlyMap = new Map<string, number>();
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap.set(key, 0);
    }
    for (const inv of invoices) {
      const key = `${inv.date.getFullYear()}-${String(inv.date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyMap.has(key)) {
        monthlyMap.set(key, (monthlyMap.get(key) || 0) + Number(inv.total));
      }
    }

    return {
      invoiceCount: invoices.length,
      totalRevenue: sum(invoices),
      thisMonth: sum(thisMonth),
      lastMonth: sum(lastMonth),
      unpaid: invoices
        .filter((i) => i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIAL')
        .reduce((s, i) => s + Number(i.total), 0),
      topCustomers: Array.from(byCustomer.entries())
        .map(([contactId, v]) => ({ contactId, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      monthly: Array.from(monthlyMap.entries()).map(([month, amount]) => ({ month, amount })),
      currency: 'OMR',
    };
  }

  async purchaseSummary(companyId: string) {
    const base = this.notCancelled(companyId);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const invoices = await this.prisma.invoice.findMany({
      where: { ...base, type: InvoiceType.PURCHASE },
      select: {
        total: true,
        taxAmount: true,
        date: true,
        paymentStatus: true,
        contact: { select: { id: true, name: true } },
      },
    });

    const thisMonth = invoices.filter((i) => i.date >= monthStart);
    const lastMonth = invoices.filter(
      (i) => i.date >= lastMonthStart && i.date <= lastMonthEnd,
    );
    const sum = (rows: typeof invoices) =>
      rows.reduce((s, i) => s + Number(i.total), 0);

    const bySupplier = new Map<string, { name: string; total: number; count: number }>();
    for (const inv of invoices) {
      const id = inv.contact.id;
      if (!bySupplier.has(id)) {
        bySupplier.set(id, { name: inv.contact.name, total: 0, count: 0 });
      }
      const row = bySupplier.get(id)!;
      row.total += Number(inv.total);
      row.count += 1;
    }

    return {
      invoiceCount: invoices.length,
      totalExpenses: sum(invoices),
      thisMonth: sum(thisMonth),
      lastMonth: sum(lastMonth),
      unpaid: invoices
        .filter((i) => i.paymentStatus === 'UNPAID' || i.paymentStatus === 'PARTIAL')
        .reduce((s, i) => s + Number(i.total), 0),
      topSuppliers: Array.from(bySupplier.entries())
        .map(([contactId, v]) => ({ contactId, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10),
      currency: 'OMR',
    };
  }

  async vatSummary(companyId: string) {
    const base = this.notCancelled(companyId);

    const [salesAgg, purchaseAgg] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { ...base, type: InvoiceType.SALES },
        _sum: { taxAmount: true, total: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { ...base, type: InvoiceType.PURCHASE },
        _sum: { taxAmount: true, total: true },
        _count: true,
      }),
    ]);

    const outputVat = Number(salesAgg._sum.taxAmount || 0);
    const inputVat = Number(purchaseAgg._sum.taxAmount || 0);

    return {
      outputVat,
      inputVat,
      netVat: Number((outputVat - inputVat).toFixed(3)),
      salesInvoiceCount: salesAgg._count,
      purchaseInvoiceCount: purchaseAgg._count,
      salesTotal: Number(salesAgg._sum.total || 0),
      purchaseTotal: Number(purchaseAgg._sum.total || 0),
      currency: 'OMR',
    };
  }

  async generalLedger(companyId: string, accountId?: string) {
    const lines = await this.prisma.journalLine.findMany({
      where: {
        journal: { companyId },
        ...(accountId ? { accountId } : {}),
      },
      include: {
        account: { select: { id: true, code: true, name: true } },
        costCenter: { select: { id: true, code: true, name: true } },
        project: { select: { id: true, code: true, name: true } },
        journal: { select: { id: true, number: true, date: true, description: true, reference: true } },
      },
      orderBy: [{ journal: { date: 'asc' } }, { createdAt: 'asc' }],
      take: 500,
    });

    let running = 0;
    const entries = lines.map((line) => {
      running += Number(line.debit) - Number(line.credit);
      return {
        id: line.id,
        date: line.journal.date,
        journalNumber: line.journal.number,
        reference: line.journal.reference,
        description: line.description || line.journal.description,
        accountCode: line.account.code,
        accountName: line.account.name,
        costCenter: line.costCenter?.name || null,
        project: line.project?.name || null,
        debit: Number(line.debit),
        credit: Number(line.credit),
        balance: running,
      };
    });

    return { entries, currency: 'OMR' };
  }

  async inventorySummary(companyId: string) {
    const products = await this.prisma.product.findMany({
      where: { companyId, isActive: true },
      select: {
        id: true,
        sku: true,
        name: true,
        category: true,
        quantity: true,
        minQuantity: true,
        costPrice: true,
        salePrice: true,
      },
      orderBy: { name: 'asc' },
    });

    const lowStock = products.filter(
      (p) => Number(p.quantity) <= Number(p.minQuantity),
    );
    const totalCostValue = products.reduce(
      (s, p) => s + Number(p.quantity) * Number(p.costPrice),
      0,
    );
    const totalSaleValue = products.reduce(
      (s, p) => s + Number(p.quantity) * Number(p.salePrice),
      0,
    );

    return {
      productCount: products.length,
      lowStockCount: lowStock.length,
      totalCostValue: Number(totalCostValue.toFixed(3)),
      totalSaleValue: Number(totalSaleValue.toFixed(3)),
      lowStock: lowStock.slice(0, 20).map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        quantity: Number(p.quantity),
        minQuantity: Number(p.minQuantity),
      })),
      currency: 'OMR',
    };
  }

  async payrollSummary(companyId: string) {
    const [employees, runs] = await Promise.all([
      this.prisma.employee.findMany({
        where: { companyId, isActive: true },
        select: { id: true, name: true, baseSalary: true, department: true },
      }),
      this.prisma.payrollRun.findMany({
        where: { companyId },
        include: { _count: { select: { lines: true } } },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
        take: 12,
      }),
    ]);

    const monthlySalary = employees.reduce((s, e) => s + Number(e.baseSalary || 0), 0);
    const lastRun = runs[0];
    const periodLabel = (year: number, month: number) =>
      `${year}-${String(month).padStart(2, '0')}`;

    return {
      employeeCount: employees.length,
      monthlySalaryTotal: Number(monthlySalary.toFixed(3)),
      payrollRunCount: runs.length,
      lastRun: lastRun
        ? {
            id: lastRun.id,
            period: periodLabel(lastRun.periodYear, lastRun.periodMonth),
            status: lastRun.status,
            totalNet: Number(lastRun.totalNet),
            lineCount: lastRun._count.lines,
          }
        : null,
      recentRuns: runs.map((r) => ({
        id: r.id,
        period: periodLabel(r.periodYear, r.periodMonth),
        status: r.status,
        totalNet: Number(r.totalNet),
      })),
      currency: 'OMR',
    };
  }

  async costCenterProfitLoss(companyId: string) {
    const [centers, lines, invoices] = await Promise.all([
      this.prisma.costCenter.findMany({
        where: { companyId, isActive: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.journalLine.findMany({
        where: {
          journal: { companyId },
          costCenterId: { not: null },
        },
        include: {
          account: { select: { type: true } },
          costCenter: { select: { id: true, code: true, name: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          companyId,
          costCenterId: { not: null },
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          type: { in: ['SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'] },
        },
        select: {
          type: true,
          subtotal: true,
          discount: true,
          total: true,
          costCenterId: true,
        },
      }),
    ]);

    type Row = {
      id: string;
      code: string;
      name: string;
      revenue: number;
      expenses: number;
      netProfit: number;
    };

    const map = new Map<string, Row>();
    for (const c of centers) {
      map.set(c.id, {
        id: c.id,
        code: c.code,
        name: c.name,
        revenue: 0,
        expenses: 0,
        netProfit: 0,
      });
    }

    const ensure = (id: string, code: string, name: string) => {
      if (!map.has(id)) {
        map.set(id, { id, code, name, revenue: 0, expenses: 0, netProfit: 0 });
      }
      return map.get(id)!;
    };

    // Prefer GL journal lines (posted with analytics)
    if (lines.length > 0) {
      for (const line of lines) {
        if (!line.costCenter) continue;
        const row = ensure(line.costCenter.id, line.costCenter.code, line.costCenter.name);
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        if (line.account.type === 'REVENUE') {
          row.revenue += credit - debit;
        } else if (line.account.type === 'EXPENSE') {
          row.expenses += debit - credit;
        }
      }
    } else {
      // Fallback: invoices tagged with cost center (before/without GL)
      for (const inv of invoices) {
        if (!inv.costCenterId) continue;
        const center = centers.find((c) => c.id === inv.costCenterId);
        if (!center) continue;
        const row = ensure(center.id, center.code, center.name);
        const net = Number(inv.subtotal) - Number(inv.discount || 0);
        if (inv.type === 'SALES') row.revenue += net;
        else if (inv.type === 'CREDIT_NOTE') row.revenue -= net;
        else if (inv.type === 'PURCHASE') row.expenses += net;
        else if (inv.type === 'DEBIT_NOTE') row.expenses -= net;
      }
    }

    const rows = [...map.values()]
      .map((r) => ({
        ...r,
        revenue: Number(r.revenue.toFixed(3)),
        expenses: Number(r.expenses.toFixed(3)),
        netProfit: Number((r.revenue - r.expenses).toFixed(3)),
      }))
      .filter((r) => r.revenue !== 0 || r.expenses !== 0)
      .sort((a, b) => a.code.localeCompare(b.code));

    const totals = rows.reduce(
      (acc, r) => {
        acc.revenue += r.revenue;
        acc.expenses += r.expenses;
        acc.netProfit += r.netProfit;
        return acc;
      },
      { revenue: 0, expenses: 0, netProfit: 0 },
    );

    return {
      rows,
      totals: {
        revenue: Number(totals.revenue.toFixed(3)),
        expenses: Number(totals.expenses.toFixed(3)),
        netProfit: Number(totals.netProfit.toFixed(3)),
      },
      centerCount: centers.length,
      currency: 'OMR',
    };
  }

  async projectBudgetVsActual(companyId: string) {
    const [projects, lines, invoices] = await Promise.all([
      this.prisma.project.findMany({
        where: { companyId, isActive: true },
        include: {
          costCenter: { select: { id: true, code: true, name: true } },
        },
        orderBy: { code: 'asc' },
      }),
      this.prisma.journalLine.findMany({
        where: {
          journal: { companyId },
          projectId: { not: null },
        },
        include: {
          account: { select: { type: true } },
        },
      }),
      this.prisma.invoice.findMany({
        where: {
          companyId,
          projectId: { not: null },
          status: { notIn: ['DRAFT', 'CANCELLED'] },
          type: { in: ['SALES', 'PURCHASE', 'CREDIT_NOTE', 'DEBIT_NOTE'] },
        },
        select: {
          type: true,
          subtotal: true,
          discount: true,
          projectId: true,
        },
      }),
    ]);

    const actualByProject = new Map<string, { revenue: number; expenses: number }>();

    if (lines.length > 0) {
      for (const line of lines) {
        if (!line.projectId) continue;
        const cur = actualByProject.get(line.projectId) || { revenue: 0, expenses: 0 };
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        if (line.account.type === 'REVENUE') cur.revenue += credit - debit;
        else if (line.account.type === 'EXPENSE') cur.expenses += debit - credit;
        actualByProject.set(line.projectId, cur);
      }
    } else {
      for (const inv of invoices) {
        if (!inv.projectId) continue;
        const cur = actualByProject.get(inv.projectId) || { revenue: 0, expenses: 0 };
        const net = Number(inv.subtotal) - Number(inv.discount || 0);
        if (inv.type === 'SALES') cur.revenue += net;
        else if (inv.type === 'CREDIT_NOTE') cur.revenue -= net;
        else if (inv.type === 'PURCHASE') cur.expenses += net;
        else if (inv.type === 'DEBIT_NOTE') cur.expenses -= net;
        actualByProject.set(inv.projectId, cur);
      }
    }

    const rows = projects.map((p) => {
      const actual = actualByProject.get(p.id) || { revenue: 0, expenses: 0 };
      const budget = Number(p.budget || 0);
      const actualExpense = Number(actual.expenses.toFixed(3));
      const actualRevenue = Number(actual.revenue.toFixed(3));
      const variance = Number((budget - actualExpense).toFixed(3));
      const usedPct = budget > 0 ? Number(((actualExpense / budget) * 100).toFixed(1)) : 0;
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        status: p.status,
        costCenter: p.costCenter?.name || null,
        budget,
        actualRevenue,
        actualExpense,
        variance,
        usedPct,
      };
    });

    const totals = rows.reduce(
      (acc, r) => {
        acc.budget += r.budget;
        acc.actualRevenue += r.actualRevenue;
        acc.actualExpense += r.actualExpense;
        acc.variance += r.variance;
        return acc;
      },
      { budget: 0, actualRevenue: 0, actualExpense: 0, variance: 0 },
    );

    return {
      rows,
      totals: {
        budget: Number(totals.budget.toFixed(3)),
        actualRevenue: Number(totals.actualRevenue.toFixed(3)),
        actualExpense: Number(totals.actualExpense.toFixed(3)),
        variance: Number(totals.variance.toFixed(3)),
      },
      projectCount: projects.length,
      overBudgetCount: rows.filter((r) => r.budget > 0 && r.actualExpense > r.budget).length,
      currency: 'OMR',
    };
  }

  async auditLog(
    companyId: string,
    opts: { limit?: number; entity?: string; action?: string } = {},
  ) {
    const take = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const where: {
      companyId: string;
      entity?: string;
      action?: string;
    } = { companyId };
    if (opts.entity) where.entity = opts.entity;
    if (opts.action) where.action = opts.action;

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      total,
      limit: take,
      rows: rows.map((r) => ({
        id: r.id,
        action: r.action,
        entity: r.entity,
        entityId: r.entityId,
        userName: r.user?.name || '—',
        userEmail: r.user?.email || null,
        ipAddress: r.ipAddress,
        createdAt: r.createdAt,
        summary: this.auditSummary(r.action, r.entity, r.newValues),
      })),
    };
  }

  private auditSummary(action: string, entity: string, newValues: unknown) {
    const nv = newValues as {
      result?: { number?: string; id?: string; message?: string };
      request?: { name?: string; code?: string };
    } | null;
    const ref =
      nv?.result?.number ||
      nv?.request?.name ||
      nv?.request?.code ||
      nv?.result?.id ||
      '';
    return `${action} ${entity}${ref ? `: ${ref}` : ''}`.trim();
  }
}
