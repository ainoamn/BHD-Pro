import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailNotifyService } from '../notifications/email-notify.service';

/** Daily: companies within 60 days of planExpiry get a weekly reminder email. */
@Injectable()
export class SubscriptionReminderService {
  private readonly logger = new Logger(SubscriptionReminderService.name);

  constructor(
    private prisma: PrismaService,
    private email: EmailNotifyService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async sendExpiryReminders() {
    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const companies = await this.prisma.company.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        planExpiry: { not: null, lte: in60, gte: now },
        OR: [
          { subscriptionReminderSentAt: null },
          { subscriptionReminderSentAt: { lte: weekAgo } },
        ],
      },
      include: {
        users: {
          where: { role: 'ADMIN', isActive: true },
          take: 3,
          select: { email: true, name: true },
        },
      },
      take: 200,
    });

    let sent = 0;
    let mocked = 0;
    for (const c of companies) {
      const expiry = c.planExpiry!;
      const daysLeft = Math.max(
        0,
        Math.ceil((expiry.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      );
      const recipients = [
        ...(c.email ? [c.email] : []),
        ...c.users.map((u) => u.email),
      ].filter(Boolean);
      const unique = Array.from(new Set(recipients.map((e) => e.toLowerCase())));
      if (!unique.length) continue;

      const subject = `تذكير اشتراك حسابي — متبقي ${daysLeft} يومًا`;
      const text = [
        `مرحباً،`,
        ``,
        `اشتراك شركة «${c.name}» على باقة ${c.plan} ينتهي بتاريخ ${expiry.toISOString().slice(0, 10)}.`,
        `المتبقي: ${daysLeft} يومًا.`,
        ``,
        `يرجى تجديد الاشتراك من صفحة الاشتراك في حسابي لتجنب انقطاع الخدمة.`,
        ``,
        `— فريق حسابي`,
      ].join('\n');

      let companyLive = 0;
      let companyMock = 0;
      for (const to of unique) {
        try {
          const res = await this.email.sendText({ to, subject, text });
          if (res.ok && res.mock) {
            companyMock += 1;
            mocked += 1;
          } else if (res.ok) {
            companyLive += 1;
            sent += 1;
          } else {
            this.logger.warn(
              `Reminder email failed for ${to}: ${res.error || 'unknown'}`,
            );
          }
        } catch (e) {
          this.logger.warn(`Reminder email failed for ${to}: ${e}`);
        }
      }

      // Stamp throttle even on mock so we do not spam logs daily; live count stays honest.
      if (companyLive > 0 || companyMock > 0) {
        await this.prisma.company.update({
          where: { id: c.id },
          data: { subscriptionReminderSentAt: now },
        });
      }
    }

    this.logger.log(
      `Subscription reminders processed: companies=${companies.length} liveEmails=${sent} mockEmails=${mocked}`,
    );
  }
}
