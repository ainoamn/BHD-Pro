import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountType,
  InvoiceType,
  PaymentMethod,
  AccountCategory,
} from '@prisma/client';
import { PeriodsService } from '../periods/periods.service';

type JournalLineInput = {
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
  costCenterId?: string | null;
  projectId?: string | null;
};

@Injectable()
export class GlPostingService {
  private readonly logger = new Logger(GlPostingService.name);

  constructor(
    private prisma: PrismaService,
    private periods: PeriodsService,
  ) {}

  private balanceDelta(type: AccountType, debit: number, credit: number) {
    const net = debit - credit;
    if (type === 'ASSET' || type === 'EXPENSE') return net;
    return -net;
  }

  private async generateNumber(companyId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.journal.count({
      where: { companyId, number: { startsWith: `JV-${year}-` } },
    });
    return `JV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  private async accountByCode(companyId: string, code: string) {
    return this.prisma.account.findFirst({
      where: { companyId, code, isActive: true },
    });
  }

  /** Ensure fixed-asset / depreciation COA exists (for companies created before these codes). */
  async ensureDepreciationAccounts(companyId: string) {
    const defaults: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
    }> = [
      { code: '1500', name: 'الأصول الثابتة', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSET },
      { code: '1510', name: 'مجمع الإهلاك', type: AccountType.ASSET, category: AccountCategory.FIXED_ASSET },
      { code: '5300', name: 'مصروف الإهلاك', type: AccountType.EXPENSE, category: AccountCategory.OPERATING_EXPENSE },
    ];

    for (const acc of defaults) {
      const existing = await this.prisma.account.findFirst({
        where: { companyId, code: acc.code },
      });
      if (!existing) {
        await this.prisma.account.create({
          data: { companyId, ...acc, isActive: true },
        });
      }
    }
  }

  /** Ensure unrealized FX gain/loss COA exists. */
  async ensureFxAccounts(companyId: string) {
    const defaults: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
    }> = [
      {
        code: '4200',
        name: 'أرباح فروق عملة غير محققة',
        type: AccountType.REVENUE,
        category: AccountCategory.OTHER_INCOME,
      },
      {
        code: '5400',
        name: 'خسائر فروق عملة غير محققة',
        type: AccountType.EXPENSE,
        category: AccountCategory.OTHER_EXPENSE,
      },
    ];

    for (const acc of defaults) {
      const existing = await this.prisma.account.findFirst({
        where: { companyId, code: acc.code },
      });
      if (!existing) {
        await this.prisma.account.create({
          data: { companyId, ...acc, isActive: true },
        });
      }
    }
  }

  private async resolveAccounts(companyId: string) {
    const [ar, ap, cash, bank, revenue, expense, vat] = await Promise.all([
      this.accountByCode(companyId, '1300'),
      this.accountByCode(companyId, '2100'),
      this.accountByCode(companyId, '1100'),
      this.accountByCode(companyId, '1200'),
      this.accountByCode(companyId, '4100'),
      this.accountByCode(companyId, '5200'),
      this.accountByCode(companyId, '2200'),
    ]);
    return { ar, ap, cash, bank, revenue, expense, vat };
  }

  private cashAccount(
    accounts: Awaited<ReturnType<GlPostingService['resolveAccounts']>>,
    method: PaymentMethod,
  ) {
    if (method === PaymentMethod.STORE_CREDIT) {
      return null;
    }
    if (method === PaymentMethod.BANK_TRANSFER || method === PaymentMethod.CREDIT_CARD) {
      return accounts.bank || accounts.cash;
    }
    return accounts.cash || accounts.bank;
  }

  /** Customer store-credit liability 2130 */
  async ensureStoreCreditAccount(companyId: string) {
    const existing = await this.prisma.account.findFirst({
      where: { companyId, code: '2130' },
    });
    if (existing) return existing;
    return this.prisma.account.create({
      data: {
        companyId,
        code: '2130',
        name: 'ائتمان عملاء (رصيد متجر)',
        type: AccountType.LIABILITY,
        category: AccountCategory.CURRENT_LIABILITY,
        isActive: true,
      },
    });
  }

  private isStoreCreditPayment(payment: {
    method: PaymentMethod;
    notes?: string | null;
  }) {
    if (payment.method === PaymentMethod.STORE_CREDIT) return true;
    return (payment.notes || '').includes('[STORE_CREDIT]');
  }

  private async createEntry(
    companyId: string,
    userId: string,
    meta: { date: Date; description: string; reference: string },
    lines: JournalLineInput[],
  ) {
    const filtered = lines.filter((l) => l.debit > 0.0005 || l.credit > 0.0005);
    if (!filtered.length) return null;

    await this.periods.assertOpen(companyId, meta.date);

    const totalDebit = Number(filtered.reduce((s, l) => s + l.debit, 0).toFixed(3));
    const totalCredit = Number(filtered.reduce((s, l) => s + l.credit, 0).toFixed(3));
    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      this.logger.warn(`Skipping unbalanced GL entry: ${meta.reference}`);
      return null;
    }

    const accountIds = [...new Set(filtered.map((l) => l.accountId))];
    const accountRows = await this.prisma.account.findMany({
      where: { companyId, id: { in: accountIds } },
    });
    const typeMap = new Map(accountRows.map((a) => [a.id, a.type]));

    const number = await this.generateNumber(companyId);

    return this.prisma.$transaction(async (tx) => {
      const journal = await tx.journal.create({
        data: {
          companyId,
          number,
          date: meta.date,
          description: meta.description,
          reference: meta.reference,
          totalDebit,
          totalCredit,
          isBalanced: true,
          createdById: userId,
          lines: {
            create: filtered.map((l) => ({
              accountId: l.accountId,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              costCenterId: l.costCenterId || null,
              projectId: l.projectId || null,
            })),
          },
        },
      });

      for (const line of filtered) {
        const accountType = typeMap.get(line.accountId);
        if (!accountType) continue;
        const delta = this.balanceDelta(accountType, line.debit, line.credit);
        if (Math.abs(delta) < 0.0005) continue;
        await tx.account.update({
          where: { id: line.accountId },
          data: { currentBalance: { increment: delta } },
        });
      }

      // Keep BankAccount.currentBalance in sync when GL cash/bank accounts move
      const bankRows = await tx.bankAccount.findMany({
        where: { companyId, accountId: { in: accountIds }, isActive: true },
      });
      for (const bank of bankRows) {
        if (!bank.accountId) continue;
        const related = filtered.filter((l) => l.accountId === bank.accountId);
        const bankDelta = related.reduce((s, l) => s + (l.debit - l.credit), 0);
        if (Math.abs(bankDelta) < 0.0005) continue;
        await tx.bankAccount.update({
          where: { id: bank.id },
          data: { currentBalance: { increment: bankDelta } },
        });
      }

      return journal;
    });
  }

  private withAnalytics(
    line: JournalLineInput,
    costCenterId?: string | null,
    projectId?: string | null,
  ): JournalLineInput {
    if (!costCenterId && !projectId) return line;
    return {
      ...line,
      ...(costCenterId ? { costCenterId } : {}),
      ...(projectId ? { projectId } : {}),
    };
  }

  async postInvoice(
    companyId: string,
    userId: string,
    invoice: {
      id: string;
      number: string;
      type: InvoiceType;
      date: Date;
      subtotal: unknown;
      discount: unknown;
      taxAmount: unknown;
      total: unknown;
      glJournalId?: string | null;
      costCenterId?: string | null;
      projectId?: string | null;
    },
  ) {
    if (invoice.glJournalId) return null;
    if (invoice.type === InvoiceType.QUOTATION) return null;

    const accounts = await this.resolveAccounts(companyId);
    const subtotal = Number(invoice.subtotal);
    const discount = Number(invoice.discount || 0);
    const tax = Number(invoice.taxAmount);
    const total = Number(invoice.total);
    const netRevenue = Number((subtotal - discount).toFixed(3));
    const cc = invoice.costCenterId;
    const proj = invoice.projectId;

    let lines: JournalLineInput[] = [];

    if (invoice.type === InvoiceType.SALES) {
      if (!accounts.ar || !accounts.revenue) return null;
      lines = [
        { accountId: accounts.ar.id, description: invoice.number, debit: total, credit: 0 },
        this.withAnalytics(
          { accountId: accounts.revenue.id, description: invoice.number, debit: 0, credit: netRevenue },
          cc,
          proj,
        ),
      ];
      if (tax > 0 && accounts.vat) {
        lines.push({ accountId: accounts.vat.id, description: 'VAT', debit: 0, credit: tax });
      }
    } else if (invoice.type === InvoiceType.PURCHASE) {
      if (!accounts.ap || !accounts.expense) return null;
      lines = [
        this.withAnalytics(
          { accountId: accounts.expense.id, description: invoice.number, debit: netRevenue, credit: 0 },
          cc,
          proj,
        ),
        { accountId: accounts.ap.id, description: invoice.number, debit: 0, credit: total },
      ];
      if (tax > 0 && accounts.vat) {
        lines.splice(1, 0, { accountId: accounts.vat.id, description: 'VAT', debit: tax, credit: 0 });
      }
    } else if (invoice.type === InvoiceType.CREDIT_NOTE) {
      if (!accounts.ar || !accounts.revenue) return null;
      lines = [
        this.withAnalytics(
          { accountId: accounts.revenue.id, description: invoice.number, debit: netRevenue, credit: 0 },
          cc,
          proj,
        ),
        { accountId: accounts.ar.id, description: invoice.number, debit: 0, credit: total },
      ];
      if (tax > 0 && accounts.vat) {
        lines.splice(1, 0, { accountId: accounts.vat.id, description: 'VAT', debit: tax, credit: 0 });
      }
    } else if (invoice.type === InvoiceType.DEBIT_NOTE) {
      if (!accounts.ap || !accounts.expense) return null;
      lines = [
        { accountId: accounts.ap.id, description: invoice.number, debit: total, credit: 0 },
        this.withAnalytics(
          { accountId: accounts.expense.id, description: invoice.number, debit: 0, credit: netRevenue },
          cc,
          proj,
        ),
      ];
      if (tax > 0 && accounts.vat) {
        lines.push({ accountId: accounts.vat.id, description: 'VAT', debit: 0, credit: tax });
      }
    } else {
      return null;
    }

    const journal = await this.createEntry(companyId, userId, {
      date: invoice.date,
      description: `ترحيل فاتورة ${invoice.number}`,
      reference: `INV:${invoice.id}`,
    }, lines);

    if (journal) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { glJournalId: journal.id },
      });
    }
    return journal;
  }

  async postPayment(
    companyId: string,
    userId: string,
    payment: {
      id: string;
      amount: unknown;
      method: PaymentMethod;
      date: Date;
      glJournalId?: string | null;
      bankAccountId?: string | null;
      notes?: string | null;
    },
    invoice: {
      id: string;
      number: string;
      type: InvoiceType;
    },
  ) {
    if (payment.glJournalId) return null;

    const accounts = await this.resolveAccounts(companyId);
    const amount = Number(payment.amount);
    const storeCredit = this.isStoreCreditPayment(payment);

    let lines: JournalLineInput[] = [];
    const salesSide =
      invoice.type === InvoiceType.SALES || invoice.type === InvoiceType.CREDIT_NOTE;

    if (storeCredit) {
      if (!accounts.ar) return null;
      const liability = await this.ensureStoreCreditAccount(companyId);
      // SALES: settle AR by reducing customer credit liability.
      // CREDIT_NOTE: settle AR credit by increasing customer credit liability.
      if (invoice.type === InvoiceType.CREDIT_NOTE) {
        lines = [
          { accountId: accounts.ar.id, description: invoice.number, debit: amount, credit: 0 },
          { accountId: liability.id, description: invoice.number, debit: 0, credit: amount },
        ];
      } else if (invoice.type === InvoiceType.SALES) {
        lines = [
          { accountId: liability.id, description: invoice.number, debit: amount, credit: 0 },
          { accountId: accounts.ar.id, description: invoice.number, debit: 0, credit: amount },
        ];
      } else {
        return null;
      }
    } else {
      let cash = this.cashAccount(accounts, payment.method);
      if (payment.bankAccountId) {
        const bank = await this.prisma.bankAccount.findFirst({
          where: { id: payment.bankAccountId, companyId },
        });
        if (bank?.accountId) {
          const linked = await this.prisma.account.findFirst({
            where: { id: bank.accountId, companyId, isActive: true },
          });
          if (linked) cash = linked;
        }
      }
      if (!cash) return null;

      if (salesSide) {
        if (!accounts.ar) return null;
        lines = [
          { accountId: cash.id, description: invoice.number, debit: amount, credit: 0 },
          { accountId: accounts.ar.id, description: invoice.number, debit: 0, credit: amount },
        ];
      } else {
        if (!accounts.ap) return null;
        lines = [
          { accountId: accounts.ap.id, description: invoice.number, debit: amount, credit: 0 },
          { accountId: cash.id, description: invoice.number, debit: 0, credit: amount },
        ];
      }
    }

    const journal = await this.createEntry(companyId, userId, {
      date: payment.date,
      description: storeCredit
        ? `ترحيل ائتمان متجر ${invoice.number}`
        : `ترحيل دفعة ${invoice.number}`,
      reference: `PAY:${payment.id}`,
    }, lines);

    if (journal) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { glJournalId: journal.id },
      });
    }
    return journal;
  }

  async reversePaymentEntry(
    companyId: string,
    userId: string,
    payment: {
      id: string;
      amount: unknown;
      method: PaymentMethod;
      date: Date;
      glJournalId?: string | null;
      notes?: string | null;
    },
    invoice: { id: string; number: string; type: InvoiceType },
  ) {
    if (!payment.glJournalId) return null;

    const revRef = `REV-PAY:${payment.id}`;
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: revRef },
    });
    if (existing) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { glJournalId: null },
      });
      return existing;
    }

    const accounts = await this.resolveAccounts(companyId);
    const amount = Number(payment.amount);
    const storeCredit = this.isStoreCreditPayment(payment);
    let lines: JournalLineInput[] = [];

    if (storeCredit) {
      if (!accounts.ar) return null;
      const liability = await this.ensureStoreCreditAccount(companyId);
      if (invoice.type === InvoiceType.CREDIT_NOTE) {
        lines = [
          { accountId: accounts.ar.id, description: `عكس ${invoice.number}`, debit: 0, credit: amount },
          { accountId: liability.id, description: `عكس ${invoice.number}`, debit: amount, credit: 0 },
        ];
      } else if (invoice.type === InvoiceType.SALES) {
        lines = [
          { accountId: liability.id, description: `عكس ${invoice.number}`, debit: 0, credit: amount },
          { accountId: accounts.ar.id, description: `عكس ${invoice.number}`, debit: amount, credit: 0 },
        ];
      } else {
        return null;
      }
    } else {
      const cash = this.cashAccount(accounts, payment.method);
      if (!cash) return null;

      const salesSide =
        invoice.type === InvoiceType.SALES || invoice.type === InvoiceType.CREDIT_NOTE;

      if (salesSide) {
        if (!accounts.ar) return null;
        lines = [
          { accountId: cash.id, description: `عكس ${invoice.number}`, debit: 0, credit: amount },
          { accountId: accounts.ar.id, description: `عكس ${invoice.number}`, debit: amount, credit: 0 },
        ];
      } else {
        if (!accounts.ap) return null;
        lines = [
          { accountId: accounts.ap.id, description: `عكس ${invoice.number}`, debit: 0, credit: amount },
          { accountId: cash.id, description: `عكس ${invoice.number}`, debit: amount, credit: 0 },
        ];
      }
    }

    return this.createEntry(companyId, userId, {
      date: new Date(),
      description: storeCredit
        ? `عكس ائتمان متجر ${invoice.number}`
        : `عكس دفعة ${invoice.number}`,
      reference: `REV-PAY:${payment.id}`,
    }, lines);
  }

  async reverseInvoiceEntry(
    companyId: string,
    userId: string,
    invoice: { id: string; number: string; glJournalId?: string | null },
  ) {
    if (!invoice.glJournalId) return null;

    const revRef = `REV-INV:${invoice.id}`;
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: revRef },
    });
    if (existing) return existing;

    const original = await this.prisma.journal.findFirst({
      where: { id: invoice.glJournalId, companyId },
      include: { lines: true },
    });
    if (!original || !original.lines.length) return null;

    const lines: JournalLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      description: `عكس ${invoice.number}`,
      debit: Number(line.credit),
      credit: Number(line.debit),
      ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
      ...(line.projectId ? { projectId: line.projectId } : {}),
    }));

    const journal = await this.createEntry(companyId, userId, {
      date: new Date(),
      description: `عكس فاتورة ${invoice.number}`,
      reference: revRef,
    }, lines);

    if (journal) {
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: { glJournalId: null },
      });
    }
    return journal;
  }

  async postAssetDepreciation(
    companyId: string,
    userId: string,
    asset: { id: string; code: string; name: string; accountId?: string | null },
    amount: number,
  ) {
    await this.ensureDepreciationAccounts(companyId);

    const periodKey = new Date().toISOString().slice(0, 7);
    const depRef = `DEP:${asset.id}:${periodKey}`;
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: depRef },
    });
    if (existing) return existing;

    const [depExpense, accumDep, fixedAsset, fallbackExpense] = await Promise.all([
      this.accountByCode(companyId, '5300'),
      this.accountByCode(companyId, '1510'),
      asset.accountId
        ? this.prisma.account.findFirst({ where: { id: asset.accountId, companyId } })
        : this.accountByCode(companyId, '1500'),
      this.accountByCode(companyId, '5200'),
    ]);

    const expense = depExpense || fallbackExpense;
    const creditAccount = accumDep || fixedAsset;
    if (!expense || !creditAccount) return null;

    const lines: JournalLineInput[] = [
      {
        accountId: expense.id,
        description: `إهلاك ${asset.code}`,
        debit: amount,
        credit: 0,
      },
      {
        accountId: creditAccount.id,
        description: `إهلاك ${asset.code}`,
        debit: 0,
        credit: amount,
      },
    ];

    return this.createEntry(companyId, userId, {
      date: new Date(),
      description: `إهلاك أصل ${asset.name}`,
      reference: depRef,
    }, lines);
  }

  /**
   * Post unrealized FX revaluation journal.
   * lines: balanced debit/credit pairs already computed by FxRevaluationService.
   */
  async postFxRevaluation(
    companyId: string,
    userId: string,
    asOf: Date,
    lines: JournalLineInput[],
  ) {
    await this.ensureFxAccounts(companyId);
    const asOfKey = asOf.toISOString().slice(0, 10);
    return this.createEntry(companyId, userId, {
      date: asOf,
      description: `إعادة تقييم عملات أجنبية ${asOfKey}`,
      reference: `FX-REV:${asOfKey}`,
    }, lines);
  }

  /** Salary expense 5210 / wages payable 2150 / claims 5220+2160 */
  async ensurePayrollAccounts(companyId: string) {
    const defaults: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
    }> = [
      {
        code: '5210',
        name: 'مصروف الرواتب',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE,
      },
      {
        code: '2150',
        name: 'رواتب مستحقة',
        type: AccountType.LIABILITY,
        category: AccountCategory.CURRENT_LIABILITY,
      },
      {
        code: '5220',
        name: 'مصروف مطالبات الموظفين',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE,
      },
      {
        code: '2160',
        name: 'مطالبات موظفين مستحقة',
        type: AccountType.LIABILITY,
        category: AccountCategory.CURRENT_LIABILITY,
      },
    ];

    for (const acc of defaults) {
      const existing = await this.prisma.account.findFirst({
        where: { companyId, code: acc.code },
      });
      if (!existing) {
        await this.prisma.account.create({
          data: { companyId, ...acc, isActive: true },
        });
      }
    }
  }

  private async resolveCashOrBank(
    companyId: string,
    method: PaymentMethod,
    bankAccountId?: string | null,
  ) {
    const accounts = await this.resolveAccounts(companyId);
    let cash = this.cashAccount(accounts, method);
    if (bankAccountId) {
      const bank = await this.prisma.bankAccount.findFirst({
        where: { id: bankAccountId, companyId },
      });
      if (bank?.accountId) {
        const linked = await this.prisma.account.findFirst({
          where: { id: bank.accountId, companyId, isActive: true },
        });
        if (linked) cash = linked;
      }
    }
    return cash;
  }

  /**
   * Fund / defund customer store-credit liability (2130) against cash/bank.
   * Positive amount = increase liability (wallet top-up). Negative = decrease.
   */
  async postStoreCreditFunding(
    companyId: string,
    userId: string,
    opts: {
      contactId: string;
      contactName: string;
      amount: number;
      notes?: string;
      bankAccountId?: string | null;
      reference: string;
    },
  ) {
    const amount = Number(opts.amount);
    if (Math.abs(amount) < 0.0005) return null;

    const liability = await this.ensureStoreCreditAccount(companyId);
    const cash = await this.resolveCashOrBank(
      companyId,
      opts.bankAccountId ? PaymentMethod.BANK_TRANSFER : PaymentMethod.CASH,
      opts.bankAccountId,
    );
    if (!cash) return null;

    const abs = Math.abs(amount);
    const desc = opts.notes || `ائتمان متجر — ${opts.contactName}`;
    const lines: JournalLineInput[] =
      amount > 0
        ? [
            { accountId: cash.id, description: desc, debit: abs, credit: 0 },
            { accountId: liability.id, description: desc, debit: 0, credit: abs },
          ]
        : [
            { accountId: liability.id, description: desc, debit: abs, credit: 0 },
            { accountId: cash.id, description: desc, debit: 0, credit: abs },
          ];

    return this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: desc,
        reference: opts.reference,
      },
      lines,
    );
  }

  async postPayrollAccrual(
    companyId: string,
    userId: string,
    run: {
      id: string;
      number: string;
      date: Date;
      totalNet: unknown;
      glAccrualJournalId?: string | null;
    },
  ) {
    if (run.glAccrualJournalId) return null;
    await this.ensurePayrollAccounts(companyId);
    const amount = Number(run.totalNet);
    if (amount <= 0) return null;

    const [expense, payable] = await Promise.all([
      this.accountByCode(companyId, '5210'),
      this.accountByCode(companyId, '2150'),
    ]);
    if (!expense || !payable) return null;

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: run.date,
        description: `استحقاق رواتب ${run.number}`,
        reference: `PAYROLL-ACC:${run.id}`,
      },
      [
        { accountId: expense.id, description: run.number, debit: amount, credit: 0 },
        { accountId: payable.id, description: run.number, debit: 0, credit: amount },
      ],
    );

    if (journal) {
      await this.prisma.payrollRun.update({
        where: { id: run.id },
        data: { glAccrualJournalId: journal.id },
      });
    }
    return journal;
  }

  async reversePayrollAccrual(
    companyId: string,
    userId: string,
    run: { id: string; number: string; glAccrualJournalId?: string | null },
  ) {
    if (!run.glAccrualJournalId) return null;

    const revRef = `REV-PAYROLL-ACC:${run.id}`;
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: revRef },
    });
    if (existing) {
      await this.prisma.payrollRun.update({
        where: { id: run.id },
        data: { glAccrualJournalId: null },
      });
      return existing;
    }

    const original = await this.prisma.journal.findFirst({
      where: { id: run.glAccrualJournalId, companyId },
      include: { lines: true },
    });
    if (!original || !original.lines.length) return null;

    const lines: JournalLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      description: `عكس ${run.number}`,
      debit: Number(line.credit),
      credit: Number(line.debit),
      ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
      ...(line.projectId ? { projectId: line.projectId } : {}),
    }));

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: `عكس استحقاق رواتب ${run.number}`,
        reference: revRef,
      },
      lines,
    );

    if (journal) {
      await this.prisma.payrollRun.update({
        where: { id: run.id },
        data: { glAccrualJournalId: null },
      });
    }
    return journal;
  }

  async postPayrollPayment(
    companyId: string,
    userId: string,
    run: {
      id: string;
      number: string;
      totalNet: unknown;
      paymentMethod?: PaymentMethod | null;
      bankAccountId?: string | null;
      glPaymentJournalId?: string | null;
      paidAt?: Date | null;
    },
  ) {
    if (run.glPaymentJournalId) return null;
    await this.ensurePayrollAccounts(companyId);
    const amount = Number(run.totalNet);
    if (amount <= 0) return null;

    const method = run.paymentMethod || PaymentMethod.BANK_TRANSFER;
    const [payable, cash] = await Promise.all([
      this.accountByCode(companyId, '2150'),
      this.resolveCashOrBank(companyId, method, run.bankAccountId),
    ]);
    if (!payable || !cash) return null;

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: run.paidAt || new Date(),
        description: `صرف رواتب ${run.number}`,
        reference: `PAYROLL-PAY:${run.id}`,
      },
      [
        { accountId: payable.id, description: run.number, debit: amount, credit: 0 },
        { accountId: cash.id, description: run.number, debit: 0, credit: amount },
      ],
    );

    if (journal) {
      await this.prisma.payrollRun.update({
        where: { id: run.id },
        data: { glPaymentJournalId: journal.id },
      });
    }
    return journal;
  }

  async postClaimAccrual(
    companyId: string,
    userId: string,
    claim: {
      id: string;
      number: string;
      date: Date;
      total: unknown;
      glAccrualJournalId?: string | null;
    },
  ) {
    if (claim.glAccrualJournalId) return null;
    await this.ensurePayrollAccounts(companyId);
    const amount = Number(claim.total);
    if (amount <= 0) return null;

    const [expense, payable] = await Promise.all([
      this.accountByCode(companyId, '5220'),
      this.accountByCode(companyId, '2160'),
    ]);
    if (!expense || !payable) return null;

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: claim.date,
        description: `استحقاق مطالبة ${claim.number}`,
        reference: `CLAIM-ACC:${claim.id}`,
      },
      [
        { accountId: expense.id, description: claim.number, debit: amount, credit: 0 },
        { accountId: payable.id, description: claim.number, debit: 0, credit: amount },
      ],
    );

    if (journal) {
      await this.prisma.employeeClaim.update({
        where: { id: claim.id },
        data: { glAccrualJournalId: journal.id },
      });
    }
    return journal;
  }

  async reverseClaimAccrual(
    companyId: string,
    userId: string,
    claim: { id: string; number: string; glAccrualJournalId?: string | null },
  ) {
    if (!claim.glAccrualJournalId) return null;

    const revRef = `REV-CLAIM-ACC:${claim.id}`;
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: revRef },
    });
    if (existing) {
      await this.prisma.employeeClaim.update({
        where: { id: claim.id },
        data: { glAccrualJournalId: null },
      });
      return existing;
    }

    const original = await this.prisma.journal.findFirst({
      where: { id: claim.glAccrualJournalId, companyId },
      include: { lines: true },
    });
    if (!original || !original.lines.length) return null;

    const lines: JournalLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      description: `عكس ${claim.number}`,
      debit: Number(line.credit),
      credit: Number(line.debit),
      ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
      ...(line.projectId ? { projectId: line.projectId } : {}),
    }));

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: `عكس استحقاق مطالبة ${claim.number}`,
        reference: revRef,
      },
      lines,
    );

    if (journal) {
      await this.prisma.employeeClaim.update({
        where: { id: claim.id },
        data: { glAccrualJournalId: null },
      });
    }
    return journal;
  }

  async postClaimPayment(
    companyId: string,
    userId: string,
    claim: {
      id: string;
      number: string;
      total: unknown;
      paymentMethod?: PaymentMethod | null;
      bankAccountId?: string | null;
      glPaymentJournalId?: string | null;
      paidAt?: Date | null;
    },
  ) {
    if (claim.glPaymentJournalId) return null;
    await this.ensurePayrollAccounts(companyId);
    const amount = Number(claim.total);
    if (amount <= 0) return null;

    const method = claim.paymentMethod || PaymentMethod.CASH;
    const [payable, cash] = await Promise.all([
      this.accountByCode(companyId, '2160'),
      this.resolveCashOrBank(companyId, method, claim.bankAccountId),
    ]);
    if (!payable || !cash) return null;

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: claim.paidAt || new Date(),
        description: `صرف مطالبة ${claim.number}`,
        reference: `CLAIM-PAY:${claim.id}`,
      },
      [
        { accountId: payable.id, description: claim.number, debit: amount, credit: 0 },
        { accountId: cash.id, description: claim.number, debit: 0, credit: amount },
      ],
    );

    if (journal) {
      await this.prisma.employeeClaim.update({
        where: { id: claim.id },
        data: { glPaymentJournalId: journal.id },
      });
    }
    return journal;
  }

  async reverseClaimPayment(
    companyId: string,
    userId: string,
    claim: { id: string; number: string; glPaymentJournalId?: string | null },
  ) {
    if (!claim.glPaymentJournalId) return null;

    const revRef = `REV-CLAIM-PAY:${claim.id}`;
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: revRef },
    });
    if (existing) {
      await this.prisma.employeeClaim.update({
        where: { id: claim.id },
        data: { glPaymentJournalId: null },
      });
      return existing;
    }

    const original = await this.prisma.journal.findFirst({
      where: { id: claim.glPaymentJournalId, companyId },
      include: { lines: true },
    });
    if (!original || !original.lines.length) return null;

    const lines: JournalLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      description: `عكس صرف ${claim.number}`,
      debit: Number(line.credit),
      credit: Number(line.debit),
      ...(line.costCenterId ? { costCenterId: line.costCenterId } : {}),
      ...(line.projectId ? { projectId: line.projectId } : {}),
    }));

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: `عكس صرف مطالبة ${claim.number}`,
        reference: revRef,
      },
      lines,
    );

    if (journal) {
      await this.prisma.employeeClaim.update({
        where: { id: claim.id },
        data: { glPaymentJournalId: null },
      });
    }
    return journal;
  }

  async postCommitmentAccrual(
    companyId: string,
    userId: string,
    commitment: {
      id: string;
      name: string;
      amount: unknown;
      expenseAccountId?: string | null;
      payableAccountId?: string | null;
    },
  ) {
    await this.ensurePayrollAccounts(companyId);
    const amount = Number(commitment.amount);
    if (amount <= 0) return null;

    const expense =
      (commitment.expenseAccountId
        ? await this.prisma.account.findFirst({
            where: { id: commitment.expenseAccountId, companyId, isActive: true },
          })
        : null) || (await this.accountByCode(companyId, '5200'));
    const payable =
      (commitment.payableAccountId
        ? await this.prisma.account.findFirst({
            where: { id: commitment.payableAccountId, companyId, isActive: true },
          })
        : null) || (await this.accountByCode(companyId, '2100'));
    if (!expense || !payable) return null;

    return this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: `التزام دوري: ${commitment.name}`,
        reference: `COMMIT:${commitment.id}:${Date.now()}`,
      },
      [
        { accountId: expense.id, description: commitment.name, debit: amount, credit: 0 },
        { accountId: payable.id, description: commitment.name, debit: 0, credit: amount },
      ],
    );
  }

  /** Ensure POS cash drawer expense / deposit COA (5290 / 4290). */
  async ensurePosCashAccounts(companyId: string) {
    const defaults: Array<{
      code: string;
      name: string;
      type: AccountType;
      category: AccountCategory;
    }> = [
      {
        code: '5290',
        name: 'مصروف صندوق',
        type: AccountType.EXPENSE,
        category: AccountCategory.OPERATING_EXPENSE,
      },
      {
        code: '4290',
        name: 'إيداع صندوق (دخل آخر)',
        type: AccountType.REVENUE,
        category: AccountCategory.OTHER_INCOME,
      },
    ];

    for (const acc of defaults) {
      const existing = await this.prisma.account.findFirst({
        where: { companyId, code: acc.code },
      });
      if (!existing) {
        await this.prisma.account.create({
          data: { companyId, ...acc, isActive: true },
        });
      }
    }
  }

  /**
   * Cash OUT from POS drawer: Dr expense 5290 (fallback 5200) / Cr cash 1100.
   */
  async postPosCashOut(
    companyId: string,
    userId: string,
    opts: { amount: number; reason?: string; reference: string },
  ) {
    const amount = Number(opts.amount);
    if (!(amount > 0)) return null;

    await this.ensurePosCashAccounts(companyId);
    const accounts = await this.resolveAccounts(companyId);
    const cash = accounts.cash;
    const expense =
      (await this.accountByCode(companyId, '5290')) || accounts.expense;
    if (!cash || !expense) {
      this.logger.warn(`POS cash-out GL skipped — missing cash/expense COA (${opts.reference})`);
      return null;
    }

    const desc =
      opts.reason?.trim() ||
      `إخراج نقد من الصندوق — ${opts.reference}`;

    return this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: desc,
        reference: opts.reference,
      },
      [
        { accountId: expense.id, description: desc, debit: amount, credit: 0 },
        { accountId: cash.id, description: desc, debit: 0, credit: amount },
      ],
    );
  }

  /**
   * Cash IN to POS drawer: Dr cash 1100 / Cr other income 4290 (fallback 4200).
   */
  async postPosCashIn(
    companyId: string,
    userId: string,
    opts: { amount: number; reason?: string; reference: string },
  ) {
    const amount = Number(opts.amount);
    if (!(amount > 0)) return null;

    await this.ensurePosCashAccounts(companyId);
    const accounts = await this.resolveAccounts(companyId);
    const cash = accounts.cash;
    const income =
      (await this.accountByCode(companyId, '4290')) ||
      (await this.accountByCode(companyId, '4200'));
    if (!cash || !income) {
      this.logger.warn(`POS cash-in GL skipped — missing cash/income COA (${opts.reference})`);
      return null;
    }

    const desc =
      opts.reason?.trim() ||
      `إدخال نقد إلى الصندوق — ${opts.reference}`;

    return this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: desc,
        reference: opts.reference,
      },
      [
        { accountId: cash.id, description: desc, debit: amount, credit: 0 },
        { accountId: income.id, description: desc, debit: 0, credit: amount },
      ],
    );
  }

  /** Reverse a POS cash in/out journal by flipping original lines. */
  async reversePosCashMovement(
    companyId: string,
    userId: string,
    movement: {
      id: string;
      type: string;
      journalId?: string | null;
      reason?: string | null;
    },
  ) {
    if (!movement.journalId) return null;

    const revRef = `REV-POS-CASH:${movement.id}`;
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: revRef },
    });
    if (existing) {
      await this.prisma.posCashMovement.update({
        where: { id: movement.id },
        data: { journalId: null },
      });
      return existing;
    }

    const original = await this.prisma.journal.findFirst({
      where: { id: movement.journalId, companyId },
      include: { lines: true },
    });
    if (!original || !original.lines.length) return null;

    const lines: JournalLineInput[] = original.lines.map((line) => ({
      accountId: line.accountId,
      description: `عكس حركة نقد ${movement.type}`,
      debit: Number(line.credit),
      credit: Number(line.debit),
    }));

    const journal = await this.createEntry(
      companyId,
      userId,
      {
        date: new Date(),
        description: `عكس ${movement.type === 'OUT' ? 'إخراج' : 'إدخال'} نقد POS`,
        reference: revRef,
      },
      lines,
    );

    if (journal) {
      await this.prisma.posCashMovement.update({
        where: { id: movement.id },
        data: { journalId: null },
      });
    }
    return journal;
  }

  /** Internal transfer between two company bank accounts (Dr to / Cr from). */
  async postBankTransfer(
    companyId: string,
    userId: string,
    transfer: {
      fromAccountId: string;
      toAccountId: string;
      amount: number;
      date: Date;
      description: string;
      reference: string;
    },
  ) {
    const amount = Number(transfer.amount);
    if (amount <= 0) return null;
    if (transfer.fromAccountId === transfer.toAccountId) return null;

    return this.createEntry(
      companyId,
      userId,
      {
        date: transfer.date,
        description: transfer.description,
        reference: transfer.reference,
      },
      [
        {
          accountId: transfer.toAccountId,
          description: transfer.description,
          debit: amount,
          credit: 0,
        },
        {
          accountId: transfer.fromAccountId,
          description: transfer.description,
          debit: 0,
          credit: amount,
        },
      ],
    );
  }
}
