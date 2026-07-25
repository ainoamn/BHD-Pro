import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GlPostingService } from '../journal/gl-posting.service';
import { UpdateIncentivesConfigDto } from './dto/pos.dto';

const WALK_IN_NAME = 'POS Walk-in / نقدي';
const COMMISSION_CASH_OUT_REASON = 'Commission payout';

export type IncentivesConfig = {
  cashierEnabled?: boolean;
  cashierPercent?: number;
  cashierBonusTiers?: { minSales: number; bonusAmount: number }[];
  customerEnabled?: boolean;
  customerPointsPerUnit?: number;
};

@Injectable()
export class PosIncentivesService {
  private readonly logger = new Logger(PosIncentivesService.name);

  constructor(
    private prisma: PrismaService,
    private glPosting: GlPostingService,
  ) {}

  normalizeConfig(raw: unknown): IncentivesConfig {
    const c = (raw && typeof raw === 'object' ? raw : {}) as IncentivesConfig;
    const tiers = Array.isArray(c.cashierBonusTiers)
      ? c.cashierBonusTiers
          .filter(
            (t) =>
              t &&
              typeof t.minSales === 'number' &&
              typeof t.bonusAmount === 'number' &&
              t.minSales >= 0 &&
              t.bonusAmount >= 0,
          )
          .map((t) => ({
            minSales: Number(t.minSales),
            bonusAmount: Number(t.bonusAmount),
          }))
          .sort((a, b) => a.minSales - b.minSales)
      : [];
    return {
      cashierEnabled: c.cashierEnabled === true,
      cashierPercent:
        typeof c.cashierPercent === 'number' && c.cashierPercent >= 0
          ? Number(c.cashierPercent)
          : 0,
      cashierBonusTiers: tiers,
      customerEnabled: c.customerEnabled === true,
      customerPointsPerUnit:
        typeof c.customerPointsPerUnit === 'number' &&
        c.customerPointsPerUnit >= 0
          ? Number(c.customerPointsPerUnit)
          : 0,
    };
  }

  async getConfig(companyId: string): Promise<IncentivesConfig> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { incentivesConfig: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    return this.normalizeConfig(company.incentivesConfig);
  }

  async updateConfig(companyId: string, dto: UpdateIncentivesConfigDto) {
    const current = await this.getConfig(companyId);
    const next: IncentivesConfig = {
      cashierEnabled:
        dto.cashierEnabled !== undefined
          ? !!dto.cashierEnabled
          : current.cashierEnabled,
      cashierPercent:
        dto.cashierPercent !== undefined
          ? Math.max(0, Number(dto.cashierPercent))
          : current.cashierPercent,
      customerEnabled:
        dto.customerEnabled !== undefined
          ? !!dto.customerEnabled
          : current.customerEnabled,
      customerPointsPerUnit:
        dto.customerPointsPerUnit !== undefined
          ? Math.max(0, Number(dto.customerPointsPerUnit))
          : current.customerPointsPerUnit,
      cashierBonusTiers:
        dto.cashierBonusTiers !== undefined
          ? this.normalizeConfig({ cashierBonusTiers: dto.cashierBonusTiers })
              .cashierBonusTiers
          : current.cashierBonusTiers,
    };
    await this.prisma.company.update({
      where: { id: companyId },
      data: { incentivesConfig: next as unknown as Prisma.InputJsonValue },
    });
    return next;
  }

