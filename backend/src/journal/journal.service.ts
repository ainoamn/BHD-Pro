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

  async findAll(companyId: string) {
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

    for (const line of dto.lines) {
      const account = await this.prisma.account.findFirst({
        where: { id: line.accountId, companyId },
      });
      if (!account) throw new BadRequestException(`Account ${line.accountId} not found`);

      if (line.costCenterId) {
        const cc = await this.prisma.costCenter.findFirst({
          where: { id: line.costCenterId, companyId },
        });
        if (!cc) throw new BadRequestException('Cost center not found');
      }
      if (line.projectId) {
        const project = await this.prisma.project.findFirst({
          where: { id: line.projectId, companyId },
        });
        if (!project) throw new BadRequestException('Project not found');
      }
    }

    const number = await this.generateNumber(companyId);

    const accountIds = [...new Set(dto.lines.map((l) => l.accountId))];
    const accountRows = await this.prisma.account.findMany({
      where: { companyId, id: { in: accountIds } },
    });
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

      return journal;
    });
  }

  async remove(companyId: string, id: string) {
    const journal = await this.findOne(companyId, id);
    await this.periods.assertOpen(companyId, journal.date);
    await this.prisma.journal.delete({ where: { id } });
    return { message: 'Journal deleted' };
  }
}
