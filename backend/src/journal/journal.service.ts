import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJournalDto } from './dto/create-journal.dto';

@Injectable()
export class JournalService {
  constructor(private prisma: PrismaService) {}

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
        lines: { include: { account: { select: { code: true, name: true } } } },
        createdBy: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findOne(companyId: string, id: string) {
    const journal = await this.prisma.journal.findFirst({
      where: { id, companyId },
      include: {
        lines: { include: { account: true } },
        createdBy: { select: { name: true, email: true } },
      },
    });
    if (!journal) throw new NotFoundException('Journal not found');
    return journal;
  }

  async create(companyId: string, userId: string, dto: CreateJournalDto) {
    if (!dto.lines?.length) throw new BadRequestException('At least one line required');

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
    }

    const number = await this.generateNumber(companyId);

    return this.prisma.journal.create({
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
          })),
        },
      },
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    await this.prisma.journal.delete({ where: { id } });
    return { message: 'Journal deleted' };
  }
}
