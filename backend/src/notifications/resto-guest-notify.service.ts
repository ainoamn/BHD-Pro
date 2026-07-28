import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappNotifyService } from './whatsapp-notify.service';
import { SmsNotifyService } from './sms-notify.service';
import {
  dialCodeForCountry,
  isValidMobileE164,
  toE164Digits,
} from '../common/phone';

export type RestoGuestNotifyKind =
  | 'WAITLIST_READY'
  | 'RESERVATION_CONFIRM'
  | 'RESERVATION_REMIND'
  | 'RESERVATION_TABLE_READY'
  | 'DELIVERY_OUT'
  | 'DELIVERY_DONE'
  | 'TAKEAWAY_READY';

@Injectable()
export class RestoGuestNotifyService {
  private readonly logger = new Logger(RestoGuestNotifyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappNotifyService,
    private readonly sms: SmsNotifyService,
  ) {}

  frontendBaseUrl(): string {
    const raw =
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:3000';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  newConfirmToken(): string {
    return randomBytes(18).toString('base64url');
  }

  messagingReady(): boolean {
    return this.whatsapp.isConfigured() || this.sms.isConfigured();
  }

  private async normalizePhone(
    companyId: string,
    phone: string,
  ): Promise<string | null> {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { country: true },
    });
    const dial = dialCodeForCountry(company?.country || 'OM');
    const digits = toE164Digits(phone, dial);
    if (!digits || !isValidMobileE164(digits)) return null;
    return digits.startsWith('+') ? digits : `+${digits}`;
  }

  private buildBody(
    companyName: string,
    guestName: string,
    kind: RestoGuestNotifyKind,
    opts: {
      quotedMinutes?: number | null;
      tableCode?: string | null;
      reservedAt?: Date | null;
      confirmUrl?: string | null;
      locale?: 'ar' | 'en';
    },
  ): string {
    const ar = opts.locale !== 'en';
    const when = opts.reservedAt
      ? opts.reservedAt.toLocaleString(ar ? 'ar' : 'en-GB', {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';

    if (kind === 'WAITLIST_READY') {
      return ar
        ? `مرحباً ${guestName}، طاولتكم جاهزة في ${companyName}${opts.tableCode ? ` (${opts.tableCode})` : ''}. تفضلوا بالتوجه للاستقبال.`
        : `Hi ${guestName}, your table is ready at ${companyName}${opts.tableCode ? ` (${opts.tableCode})` : ''}. Please come to the host stand.`;
    }
    if (kind === 'RESERVATION_CONFIRM') {
      return ar
        ? `تم تأكيد حجزكم في ${companyName} باسم ${guestName}${when ? ` يوم ${when}` : ''}.${opts.confirmUrl ? `\nإدارة الحجز: ${opts.confirmUrl}` : ''}`
        : `Your reservation at ${companyName} for ${guestName}${when ? ` on ${when}` : ''} is confirmed.${opts.confirmUrl ? `\nManage: ${opts.confirmUrl}` : ''}`;
    }
    if (kind === 'RESERVATION_REMIND') {
      return ar
        ? `تذكير: حجزكم في ${companyName}${when ? ` يوم ${when}` : ''} باسم ${guestName}. نتطلع لزيارتكم.${opts.confirmUrl ? `\n${opts.confirmUrl}` : ''}`
        : `Reminder: your reservation at ${companyName}${when ? ` on ${when}` : ''} for ${guestName}. We look forward to seeing you.${opts.confirmUrl ? `\n${opts.confirmUrl}` : ''}`;
    }
    if (kind === 'DELIVERY_OUT') {
      return ar
        ? `مرحباً ${guestName}، طلبكم من ${companyName} في الطريق إليكم.`
        : `Hi ${guestName}, your order from ${companyName} is on the way.`;
    }
    if (kind === 'DELIVERY_DONE') {
      return ar
        ? `مرحباً ${guestName}، تم تسليم طلبكم من ${companyName}. نتمنى أن تستمتعوا.`
        : `Hi ${guestName}, your order from ${companyName} was delivered. Enjoy!`;
    }
    if (kind === 'TAKEAWAY_READY') {
      return ar
        ? `مرحباً ${guestName}، طلبكم للاستلام من ${companyName} جاهز. تفضلوا بالاستلام.`
        : `Hi ${guestName}, your takeaway order from ${companyName} is ready for pickup.`;
    }
    return ar
      ? `مرحباً ${guestName}، طاولتكم للحجز جاهزة في ${companyName}${opts.tableCode ? ` (${opts.tableCode})` : ''}.`
      : `Hi ${guestName}, your reserved table is ready at ${companyName}${opts.tableCode ? ` (${opts.tableCode})` : ''}.`;
  }

  /**
   * Best-effort WhatsApp → SMS. Never throws.
   */
  async notifyGuest(opts: {
    companyId: string;
    phone?: string | null;
    guestName: string;
    kind: RestoGuestNotifyKind;
    quotedMinutes?: number | null;
    tableCode?: string | null;
    reservedAt?: Date | null;
    confirmUrl?: string | null;
    locale?: 'ar' | 'en';
  }): Promise<{
    ok: boolean;
    channel: 'WHATSAPP' | 'SMS' | null;
    error?: string;
    mock?: boolean;
    mode?: string;
  }> {
    try {
      if (!opts.phone?.trim()) {
        return { ok: false, channel: null, error: 'no_phone' };
      }
      if (!this.messagingReady()) {
        return { ok: false, channel: null, error: 'messaging_off' };
      }
      const e164 = await this.normalizePhone(opts.companyId, opts.phone);
      if (!e164) {
        return { ok: false, channel: null, error: 'invalid_phone' };
      }
      const company = await this.prisma.company.findUnique({
        where: { id: opts.companyId },
        select: { name: true },
      });
      const body = this.buildBody(
        company?.name || 'Hisaby Resto',
        opts.guestName,
        opts.kind,
        opts,
      );

      if (this.whatsapp.isConfigured()) {
        const kindTitle =
          opts.kind === 'WAITLIST_READY'
            ? opts.locale === 'en'
              ? 'Table ready'
              : 'الطاولة جاهزة'
            : opts.kind === 'RESERVATION_CONFIRM'
              ? opts.locale === 'en'
                ? 'Reservation confirmed'
                : 'تأكيد الحجز'
              : opts.kind === 'RESERVATION_REMIND'
                ? opts.locale === 'en'
                  ? 'Reservation reminder'
                  : 'تذكير بالحجز'
                : opts.kind === 'DELIVERY_OUT'
                  ? opts.locale === 'en'
                    ? 'Out for delivery'
                    : 'الطلب في الطريق'
                  : opts.kind === 'DELIVERY_DONE'
                    ? opts.locale === 'en'
                      ? 'Delivered'
                      : 'تم التسليم'
                    : opts.kind === 'TAKEAWAY_READY'
                      ? opts.locale === 'en'
                        ? 'Takeaway ready'
                        : 'جاهز للاستلام'
                      : opts.locale === 'en'
                        ? 'Reserved table ready'
                        : 'طاولة الحجز جاهزة';
        const detailParts = [
          opts.tableCode ? `table ${opts.tableCode}` : '',
          opts.quotedMinutes != null ? `${opts.quotedMinutes} min` : '',
          opts.reservedAt
            ? opts.reservedAt.toLocaleString(
                opts.locale === 'en' ? 'en-GB' : 'ar',
                { dateStyle: 'medium', timeStyle: 'short' },
              )
            : '',
        ].filter(Boolean);
        const res = await this.whatsapp.sendGuestNotify(e164, {
          guestName: opts.guestName,
          companyName: company?.name || 'Hisaby Resto',
          title: kindTitle,
          detail: detailParts.join(' · ') || kindTitle,
          link: opts.confirmUrl || null,
          fullBody: body,
        });
        if (res.ok) {
          return {
            ok: true,
            channel: 'WHATSAPP',
            mock: !!res.mock,
            mode: res.mock ? 'mock' : this.whatsapp.mode(),
          };
        }
        this.logger.warn(`WhatsApp resto notify failed: ${res.error}`);
      }
      if (this.sms.isConfigured()) {
        const res = await this.sms.sendText({ to: e164, body });
        if (res.ok) {
          return {
            ok: true,
            channel: 'SMS',
            mock: !!res.mock,
            mode: res.mock ? 'mock' : this.sms.mode(),
          };
        }
        return {
          ok: false,
          channel: 'SMS',
          error: res.error || 'sms_fail',
        };
      }
      return {
        ok: false,
        channel: null,
        error: 'send_failed',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'notify_failed';
      this.logger.warn(`resto guest notify: ${message}`);
      return { ok: false, channel: null, error: message };
    }
  }
}
