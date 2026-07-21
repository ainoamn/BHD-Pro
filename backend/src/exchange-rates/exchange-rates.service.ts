import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRateDto } from './dto/exchange-rate.dto';

@Injectable()
export class ExchangeRatesService {
  constructor(private prisma: PrismaService) {}

  private norm(code: string) {
    return code.trim().toUpperCase();
  }

  private dayStart(date: string) {
    return new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  }

  findAll(companyId: string) {
    return this.prisma.exchangeRate.findMany({
      where: { companyId },
      orderBy: [{ date: 'desc' }, { fromCurrency: 'asc' }, { toCurrency: 'asc' }],
    });
  }

  async create(companyId: string, dto: ExchangeRateDto) {
    const fromCurrency = this.norm(dto.fromCurrency);
    const toCurrency = this.norm(dto.toCurrency);
    if (fromCurrency === toCurrency) {
      throw new BadRequestException('fromCurrency and toCurrency must differ');
    }
    const date = this.dayStart(dto.date);

    const dup = await this.prisma.exchangeRate.findFirst({
      where: { companyId, fromCurrency, toCurrency, date },
    });
    if (dup) throw new ConflictException('Rate already exists for this pair and date');

    return this.prisma.exchangeRate.create({
      data: {
        companyId,
        fromCurrency,
        toCurrency,
        rate: dto.rate,
        date,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async update(companyId: string, id: string, dto: Partial<ExchangeRateDto>) {
    const existing = await this.ensure(companyId, id);
    const fromCurrency = dto.fromCurrency
      ? this.norm(dto.fromCurrency)
      : existing.fromCurrency;
    const toCurrency = dto.toCurrency ? this.norm(dto.toCurrency) : existing.toCurrency;
    if (fromCurrency === toCurrency) {
      throw new BadRequestException('fromCurrency and toCurrency must differ');
    }
    const date = dto.date ? this.dayStart(dto.date) : existing.date;

    const dup = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency,
        toCurrency,
        date,
        NOT: { id },
      },
    });
    if (dup) throw new ConflictException('Rate already exists for this pair and date');

    return this.prisma.exchangeRate.update({
      where: { id },
      data: {
        fromCurrency,
        toCurrency,
        ...(dto.rate !== undefined && { rate: dto.rate }),
        date,
        ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
      },
    });
  }

  async remove(companyId: string, id: string) {
    await this.ensure(companyId, id);
    await this.prisma.exchangeRate.delete({ where: { id } });
    return { message: 'Deleted' };
  }

  /** Resolve rate for pair on or before date; falls back to inverse rate */
  async convert(
    companyId: string,
    fromCurrency: string,
    toCurrency: string,
    amount: number,
    date?: string,
  ) {
    const from = this.norm(fromCurrency);
    const to = this.norm(toCurrency);
    if (!Number.isFinite(amount)) {
      throw new BadRequestException('Invalid amount');
    }
    if (from === to) {
      return {
        fromCurrency: from,
        toCurrency: to,
        amount,
        rate: 1,
        converted: Number(amount.toFixed(3)),
        date: date || null,
        source: 'identity' as const,
      };
    }

    const asOf = date ? this.dayStart(date) : new Date();
    const direct = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency: from,
        toCurrency: to,
        date: { lte: asOf },
      },
      orderBy: { date: 'desc' },
    });
    if (direct) {
      const rate = Number(direct.rate);
      return {
        fromCurrency: from,
        toCurrency: to,
        amount,
        rate,
        converted: Number((amount * rate).toFixed(3)),
        date: direct.date,
        source: 'direct' as const,
      };
    }

    const inverse = await this.prisma.exchangeRate.findFirst({
      where: {
        companyId,
        fromCurrency: to,
        toCurrency: from,
        date: { lte: asOf },
      },
      orderBy: { date: 'desc' },
    });
    if (inverse) {
      const rate = Number((1 / Number(inverse.rate)).toFixed(6));
      return {
        fromCurrency: from,
        toCurrency: to,
        amount,
        rate,
        converted: Number((amount * rate).toFixed(3)),
        date: inverse.date,
        source: 'inverse' as const,
      };
    }

    throw new NotFoundException(
      `No exchange rate found for ${from}→${to} on or before ${asOf.toISOString().slice(0, 10)}`,
    );
  }

  private async ensure(companyId: string, id: string) {
    const row = await this.prisma.exchangeRate.findFirst({
      where: { id, companyId },
    });
    if (!row) throw new NotFoundException('Exchange rate not found');
    return row;
  }
}
