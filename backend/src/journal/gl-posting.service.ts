import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccountType,
  InvoiceType,
  PaymentMethod,
} from '@prisma/client';

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

  constructor(private prisma: PrismaService) {}

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
    if (method === PaymentMethod.BANK_TRANSFER || method === PaymentMethod.CREDIT_CARD) {
      return accounts.bank || accounts.cash;
    }
    return accounts.cash || accounts.bank;
  }

  private async createEntry(
    companyId: string,
    userId: string,
    meta: { date: Date; description: string; reference: string },
    lines: JournalLineInput[],
  ) {
    const filtered = lines.filter((l) => l.debit > 0.0005 || l.credit > 0.0005);
    if (!filtered.length) return null;

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
    const cash = this.cashAccount(accounts, payment.method);
    if (!cash) return null;

    let lines: JournalLineInput[] = [];
    const salesSide =
      invoice.type === InvoiceType.SALES || invoice.type === InvoiceType.CREDIT_NOTE;

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

    const journal = await this.createEntry(companyId, userId, {
      date: payment.date,
      description: `ترحيل دفعة ${invoice.number}`,
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
    },
    invoice: { id: string; number: string; type: InvoiceType },
  ) {
    if (!payment.glJournalId) return null;

    const accounts = await this.resolveAccounts(companyId);
    const amount = Number(payment.amount);
    const cash = this.cashAccount(accounts, payment.method);
    if (!cash) return null;

    const salesSide =
      invoice.type === InvoiceType.SALES || invoice.type === InvoiceType.CREDIT_NOTE;
    let lines: JournalLineInput[] = [];

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

    return this.createEntry(companyId, userId, {
      date: new Date(),
      description: `عكس دفعة ${invoice.number}`,
      reference: `REV-PAY:${payment.id}`,
    }, lines);
  }

  async postAssetDepreciation(
    companyId: string,
    userId: string,
    asset: { id: string; code: string; name: string; accountId?: string | null },
    amount: number,
  ) {
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
      reference: `DEP:${asset.id}`,
    }, lines);
  }
}
