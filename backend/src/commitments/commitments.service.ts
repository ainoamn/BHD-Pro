import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { GlPostingService } from '../journal/gl-posting.service';
import {
  CreateCommitmentDto,
  UpdateCommitmentDto,
  PauseCommitmentDto,
} from './dto/commitment.dto';

@Injectable()
export class CommitmentsService {
  private readonly logger = new Logger(CommitmentsService.name);

  constructor(
    private prisma: PrismaService,
    private glPosting: GlPostingService,
  ) {}

  findAll(companyId: string) {
    return this.prisma.recurringCommitment.findMany({
      where: { companyId },
      orderBy: { nextRunAt: 'asc' },
      include: { bankAccount: true },
    });
  }

  async findOne(companyId: string, id: string) {
    const row = await this.prisma.recurringCommitment.findFirst({
      where: { id, companyId },
      include: { bankAccount: true },
    });
    if (!row) throw new NotFoundException('Commitment not found');
    return row;
  }

  create(companyId: string, dto: CreateCommitmentDto) {
    return this.prisma.recurringCommitment.create({
      data: {
        companyId,
        name: dto.name,
        type: dto.type || 'OTHER',
        amount: dto.amount,
        currency: dto.currency || 'OMR',
        frequency: dto.frequency || 'MONTHLY',
        nextRunAt: new Date(dto.nextRunAt),
        dayOfMonth: dto.dayOfMonth,
        expenseAccountId: dto.expenseAccountId,
        payableAccountId: dto.payableAccountId,
        bankAccountId: dto.bankAccountId,
        contactId: dto.contactId,
        notes: dto.notes,
      },
      include: { bankAccount: true },
    });
  }

