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
}
