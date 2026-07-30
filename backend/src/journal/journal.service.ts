import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalDto } from './dto/create-journal.dto';
import { PeriodsService } from '../periods/periods.service';

@Injectable()
export class JournalService {
  constructor(
    private prisma: PrismaService,
    private periods: PeriodsService,
  ) {}

  private async generateNumber(companyId: string) {
    const year = new Date().getFullYear();
    const count = await this.prisma.journal.count({
      where: { companyId, number: { startsWith: `JV-${year}-` } },
    });
    return `JV-${year}-${String(count + 1).padStart(4, '0')}`;
  }

  async getAccounts(companyId: string) {
    return this.prisma.account.findMany({
      where: { companyId, isActive: true },
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, nameEn: true, type: true },
    });
  }

  async findAll(companyId: string, requestedTake?: number) {
    const take = Math.min(Math.max(requestedTake || 200, 1), 500);
    return this.prisma.journal.findMany({
      where: { companyId },
      include: {
        lines: {
          include: {
            account: { select: { code: true, name: true } },
            costCenter: { select: { id: true, code: true, name: true } },
            project: { select: { id: true, code: true, name: true } },
          },
        },
        createdBy: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take,
    });
  }

  async findOne(companyId: string, id: string) {
    const journal = await this.prisma.journal.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: {
            account: true,
            costCenter: { select: { id: true, code: true, name: true } },
            project: { select: { id: true, code: true, name: true } },
          },
        },
        createdBy: { select: { name: true, email: true } },
      },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    return journal;
  }

  async create(companyId: string, userId: string, dto: CreateJournalDto) {
    if (!dto.lines?.length) throw new BadRequestException('At least one line required');

    await this.periods.assertOpen(companyId, dto.date);

    const totalDebit = dto.lines.reduce((s, l) => s + Number(l.debit), 0);
    const totalCredit = dto.lines.reduce((s, l) => s + Number(l.credit), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.001) {
      throw new BadRequestException(`Journal not balanced: debit=${totalDebit}, credit=${totalCredit}`);
    }

    const number = await this.generateNumber(companyId);
    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const costCenterIds = [
      ...new Set(dto.lines.map((l) => l.costCenterId).filter((id): id is string => !!id)),
    ];
    const projectIds = [
      ...new Set(dto.lines.map((l) => l.projectId).filter((id): id is string => !!id)),
    ];
    const [accountRows, costCenterRows, projectRows] = await Promise.all([
      this.prisma.account.findMany({
        where: { companyId, id: { in: accountIds } },
      }),
      costCenterIds.length
        ? this.prisma.costCenter.findMany({
            where: { companyId, id: { in: costCenterIds } },
            select: { id: true },
          })
        : [],
      projectIds.length
        ? this.prisma.project.findMany({
            where: { companyId, id: { in: projectIds } },
            select: { id: true },
          })
        : [],
    ]);
    const foundAccountIds = new Set(accountRows.map((row) => row.id));
    const missingAccount = accountIds.find((id) => !foundAccountIds.has(id));
    if (missingAccount) {
      throw new BadRequestException(`Account ${missingAccount} not found`);
    }
    if (costCenterRows.length !== costCenterIds.length) {
      throw new BadRequestException('Cost center not found');
    }
    if (projectRows.length !== projectIds.length) {
      throw new BadRequestException('Project not found');
    }
    const typeMap = new Map(accountRows.map((a) => [a.id, a.type]));

    return this.prisma.$transaction(async (tx) => {
      const journal = await tx.journal.create({
        data: {
          companyId,
          number,
          date: new Date(dto.date),
          description: dto.description,
          reference: dto.reference,
          totalDebit,
          totalCredit,
          isBalanced: true,
          createdById: userId,
          lines: {
            create: dto.lines.map((l) => ({
              accountId: l.accountId,
              description: l.description,
              debit: l.debit,
              credit: l.credit,
              costCenterId: l.costCenterId || null,
              projectId: l.projectId || null,
            })),
          },
        },
        include: {
          lines: {
            include: {
              account: { select: { code: true, name: true } },
              costCenter: { select: { id: true, code: true, name: true } },
              project: { select: { id: true, code: true, name: true } },
            },
          },
        },
      });

      for (const line of dto.lines) {
        const accountType = typeMap.get(line.accountId);
        if (!accountType) continue;
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        const net = debit - credit;
        const delta = accountType === 'ASSET' || accountType === 'EXPENSE' ? net : -net;
        if (Math.abs(delta) < 0.0005) continue;
        await tx.account.update({
          where: { id: line.accountId },
          data: { currentBalance: { increment: delta } },
        });
      }

      // Keep BankAccount.currentBalance aligned with manual journals on bank GL accounts
      const bankRows = await tx.bankAccount.findMany({
        where: { companyId, accountId: { in: accountIds }, isActive: true },
      });
      for (const bank of bankRows) {
        if (!bank.accountId) continue;
        const related = dto.lines.filter((l) => l.accountId === bank.accountId);
        const bankDelta = related.reduce(
          (s, l) => s + (Number(l.debit) - Number(l.credit)),
          0,
        );
        if (Math.abs(bankDelta) < 0.0005) continue;
        await tx.bankAccount.update({
          where: { id: bank.id },
          data: { currentBalance: { increment: bankDelta } },
        });
      }

      return journal;
    });
  }

  async remove(companyId: string, id: string) {
    const journal = await this.findOne(companyId, id);
    await this.periods.assertOpen(companyId, journal.date);

    const [
      invoiceLink,
      paymentLink,
      payrollAccrual,
      payrollPayment,
      claimAccrual,
      claimPayment,
      posCash,
    ] = await Promise.all([
      this.prisma.invoice.findFirst({
        where: { companyId, glJournalId: id },
        select: { number: true },
      }),
      this.prisma.payment.findFirst({
        where: { glJournalId: id, invoice: { companyId } },
        select: { id: true },
      }),
      this.prisma.payrollRun.findFirst({
        where: { companyId, glAccrualJournalId: id },
        select: { number: true },
      }),
      this.prisma.payrollRun.findFirst({
        where: { companyId, glPaymentJournalId: id },
        select: { number: true },
      }),
      this.prisma.employeeClaim.findFirst({
        where: { companyId, glAccrualJournalId: id },
        select: { number: true },
      }),
      this.prisma.employeeClaim.findFirst({
        where: { companyId, glPaymentJournalId: id },
        select: { number: true },
      }),
      this.prisma.posCashMovement.findFirst({
        where: { companyId, journalId: id },
        select: { id: true },
      }),
    ]);

    if (invoiceLink) {
      throw new BadRequestException(
        `Journal linked to invoice ${invoiceLink.number} — unsend or cancel the invoice instead`,
      );
    }
    if (paymentLink) {
      throw new BadRequestException(
        'Journal linked to a payment — reverse the payment instead of deleting the journal',
      );
    }
    if (payrollAccrual || payrollPayment) {
      throw new BadRequestException(
        'Journal linked to payroll — reverse/delete the payroll run instead',
      );
    }
    if (claimAccrual || claimPayment) {
      throw new BadRequestException(
        'Journal linked to an employee claim — reverse via claim workflow instead',
      );
    }
    if (posCash) {
      throw new BadRequestException(
        'Journal linked to a POS cash movement — reverse that movement instead',
      );
    }
    if (journal.reference?.startsWith('BANK-XFER:')) {
      throw new BadRequestException(
        'Bank transfer journal — reverse via POST /bank-accounts/transfer/:journalId/reverse',
      );
    }
    if (journal.reference?.startsWith('COMMIT:')) {
      throw new BadRequestException(
        'Commitment accrual journal — reverse via POST /commitments/:id/reverse-last',
      );
    }
    if (journal.reference?.startsWith('FX-REV:')) {
      throw new BadRequestException(
        'FX revaluation journal — reverse via POST /fx-revaluation/reverse',
      );
    }
    if (journal.reference?.startsWith('DEP:')) {
      throw new BadRequestException(
        'Depreciation journal — reverse via POST /assets/:id/reverse-last-depreciation',
      );
    }
    if (
      journal.reference?.startsWith('SC-ADJ:') ||
      journal.reference?.startsWith('POS-SC-TOPUP:') ||
      journal.reference?.startsWith('SC-OPEN:')
    ) {
      throw new BadRequestException(
        'Store-credit journal — reverse via POST /contacts/:id/store-credit-reverse-last',
      );
    }
    if (
      journal.reference?.startsWith('REV-') ||
      journal.reference?.startsWith('INV:') ||
      journal.reference?.startsWith('PAY:') ||
      journal.reference?.startsWith('PAYROLL-') ||
      journal.reference?.startsWith('CLAIM-') ||
      journal.reference?.startsWith('POS-CASH')
    ) {
      throw new BadRequestException(
        'Protected system journal — reverse via the originating workflow, do not delete',
      );
    }

    const accountIds = [...new Set(journal.lines.map((l) => l.accountId))];
    const accountRows = await this.prisma.account.findMany({
      where: { companyId, id: { in: accountIds } },
    });
    const typeMap = new Map(accountRows.map((a) => [a.id, a.type]));

    await this.prisma.$transaction(async (tx) => {
      for (const line of journal.lines) {
        const accountType = typeMap.get(line.accountId);
        if (!accountType) continue;
        const debit = Number(line.debit);
        const credit = Number(line.credit);
        const net = debit - credit;
        const delta = accountType === 'ASSET' || accountType === 'EXPENSE' ? net : -net;
        if (Math.abs(delta) < 0.0005) continue;
        await tx.account.update({
          where: { id: line.accountId },
          data: { currentBalance: { decrement: delta } },
        });
      }

      const bankRows = await tx.bankAccount.findMany({
        where: { companyId, accountId: { in: accountIds }, isActive: true },
      });
      for (const bank of bankRows) {
        if (!bank.accountId) continue;
        const related = journal.lines.filter((l) => l.accountId === bank.accountId);
        const bankDelta = related.reduce(
          (s, l) => s + (Number(l.debit) - Number(l.credit)),
          0,
        );
        if (Math.abs(bankDelta) < 0.0005) continue;
        await tx.bankAccount.update({
          where: { id: bank.id },
          data: { currentBalance: { decrement: bankDelta } },
        });
      }

      await tx.journal.delete({ where: { id } });
    });

    return { message: 'Journal deleted' };
  }
}