  async update(companyId: string, id: string, dto: UpdateCommitmentDto) {
    await this.findOne(companyId, id);
    return this.prisma.recurringCommitment.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
        ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
        ...(dto.nextRunAt !== undefined ? { nextRunAt: new Date(dto.nextRunAt) } : {}),
        ...(dto.dayOfMonth !== undefined ? { dayOfMonth: dto.dayOfMonth } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.pausedUntil !== undefined
          ? { pausedUntil: dto.pausedUntil ? new Date(dto.pausedUntil) : null }
          : {}),
        ...(dto.expenseAccountId !== undefined
          ? { expenseAccountId: dto.expenseAccountId }
          : {}),
        ...(dto.payableAccountId !== undefined
          ? { payableAccountId: dto.payableAccountId }
          : {}),
        ...(dto.bankAccountId !== undefined ? { bankAccountId: dto.bankAccountId } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
      include: { bankAccount: true },
    });
  }

  async pause(companyId: string, id: string, dto: PauseCommitmentDto) {
    const row = await this.findOne(companyId, id);
    let pausedUntil = dto.pausedUntil ? new Date(dto.pausedUntil) : null;
    if (!pausedUntil && dto.deferUnit) {
      const count = dto.deferCount || 1;
      pausedUntil = new Date();
      if (dto.deferUnit === 'DAY') pausedUntil.setDate(pausedUntil.getDate() + count);
      else if (dto.deferUnit === 'MONTH') pausedUntil.setMonth(pausedUntil.getMonth() + count);
      else if (dto.deferUnit === 'YEAR') pausedUntil.setFullYear(pausedUntil.getFullYear() + count);
      else throw new BadRequestException('deferUnit must be DAY, MONTH, or YEAR');
    }
    return this.prisma.recurringCommitment.update({
      where: { id: row.id },
      data: {
        status: 'PAUSED',
        pausedUntil,
        nextRunAt: pausedUntil || row.nextRunAt,
      },
      include: { bankAccount: true },
    });
  }

  async resume(companyId: string, id: string) {
    await this.findOne(companyId, id);
    return this.prisma.recurringCommitment.update({
      where: { id },
      data: { status: 'ACTIVE', pausedUntil: null },
      include: { bankAccount: true },
    });
  }

  async remove(companyId: string, id: string) {
    await this.findOne(companyId, id);
    const accruals = await this.prisma.journal.findMany({
      where: { companyId, reference: { startsWith: `COMMIT:${id}:` } },
      select: { id: true },
    });
    for (const j of accruals) {
      const rev = await this.prisma.journal.findFirst({
        where: { companyId, reference: `REV-COMMIT:${j.id}` },
        select: { id: true },
      });
      if (!rev) {
        throw new BadRequestException(
          'Reverse commitment accruals (reverse-last) before deleting',
        );
      }
    }
    await this.prisma.recurringCommitment.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  async reverseLast(companyId: string, userId: string, id: string) {
    const row = await this.findOne(companyId, id);
    const last = await this.prisma.journal.findFirst({
      where: { companyId, reference: { startsWith: `COMMIT:${id}:` } },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) {
      throw new BadRequestException('No commitment accrual to reverse');
    }
    const already = await this.prisma.journal.findFirst({
      where: { companyId, reference: `REV-COMMIT:${last.id}` },
    });
    if (already) {
      // Find next unreversed
      const all = await this.prisma.journal.findMany({
        where: { companyId, reference: { startsWith: `COMMIT:${id}:` } },
        orderBy: { createdAt: 'desc' },
      });
      let target = null as typeof last | null;
      for (const j of all) {
        const rev = await this.prisma.journal.findFirst({
          where: { companyId, reference: `REV-COMMIT:${j.id}` },
        });
        if (!rev) {
          target = j;
          break;
        }
      }
      if (!target) {
        throw new BadRequestException('All commitment accruals already reversed');
      }
      const journal = await this.glPosting.reverseCommitmentAccrual(
        companyId,
        userId,
        row,
        target.id,
      );
      if (!journal) throw new BadRequestException('Failed to reverse commitment accrual');
      return { reversedJournalId: target.id, reverseJournalId: journal.id };
    }

    const journal = await this.glPosting.reverseCommitmentAccrual(
      companyId,
      userId,
      row,
      last.id,
    );
    if (!journal) throw new BadRequestException('Failed to reverse commitment accrual');
    return { reversedJournalId: last.id, reverseJournalId: journal.id };
  }

  private advanceNextRun(from: Date, frequency: string, dayOfMonth?: number | null) {
    const next = new Date(from);
    if (frequency === 'WEEKLY') next.setDate(next.getDate() + 7);
    else if (frequency === 'QUARTERLY') next.setMonth(next.getMonth() + 3);
    else if (frequency === 'YEARLY') next.setFullYear(next.getFullYear() + 1);
    else next.setMonth(next.getMonth() + 1);

    if (dayOfMonth && dayOfMonth >= 1 && dayOfMonth <= 28) {
      next.setDate(dayOfMonth);
    }
    return next;
  }

  async runDue(companyId?: string) {
    const now = new Date();
    const due = await this.prisma.recurringCommitment.findMany({
      where: {
        ...(companyId ? { companyId } : {}),
        status: 'ACTIVE',
        nextRunAt: { lte: now },
        OR: [{ pausedUntil: null }, { pausedUntil: { lte: now } }],
      },
    });

    let processed = 0;
    for (const row of due) {
      const admin = await this.prisma.user.findFirst({
        where: { companyId: row.companyId, isActive: true },
        orderBy: { createdAt: 'asc' },
      });
      if (!admin) continue;

      try {
        await this.glPosting.postCommitmentAccrual(row.companyId, admin.id, row);
        await this.prisma.recurringCommitment.update({
          where: { id: row.id },
          data: {
            lastRunAt: now,
            nextRunAt: this.advanceNextRun(row.nextRunAt, row.frequency, row.dayOfMonth),
          },
        });
        processed += 1;
      } catch (err) {
        this.logger.warn(`Commitment ${row.id} failed: ${String(err)}`);
      }
    }
    return { processed, total: due.length };
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM)
  async dailyRun() {
    const result = await this.runDue();
    if (result.processed > 0) {
      this.logger.log(`Recurring commitments posted: ${result.processed}/${result.total}`);
    }
  }
}
