import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailNotifyService } from '../notifications/email-notify.service';
import { WhatsappNotifyService } from '../notifications/whatsapp-notify.service';
import { ManagementAlertsService } from '../management-alerts/management-alerts.service';
import { SaveManagerReportSubscriptionsDto } from './dto/manager-report.dto';

type Channels = { inApp?: boolean; email?: boolean; whatsapp?: boolean };
type Frequency = 'HOURLY' | 'EVERY_2_HOURS' | 'HALF_DAY' | 'END_OF_DAY';

@Injectable()
export class ManagerReportsService {
  private readonly logger = new Logger(ManagerReportsService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailNotifyService,
    private whatsapp: WhatsappNotifyService,
    private alerts: ManagementAlertsService,
  ) {}

  async list(companyId: string) {
    const [subscriptions, users] = await Promise.all([
      this.prisma.managerReportSubscription.findMany({
        where: { companyId },
        include: {
          user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        },
        orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.user.findMany({
        where: {
          companyId,
          isActive: true,
          role: { in: ['ADMIN', 'MANAGER', 'ACCOUNTANT'] as never[] },
        },
        select: { id: true, name: true, email: true, phone: true, role: true },
        orderBy: { name: 'asc' },
      }),
    ]);
    return {
      subscriptions: subscriptions.map((row) => ({
        ...row,
        channels: this.readChannels(row.channelsJson),
      })),
      recipients: users,
      channelStatus: {
        email: { configured: this.email.isConfigured(), mode: this.email.mode() },
        whatsapp: { configured: this.whatsapp.isConfigured(), mode: this.whatsapp.mode() },
      },
    };
  }

  async save(companyId: string, actorId: string, dto: SaveManagerReportSubscriptionsDto) {
    const keepIds = dto.subscriptions.map((s) => s.id).filter(Boolean) as string[];
    if (keepIds.length) {
      await this.prisma.managerReportSubscription.deleteMany({
        where: { companyId, id: { notIn: keepIds } },
      });
    } else {
      await this.prisma.managerReportSubscription.deleteMany({ where: { companyId } });
    }

    for (const sub of dto.subscriptions) {
      const user = await this.prisma.user.findFirst({
        where: { id: sub.userId, companyId, isActive: true },
        select: { id: true },
      });
      if (!user) throw new NotFoundException('Recipient user not found');
      const data = {
        userId: sub.userId,
        frequency: sub.frequency as never,
        channelsJson: sub.channels as never,
        isActive: sub.isActive !== false,
        createdById: actorId,
      };
      if (sub.id) {
        await this.prisma.managerReportSubscription.update({
          where: { id: sub.id },
          data,
        });
      } else {
        await this.prisma.managerReportSubscription.create({
          data: { companyId, ...data },
        });
      }
    }
    return this.list(companyId);
  }

  @Cron('*/15 * * * *')
  async runDueSubscriptions() {
    const rows = await this.prisma.managerReportSubscription.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        company: { select: { id: true, name: true } },
      },
      take: 200,
    });
    for (const row of rows) {
      if (!this.isDue(row.frequency as Frequency, row.lastSentAt)) continue;
      await this.dispatchOne(row.companyId, row.userId, row.id);
    }
  }

  async sendNow(companyId: string, userId?: string) {
    const where = {
      companyId,
      isActive: true,
      ...(userId ? { userId } : {}),
    };
    const rows = await this.prisma.managerReportSubscription.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        company: { select: { id: true, name: true } },
      },
    });
    for (const row of rows) {
      await this.dispatchOne(companyId, row.userId, row.id);
    }
    return { ok: true, count: rows.length };
  }

  private readChannels(raw: unknown): Required<Channels> {
    const data = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Channels) : {};
    return {
      inApp: data.inApp !== false,
      email: !!data.email,
      whatsapp: !!data.whatsapp,
    };
  }

  private isDue(frequency: Frequency, lastSentAt: Date | null) {
    if (!lastSentAt) return true;
    const diffMs = Date.now() - lastSentAt.getTime();
    const hour = 60 * 60 * 1000;
    if (frequency === 'HOURLY') return diffMs >= hour;
    if (frequency === 'EVERY_2_HOURS') return diffMs >= 2 * hour;
    if (frequency === 'HALF_DAY') return diffMs >= 12 * hour;
    return diffMs >= 24 * hour;
  }

  private async dispatchOne(companyId: string, userId: string, subscriptionId: string) {
    const subscription = await this.prisma.managerReportSubscription.findFirst({
      where: { id: subscriptionId, companyId, userId, isActive: true },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true } },
        company: { select: { id: true, name: true } },
      },
    });
    if (!subscription) return;
    const channels = this.readChannels(subscription.channelsJson);
    const summary = await this.buildSummary(companyId, subscription.company.name);
    const title = `ملخص الإدارة الدوري — ${subscription.company.name}`;
    if (channels.inApp) {
      await this.alerts.createAlert({
        companyId,
        type: 'MANAGER_DIGEST',
        severity: 'LOW',
        title,
        message: summary.text,
        payloadJson: { subscriptionId, frequency: subscription.frequency },
      });
    }
    if (channels.email && subscription.user.email) {
      await this.email.sendText({
        to: subscription.user.email,
        subject: title,
        text: summary.text,
        html: `<pre>${summary.text}</pre>`,
      });
    }
    if (channels.whatsapp && subscription.user.phone) {
      await this.whatsapp.sendText(subscription.user.phone, summary.shortText);
    }
    await this.prisma.managerReportSubscription.update({
      where: { id: subscriptionId },
      data: { lastSentAt: new Date() },
    });
  }

  private async buildSummary(companyId: string, companyName: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [salesInvoices, purchaseInvoices, openAlerts, users] = await Promise.all([
      this.prisma.invoice.aggregate({
        where: { companyId, type: 'SALES', date: { gte: start } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.invoice.aggregate({
        where: { companyId, type: 'PURCHASE', date: { gte: start } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      this.prisma.managementAlert.count({ where: { companyId, status: 'OPEN' } }),
      this.prisma.user.count({ where: { companyId, isActive: true } }),
    ]);
    const sales = Number(salesInvoices._sum.total || 0);
    const purchases = Number(purchaseInvoices._sum.total || 0);
    const text = [
      `ملخص ${companyName}`,
      `التاريخ: ${new Date().toLocaleString('en-GB')}`,
      `مبيعات اليوم: ${sales.toFixed(3)} (${salesInvoices._count._all} فواتير)`,
      `مشتريات اليوم: ${purchases.toFixed(3)} (${purchaseInvoices._count._all} فواتير)`,
      `المستخدمون النشطون: ${users}`,
      `تنبيهات الإدارة المفتوحة: ${openAlerts}`,
    ].join('\n');
    const shortText = `ملخص ${companyName}\nمبيعات: ${sales.toFixed(3)}\nمشتريات: ${purchases.toFixed(3)}\nتنبيهات مفتوحة: ${openAlerts}`;
    return { text, shortText };
  }
}