  /**
   * Best-effort accrual after a completed POS sale. Never throws to caller —
   * callers should wrap in try/catch as well.
   */
  async accrueOnSale(
    companyId: string,
    userId: string,
    invoice: { id: string; total: number | string | Prisma.Decimal },
    contactId?: string | null,
  ) {
    try {
      const config = await this.getConfig(companyId);
      const total = Number(invoice.total);
      if (!(total > 0)) return;

      if (config.cashierEnabled && (config.cashierPercent || 0) > 0) {
        const amount = Number(
          ((total * (config.cashierPercent || 0)) / 100).toFixed(3),
        );
        if (amount > 0) {
          const existing = await this.prisma.cashierCommissionLedger.findFirst({
            where: {
              companyId,
              userId,
              invoiceId: invoice.id,
              type: 'EARN',
            },
            select: { id: true },
          });
          if (!existing) {
            await this.prisma.cashierCommissionLedger.create({
              data: {
                companyId,
                userId,
                invoiceId: invoice.id,
                type: 'EARN',
                amount,
                note: 'POS sale commission',
              },
            });
          }
        }
      }

      if (
        config.customerEnabled &&
        contactId &&
        (config.customerPointsPerUnit || 0) > 0
      ) {
        const contact = await this.prisma.contact.findFirst({
          where: { id: contactId, companyId },
          select: { id: true, name: true },
        });
        if (contact && contact.name !== WALK_IN_NAME) {
          const points = Number(
            (total * (config.customerPointsPerUnit || 0)).toFixed(3),
          );
          if (points > 0) {
            const existing = await this.prisma.loyaltyPointsLedger.findFirst({
              where: {
                companyId,
                contactId: contact.id,
                invoiceId: invoice.id,
                type: 'EARN',
              },
              select: { id: true },
            });
            if (!existing) {
              await this.prisma.$transaction([
                this.prisma.loyaltyPointsLedger.create({
                  data: {
                    companyId,
                    contactId: contact.id,
                    invoiceId: invoice.id,
                    type: 'EARN',
                    points,
                    note: 'POS sale points',
                  },
                }),
                this.prisma.contact.update({
                  where: { id: contact.id },
                  data: { loyaltyPoints: { increment: points } },
                }),
              ]);
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn(
        `accrueOnSale failed company=${companyId} invoice=${invoice.id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  /** Best-effort reverse of commission + loyalty for a voided invoice. */
  async reverseOnVoid(
    companyId: string,
    invoiceId: string,
    cashierUserId?: string | null,
  ) {
    try {
      const commissionEarn =
        await this.prisma.cashierCommissionLedger.findFirst({
          where: {
            companyId,
            invoiceId,
            type: 'EARN',
            ...(cashierUserId ? { userId: cashierUserId } : {}),
          },
        });
      if (commissionEarn) {
        const already = await this.prisma.cashierCommissionLedger.findFirst({
          where: {
            companyId,
            invoiceId,
            type: 'ADJUST',
            note: { contains: 'void reverse' },
          },
          select: { id: true },
        });
        if (!already) {
          const amt = Number(commissionEarn.amount);
          await this.prisma.cashierCommissionLedger.create({
            data: {
              companyId,
              userId: commissionEarn.userId,
              invoiceId,
              type: 'ADJUST',
              amount: -amt,
              note: 'POS void reverse commission',
            },
          });
        }
      }

      const pointsEarn = await this.prisma.loyaltyPointsLedger.findFirst({
        where: { companyId, invoiceId, type: 'EARN' },
      });
      if (pointsEarn) {
        const already = await this.prisma.loyaltyPointsLedger.findFirst({
          where: {
            companyId,
            invoiceId,
            type: 'ADJUST',
            note: { contains: 'void reverse' },
          },
          select: { id: true },
        });
        if (!already) {
          const pts = Number(pointsEarn.points);
          await this.prisma.$transaction([
            this.prisma.loyaltyPointsLedger.create({
              data: {
                companyId,
                contactId: pointsEarn.contactId,
                invoiceId,
                type: 'ADJUST',
                points: -pts,
                note: 'POS void reverse points',
              },
            }),
            this.prisma.contact.update({
              where: { id: pointsEarn.contactId },
              data: { loyaltyPoints: { decrement: pts } },
            }),
          ]);
        }
      }
    } catch (err) {
      this.logger.warn(
        `reverseOnVoid failed company=${companyId} invoice=${invoiceId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private startOfDayMuscat(now = new Date()): Date {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Muscat',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = fmt.format(now);
    return new Date(`${dateStr}T00:00:00+04:00`);
  }

  async getCashierSummary(companyId: string, userId: string) {
    const config = await this.getConfig(companyId);
    const rows = await this.prisma.cashierCommissionLedger.findMany({
      where: { companyId, userId },
      select: { type: true, amount: true },
    });

    let earned = 0;
    let paid = 0;
    for (const row of rows) {
      const amt = Number(row.amount);
      if (row.type === 'PAYOUT') {
        paid += Math.abs(amt);
      } else {
        // EARN + ADJUST (signed)
        earned += amt;
      }
    }
    earned = Number(earned.toFixed(3));
    paid = Number(paid.toFixed(3));
    const remaining = Number(Math.max(0, earned - paid).toFixed(3));

    const from = this.startOfDayMuscat();
    const todayInvoices = await this.prisma.invoice.findMany({
      where: {
        companyId,
        createdById: userId,
        type: InvoiceType.SALES,
        isCash: true,
        notes: { contains: 'Hisaby POS' },
        createdAt: { gte: from },
        status: { not: InvoiceStatus.CANCELLED },
      },
      select: { total: true },
    });
    let todaySales = 0;
    for (const inv of todayInvoices) {
      todaySales += Number(inv.total);
    }
    todaySales = Number(todaySales.toFixed(3));
    const todayCommission = Number(
      (
        (todaySales * (config.cashierEnabled ? config.cashierPercent || 0 : 0)) /
        100
      ).toFixed(3),
    );

    const tiers = config.cashierBonusTiers || [];
    let nextTier: {
      minSales: number;
      bonusAmount: number;
      progress: number;
    } | null = null;
    for (const tier of tiers) {
      if (todaySales < tier.minSales) {
        nextTier = {
          minSales: tier.minSales,
          bonusAmount: tier.bonusAmount,
          progress: Number(
            Math.min(1, todaySales / Math.max(tier.minSales, 0.001)).toFixed(3),
          ),
        };
        break;
      }
    }

    return {
      earned,
      paid,
      remaining,
      todaySales,
      todayCommission,
      nextTier,
      config,
    };
  }

  async listCashierLedger(companyId: string, userId: string, take = 20) {
    const limit = Math.min(Math.max(take || 20, 1), 100);
    return this.prisma.cashierCommissionLedger.findMany({
      where: { companyId, userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        amount: true,
        note: true,
        invoiceId: true,
        createdAt: true,
      },
    });
  }

  async payout(
    companyId: string,
    adminId: string,
    cashierUserId: string,
    amount: number,
    note?: string,
    opts?: { deductFromDrawer?: boolean; warehouseId?: string },
  ) {
    const amt = Number(Number(amount).toFixed(3));
    if (!(amt > 0)) {
      throw new BadRequestException('Payout amount must be greater than zero');
    }

    const user = await this.prisma.user.findFirst({
      where: { id: cashierUserId, companyId, isActive: true },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Cashier user not found');

    const summary = await this.getCashierSummary(companyId, cashierUserId);
    if (amt > summary.remaining + 0.0005) {
      throw new BadRequestException(
        `Payout ${amt.toFixed(3)} exceeds remaining ${summary.remaining.toFixed(3)}`,
      );
    }

    const payoutNote = note?.trim() || COMMISSION_CASH_OUT_REASON;
    const ledger = await this.prisma.cashierCommissionLedger.create({
      data: {
        companyId,
        userId: cashierUserId,
        type: 'PAYOUT',
        amount: amt,
        note: payoutNote,
        createdById: adminId,
      },
    });

    const deductFromDrawer = opts?.deductFromDrawer !== false;
    if (!deductFromDrawer) {
      return { ledger, cashMovement: null };
    }

    const warehouseId = opts?.warehouseId || null;
    const shift = await this.prisma.posShift.findFirst({
      where: {
        companyId,
        status: 'OPEN',
        ...(warehouseId ? { warehouseId } : {}),
      },
      orderBy: { openedAt: 'desc' },
      select: { id: true },
    });

    if (!shift) {
      this.logger.warn(
        `Commission payout ${ledger.id}: no open shift for drawer deduct (warehouse=${warehouseId || 'default'})`,
      );
      return { ledger, cashMovement: null };
    }

    let cashMovement = await this.prisma.posCashMovement.create({
      data: {
        companyId,
        shiftId: shift.id,
        type: 'OUT',
        amount: amt,
        reason: COMMISSION_CASH_OUT_REASON,
        createdById: adminId,
      },
      include: {
        createdBy: { select: { id: true, name: true } },
      },
    });

    const reference = `POS-CASH-OUT:${cashMovement.id}`;
    const journal = await this.glPosting.postPosCashOut(companyId, adminId, {
      amount: amt,
      reason: COMMISSION_CASH_OUT_REASON,
      reference,
    });

    if (journal?.id) {
      cashMovement = await this.prisma.posCashMovement.update({
        where: { id: cashMovement.id },
        data: { journalId: journal.id },
        include: {
          createdBy: { select: { id: true, name: true } },
        },
      });
    }

    return { ledger, cashMovement };
  }

  async getContactPoints(companyId: string, contactId: string) {
    const config = await this.getConfig(companyId);
    const contact = await this.prisma.contact.findFirst({
      where: { id: contactId, companyId },
      select: { id: true, name: true, loyaltyPoints: true },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return {
      contactId: contact.id,
      name: contact.name,
      points: Number(contact.loyaltyPoints),
      customerEnabled: !!config.customerEnabled,
      pointsPerUnit: config.customerPointsPerUnit || 0,
    };
  }
}
