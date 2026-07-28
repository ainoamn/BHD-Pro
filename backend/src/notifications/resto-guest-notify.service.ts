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
  | 'WAITLIST_CANCELLED'
  | 'RESERVATION_CONFIRM'
  | 'RESERVATION_REMIND'
  | 'RESERVATION_TABLE_READY'
  | 'RESERVATION_CANCELLED'
  | 'RESERVATION_NO_SHOW'
  | 'DELIVERY_OUT'
  | 'DELIVERY_DONE'
  | 'DELIVERY_RECEIVED'
  | 'DELIVERY_READY'
  | 'TAKEAWAY_RECEIVED'
  | 'TAKEAWAY_READY'
  | 'ORDER_CANCELLED'
  | 'PAY_LINK';

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
    if (kind === 'WAITLIST_CANCELLED') {
      return ar
        ? `مرحباً ${guestName}، أُزيل طلب الانتظار في ${companyName}. نأمل خدمتكم قريباً.`
        : `Hi ${guestName}, your waitlist entry at ${companyName} was cancelled. We hope to serve you soon.`;
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
    if (kind === 'DELIVERY_RECEIVED') {
      return ar
        ? `مرحباً ${guestName}، استلمنا طلب التوصيل من ${companyName} وبدأ التحضير.`
        : `Hi ${guestName}, we received your delivery order at ${companyName} and started preparing.`;
    }
    if (kind === 'DELIVERY_READY') {
      return ar
        ? `مرحباً ${guestName}، طلب التوصيل من ${companyName} جاهز ويُجهَّز للإرسال.`
        : `Hi ${guestName}, your delivery order from ${companyName} is ready and being prepared for dispatch.`;
    }
    if (kind === 'TAKEAWAY_RECEIVED') {
      return ar
        ? `مرحباً ${guestName}، استلمنا طلب الاستلام من ${companyName} وبدأ التحضير.`
        : `Hi ${guestName}, we received your takeaway order at ${companyName} and started preparing.`;
    }
    if (kind === 'TAKEAWAY_READY') {
      return ar
        ? `مرحباً ${guestName}، طلبكم للاستلام من ${companyName} جاهز. تفضلوا بالاستلام.`
        : `Hi ${guestName}, your takeaway order from ${companyName} is ready for pickup.`;
    }
    if (kind === 'ORDER_CANCELLED') {
      return ar
        ? `مرحباً ${guestName}، تم إلغاء طلبكم في ${companyName}. للاستفسار تواصلوا مع المطعم.`
        : `Hi ${guestName}, your order at ${companyName} was cancelled. Contact the restaurant if needed.`;
    }
    if (kind === 'PAY_LINK') {
      return ar
        ? `مرحباً ${guestName}، رابط دفع فاتورتكم في ${companyName}${opts.tableCode ? ` (طاولة ${opts.tableCode})` : ''}:${opts.confirmUrl ? `\n${opts.confirmUrl}` : ''}`
        : `Hi ${guestName}, pay your bill at ${companyName}${opts.tableCode ? ` (table ${opts.tableCode})` : ''}:${opts.confirmUrl ? `\n${opts.confirmUrl}` : ''}`;
    }
    if (kind === 'RESERVATION_CANCELLED') {
      return ar
        ? `مرحباً ${guestName}، تم إلغاء حجزكم في ${companyName}${when ? ` يوم ${when}` : ''}.`
        : `Hi ${guestName}, your reservation at ${companyName}${when ? ` on ${when}` : ''} was cancelled.`;
    }
    if (kind === 'RESERVATION_NO_SHOW') {
      return ar
        ? `مرحباً ${guestName}، سُجّل عدم حضور لحجزكم في ${companyName}${when ? ` يوم ${when}` : ''}. للتواصل مع المطعم عند الحاجة.`
        : `Hi ${guestName}, your reservation at ${companyName}${when ? ` on ${when}` : ''} was marked no-show. Contact the restaurant if needed.`;
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
        const titlesAr: Record<RestoGuestNotifyKind, string> = {
          WAITLIST_READY: 'الطاولة جاهزة',
          WAITLIST_CANCELLED: 'إلغاء الانتظار',
          RESERVATION_CONFIRM: 'تأكيد الحجز',
          RESERVATION_REMIND: 'تذكير بالحجز',
          RESERVATION_TABLE_READY: 'طاولة الحجز جاهزة',
          RESERVATION_CANCELLED: 'إلغاء الحجز',
          RESERVATION_NO_SHOW: 'عدم حضور الحجز',
          DELIVERY_OUT: 'الطلب في الطريق',
          DELIVERY_DONE: 'تم التسليم',
          DELIVERY_RECEIVED: 'استلام توصيل',
          DELIVERY_READY: 'التوصيل جاهز',
          TAKEAWAY_RECEIVED: 'استلام سفري',
          TAKEAWAY_READY: 'جاهز للاستلام',
          ORDER_CANCELLED: 'إلغاء الطلب',
          PAY_LINK: 'رابط الدفع',
        };
        const titlesEn: Record<RestoGuestNotifyKind, string> = {
          WAITLIST_READY: 'Table ready',
          WAITLIST_CANCELLED: 'Waitlist cancelled',
          RESERVATION_CONFIRM: 'Reservation confirmed',
          RESERVATION_REMIND: 'Reservation reminder',
          RESERVATION_TABLE_READY: 'Reserved table ready',
          RESERVATION_CANCELLED: 'Reservation cancelled',
          RESERVATION_NO_SHOW: 'Reservation no-show',
          DELIVERY_OUT: 'Out for delivery',
          DELIVERY_DONE: 'Delivered',
          DELIVERY_RECEIVED: 'Delivery received',
          DELIVERY_READY: 'Delivery ready',
          TAKEAWAY_RECEIVED: 'Takeaway received',
          TAKEAWAY_READY: 'Takeaway ready',
          ORDER_CANCELLED: 'Order cancelled',
          PAY_LINK: 'Pay link',
        };
        const kindTitle =
          opts.locale === 'en'
            ? titlesEn[opts.kind]
            : titlesAr[opts.kind];
        const detailParts = [
          opts.tableCode ? `table ${opts.tableCode}` : '',
          opts.quotedMinutes != null ? `${opts.quotedMinutes} min` : '',
          opts.reservedAt
            ? opts.reservedAt.toLocaleString(
                opts.locale === 'en' ? 'en-GB' : 'ar',
                { dateStyle: 'medium', timeStyle: 'short' },
              )
            : '',
          opts.kind === 'PAY_LINK' && opts.confirmUrl ? opts.confirmUrl : '',
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
