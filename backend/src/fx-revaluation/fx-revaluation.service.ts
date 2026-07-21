import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  InvoiceStatus,
  InvoiceType,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { GlPostingService } from '../journal/gl-posting.service';
import { PostFxRevaluationDto } from './dto/post-fx-revaluation.dto';

export type FxPreviewItem = {
  invoiceId: string;
  number: string;
  type: InvoiceType;
  currency: string;
  foreignRemaining: number;
  bookedBaseRemaining: number;
  rateAtInvoice: number;
  rateAsOf: number;
  revaluedBase: number;
  gainLoss: number;
  pnlImpact: number;
};

@Injectable()
export class FxRevaluationService {
  constructor(
    private prisma: PrismaService,
    private rates: ExchangeRatesService,
    private glPosting: GlPostingService,
  ) {}

  async preview(companyId: string, asOf?: string) {
    const asOfDate = asOf || new Date().toISOString().slice(0, 10);
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { currency: true },
    });
    const companyCurrency = (company?.currency || 'OMR').toUpperCase();

    await this.glPosting.ensureFxAccounts(companyId);

    const invoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        type: { in: [InvoiceType.SALES, InvoiceType.PURCHASE] },
        status: {
          notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED, InvoiceStatus.PAID],
        },
        paymentStatus: { in: [PaymentStatus.UNPAID, PaymentStatus.PARTIAL] },
        currency: { not: companyCurrency },
        foreignTotal: { not: null },
      },
      select: {
        id: true,
        number: true,
        type: true,
        currency: true,
        exchangeRate: true,
        foreignTotal: true,
        total: true,
        paidAmount: true,
      },
      orderBy: { date: 'asc' },
    });

    const items: FxPreviewItem[] = [];
    const skipped: Array<{ invoiceId: string; number: string; reason: string }> = [];

    for (const inv of invoices) {
      const totalBase = Number(inv.total);
      const paidBase = Number(inv.paidAmount);
      const bookedBaseRemaining = Number((totalBase - paidBase).toFixed(3));
      if (bookedBaseRemaining <= 0.0005) continue;

      const foreignTotal = Number(inv.foreignTotal || 0);
      if (foreignTotal <= 0 || totalBase <= 0) {
        skipped.push({
          invoiceId: inv.id,
          number: inv.number,
          reason: 'Missing foreign total',
        });
        continue;
      }

      const foreignRemaining = Number(
        ((foreignTotal * bookedBaseRemaining) / totalBase).toFixed(3),
      );
      const rateAtInvoice = Number(inv.exchangeRate || 1);

      try {
        const conv = await this.rates.convert(
          companyId,
          inv.currency,
          companyCurrency,
          foreignRemaining,
          asOfDate,
        );
        const revaluedBase = Number(Number(conv.converted).toFixed(3));
        const rateAsOf = Number(conv.rate);
        const gainLoss = Number((revaluedBase - bookedBaseRemaining).toFixed(3));
        // AR: +gainLoss is income; AP: higher liability is expense → invert
        const pnlImpact =
          inv.type === InvoiceType.SALES
            ? gainLoss
            : Number((-gainLoss).toFixed(3));

        if (Math.abs(gainLoss) < 0.001) continue;

        items.push({
          invoiceId: inv.id,
          number: inv.number,
          type: inv.type,
          currency: inv.currency,
          foreignRemaining,
          bookedBaseRemaining,
          rateAtInvoice,
          rateAsOf,
          revaluedBase,
          gainLoss,
          pnlImpact,
        });
      } catch (err) {
        skipped.push({
          invoiceId: inv.id,
          number: inv.number,
          reason:
            err instanceof NotFoundException
              ? `No exchange rate for ${inv.currency}→${companyCurrency}`
              : 'Conversion failed',
        });
      }
    }

    const unrealizedGain = Number(
      items
        .filter((i) => i.pnlImpact > 0)
        .reduce((s, i) => s + i.pnlImpact, 0)
        .toFixed(3),
    );
    const unrealizedLoss = Number(
      items
        .filter((i) => i.pnlImpact < 0)
        .reduce((s, i) => s + Math.abs(i.pnlImpact), 0)
        .toFixed(3),
    );

    return {
      asOf: asOfDate,
      companyCurrency,
      items,
      skipped,
      totals: {
        unrealizedGain,
        unrealizedLoss,
        net: Number((unrealizedGain - unrealizedLoss).toFixed(3)),
        count: items.length,
      },
    };
  }

  async post(companyId: string, userId: string, dto: PostFxRevaluationDto) {
    const asOfDate = dto.asOf.slice(0, 10);
    const existing = await this.prisma.journal.findFirst({
      where: { companyId, reference: `FX-REV:${asOfDate}` },
    });
    if (existing) {
      throw new BadRequestException(
        `FX revaluation already posted for ${asOfDate} (${existing.number})`,
      );
    }

    const preview = await this.preview(companyId, asOfDate);
    let items = preview.items;
    if (dto.invoiceIds?.length) {
      const allow = new Set(dto.invoiceIds);
      items = items.filter((i) => allow.has(i.invoiceId));
    }
    if (!items.length) {
      throw new BadRequestException('No FX differences to post');
    }

    await this.glPosting.ensureFxAccounts(companyId);
    const [ar, ap, fxGain, fxLoss] = await Promise.all([
      this.prisma.account.findFirst({
        where: { companyId, code: '1300', isActive: true },
      }),
      this.prisma.account.findFirst({
        where: { companyId, code: '2100', isActive: true },
      }),
      this.prisma.account.findFirst({
        where: { companyId, code: '4200', isActive: true },
      }),
      this.prisma.account.findFirst({
        where: { companyId, code: '5400', isActive: true },
      }),
    ]);

    if (!ar || !ap || !fxGain || !fxLoss) {
      throw new BadRequestException('Required GL accounts missing (AR/AP/FX)');
    }

    type Line = {
      accountId: string;
      description?: string;
      debit: number;
      credit: number;
    };
    const lines: Line[] = [];

    for (const item of items) {
      const abs = Math.abs(item.gainLoss);
      const desc = `FX ${item.number} (${item.currency})`;

      if (item.type === InvoiceType.SALES) {
        if (item.gainLoss > 0) {
          // AR up, gain
          lines.push(
            { accountId: ar.id, description: desc, debit: abs, credit: 0 },
            { accountId: fxGain.id, description: desc, debit: 0, credit: abs },
          );
        } else {
          // AR down, loss
          lines.push(
            { accountId: fxLoss.id, description: desc, debit: abs, credit: 0 },
            { accountId: ar.id, description: desc, debit: 0, credit: abs },
          );
        }
      } else {
        // PURCHASE / AP
        if (item.gainLoss > 0) {
          // AP up (owe more) = loss
          lines.push(
            { accountId: fxLoss.id, description: desc, debit: abs, credit: 0 },
            { accountId: ap.id, description: desc, debit: 0, credit: abs },
          );
        } else {
          // AP down = gain
          lines.push(
            { accountId: ap.id, description: desc, debit: abs, credit: 0 },
            { accountId: fxGain.id, description: desc, debit: 0, credit: abs },
          );
        }
      }
    }

    const journal = await this.glPosting.postFxRevaluation(
      companyId,
      userId,
      new Date(asOfDate),
      lines,
    );

    if (!journal) {
      throw new BadRequestException('Failed to create FX revaluation journal');
    }

    const netGainLoss = Number(
      items.reduce((s, i) => s + i.pnlImpact, 0).toFixed(3),
    );

    return {
      journalId: journal.id,
      journalNumber: journal.number,
      asOf: asOfDate,
      postedCount: items.length,
      netGainLoss,
      items,
    };
  }
}
