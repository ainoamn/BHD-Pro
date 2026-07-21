import {
  Injectable,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PeriodsService {
  constructor(private prisma: PrismaService) {}

  private monthLabel(year: number, month: number) {
    return `${year}-${String(month).padStart(2, '0')}`;
  }

  /** Ensure 12 months exist for a year (unlocked by default). */
  async ensureYear(companyId: string, year: number) {
    const existing = await this.prisma.accountingPeriod.findMany({
      where: { companyId, year },
    });
    const have = new Set(existing.map((p) => p.month));
    const toCreate = [];
    for (let m = 1; m <= 12; m++) {
      if (!have.has(m)) {
        toCreate.push({ companyId, year, month: m, isLocked: false });
      }
    }
    if (toCreate.length) {
      await this.prisma.accountingPeriod.createMany({ data: toCreate });
    }
    return this.listYear(companyId, year);
  }

  async listYear(companyId: string, year: number) {
    await this.ensureYear(companyId, year);
    return this.prisma.accountingPeriod.findMany({
      where: { companyId, year },
      include: { lockedBy: { select: { id: true, name: true } } },
      orderBy: { month: 'asc' },
    });
  }

  async lock(companyId: string, userId: string, year: number, month: number) {
    this.validateYm(year, month);
    await this.ensureYear(companyId, year);
    return this.prisma.accountingPeriod.update({
      where: { companyId_year_month: { companyId, year, month } },
      data: {
        isLocked: true,
        lockedAt: new Date(),
        lockedById: userId,
      },
      include: { lockedBy: { select: { id: true, name: true } } },
    });
  }

  async unlock(companyId: string, userRole: string, year: number, month: number) {
    this.validateYm(year, month);
    if (userRole !== 'ADMIN') {
      throw new ForbiddenException('Only admin can unlock periods');
    }
    await this.ensureYear(companyId, year);
    return this.prisma.accountingPeriod.update({
      where: { companyId_year_month: { companyId, year, month } },
      data: {
        isLocked: false,
        lockedAt: null,
        lockedById: null,
      },
      include: { lockedBy: { select: { id: true, name: true } } },
    });
  }

  /** Throw if the date falls in a locked period. */
  async assertOpen(companyId: string, date: Date | string) {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    const period = await this.prisma.accountingPeriod.findUnique({
      where: { companyId_year_month: { companyId, year, month } },
    });

    if (period?.isLocked) {
      throw new BadRequestException(
        `Accounting period ${this.monthLabel(year, month)} is locked`,
      );
    }
  }

  private validateYm(year: number, month: number) {
    if (!year || year < 2000 || year > 2100) {
      throw new BadRequestException('Invalid year');
    }
    if (!month || month < 1 || month > 12) {
      throw new BadRequestException('Invalid month');
    }
  }
}
