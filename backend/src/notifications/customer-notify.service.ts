import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappNotifyService } from './whatsapp-notify.service';
import { EmailNotifyService } from './email-notify.service';
import { SmsNotifyService } from './sms-notify.service';
import { isValidMobileE164, toE164Digits, dialCodeForCountry } from '../common/phone';

type SecurityCfg = {
  autoSendPosReceipts?: boolean;
  whatsappNotifyPhones?: string[];
  autoSendPosReceiptEmail?: boolean;
  autoSendPosReceiptSms?: boolean;
};

@Injectable()
export class CustomerNotifyService {
  private readonly logger = new Logger(CustomerNotifyService.name);

  constructor(
    private prisma: PrismaService,
    private whatsapp: WhatsappNotifyService,
    private email: EmailNotifyService,
    private sms: SmsNotifyService,
  ) {}

  private frontendBaseUrl(): string {
    const raw =
      process.env.FRONTEND_URL ||
      process.env.CORS_ORIGIN ||
      'http://localhost:3000';
    return raw.split(',')[0].trim().replace(/\/$/, '');
  }

  private apiPublicBaseUrl(): string {
    const raw =
      process.env.API_PUBLIC_URL || 'https://hisaby-api.onrender.com';
    return raw.replace(/\/$/, '');
  }

  private generateShortCode(length = 10): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    const bytes = randomBytes(length);
    return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  }

  private async ensurePublicVerifyCode(invoiceId: string): Promise<string> {
    const existing = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { publicVerifyCode: true },
    });
    if (existing?.publicVerifyCode) return existing.publicVerifyCode;

    for (let attempt = 0; attempt < 8; attempt++) {
      const code = this.generateShortCode(10);
      try {
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: { publicVerifyCode: code },
        });
        return code;
      } catch {
        /* unique collision */
      }
    }
    throw new Error('Could not allocate public verify code');
  }

  private parseSecurity(raw: Prisma.JsonValue | null | undefined): SecurityCfg {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return raw as SecurityCfg;
  }

  /** Default true when WhatsApp, Email, or SMS is configured; false when explicitly disabled. */
  private shouldNotify(cfg: SecurityCfg): boolean {
    if (cfg.autoSendPosReceipts === false) return false;
    return (
      this.whatsapp.isConfigured() ||
      this.email.isConfigured() ||
      this.sms.isConfigured()
    );
  }

  private formatMoney(amount: number | string, currency: string): string {
    const n = Number(amount);
    return `${n.toFixed(3)} ${currency}`;
  }

  /**
   * Best-effort POS receipt WhatsApp + Email + SMS after sale. Never throws to caller.
   */
  async notifyPosSale(
    companyId: string,
    invoiceId: string,
    contactId: string,
  ): Promise<{ whatsapp?: string; email?: string; sms?: string } | null> {
    try {
      return await this.sendCustomerPosMessage(
        companyId,
        invoiceId,
        contactId,
        'sale',
      );
    } catch (err) {
      this.logger.warn(
        `notifyPosSale failed: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  /** Manual cashier resend — ignores auto-send kill switches when channel is configured. */
  async resendPosSaleNotify(
    companyId: string,
    invoiceId: string,
    contactId: string,
  ): Promise<{ whatsapp: string; email: string; sms: string }> {
    const delivery = await this.sendCustomerPosMessage(
      companyId,
      invoiceId,
      contactId,
      'sale',
      undefined,
      true,
    );
    return (
      delivery || {
        whatsapp: 'skipped',
        email: 'skipped',
        sms: 'skipped',
      }
    );
  }

  async notifyPosVoid(
    companyId: string,
    invoiceId: string,
    contactId: string,
  ): Promise<void> {
    try {
      await this.sendCustomerPosMessage(companyId, invoiceId, contactId, 'void');
    } catch (err) {
      this.logger.warn(
        `notifyPosVoid failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  async notifyPosRefund(
    companyId: string,
    invoiceId: string,
    contactId: string,
    creditNoteId?: string,
  ): Promise<void> {
    try {
      await this.sendCustomerPosMessage(
        companyId,
        invoiceId,
        contactId,
        'refund',
        creditNoteId,
      );
    } catch (err) {
      this.logger.warn(
        `notifyPosRefund failed: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  private async sendCustomerPosMessage(
    companyId: string,
    invoiceId: string,
    contactId: string,
    kind: 'sale' | 'void' | 'refund',
    creditNoteId?: string,
    force = false,
  ): Promise<{ whatsapp: string; email: string; sms: string } | null> {
    const [invoice, contact, company] = await Promise.all([
      this.prisma.invoice.findFirst({
        where: { id: invoiceId, companyId },
        select: {
          id: true,
          number: true,
          total: true,
          currency: true,
          customFieldsJson: true,
          contactId: true,
        },
      }),
      this.prisma.contact.findFirst({
        where: { id: contactId, companyId },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
        },
      }),
      this.prisma.company.findUnique({
        where: { id: companyId },
        select: {
          name: true,
          phone: true,
          currency: true,
          country: true,
          securityConfig: true,
        },
      }),
    ]);

    if (!invoice || !contact || !company) return null;

    // Skip walk-in / no contact channel
    if (/walk-?in|نقدي/i.test(contact.name)) {
      this.logger.debug(`skip notify: walk-in contact ${contact.id}`);
      return null;
    }
    if (!contact.phone?.trim() && !contact.email?.trim()) {
      this.logger.warn(`skip notify: contact ${contact.id} has no phone/email`);
      return null;
    }

    const cfg = this.parseSecurity(company.securityConfig);
    if (!force && !this.shouldNotify(cfg)) {
      this.logger.warn('skip notify: autoSendPosReceipts disabled or no channel configured');
      return null;
    }

    const code = await this.ensurePublicVerifyCode(invoice.id);
    const viewUrl = `${this.apiPublicBaseUrl()}/api/public/documents/c/${code}/view`;
    const disputeUrl = `${this.frontendBaseUrl()}/dispute/${code}`;
    const currency = invoice.currency || company.currency || 'OMR';
    const totalStr = this.formatMoney(Number(invoice.total), currency);

    let body: string;
    if (kind === 'sale') {
      body = [
        `مرحباً ${contact.name}،`,
        `إيصال من ${company.name}`,
        `رقم الفاتورة: ${invoice.number}`,
        `المبلغ: ${totalStr}`,
        `عرض الإيصال: ${viewUrl}`,
        `الإبلاغ عن معاملة مشبوهة: ${disputeUrl}`,
      ].join('\n');
    } else if (kind === 'void') {
      body = [
        `مرحباً ${contact.name}،`,
        `تم إلغاء فاتورة ${invoice.number} لدى ${company.name}`,
        `المبلغ: ${totalStr}`,
        `عرض المستند: ${viewUrl}`,
        `للإبلاغ: ${disputeUrl}`,
      ].join('\n');
    } else {
      body = [
        `مرحباً ${contact.name}،`,
        `تم استرداد مبلغ من فاتورة ${invoice.number} لدى ${company.name}`,
        creditNoteId ? `(إشعار دائن مرتبط)` : '',
        `المبلغ الأصلي: ${totalStr}`,
        `عرض المستند: ${viewUrl}`,
        `للإبلاغ: ${disputeUrl}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    const dial = dialCodeForCountry(company.country);
    const digits = toE164Digits(contact.phone, dial);
    let waOk = false;
    let waError: string | undefined;
    if (isValidMobileE164(digits) && this.whatsapp.isConfigured()) {
      if (kind === 'sale') {
        const result = await this.whatsapp.sendPosReceipt(digits, {
          customerName: contact.name,
          companyName: company.name,
          invoiceNumber: String(invoice.number || ''),
          amount: totalStr,
          viewUrl,
          fullBody: body,
        });
        waOk = result.ok;
        waError = result.error;
      } else {
        const caption = body.slice(0, 900);
        const result = await this.whatsapp.sendDocumentLink(
          digits,
          viewUrl,
          caption,
          `${invoice.number || 'receipt'}.pdf`,
        );
        waOk = result.ok;
        waError = result.error;
      }
    } else if (contact.phone?.trim()) {
      waError = `invalid phone (normalized=${digits || 'empty'}) or WhatsApp not configured`;
      this.logger.warn(`WhatsApp skipped: ${waError}`);
    } else {
      waError = 'no phone on contact';
    }

    let emailStatus: 'ok' | 'fail' | 'skipped' = 'skipped';
    let emailError: string | undefined;
    const emailAllowed = force || cfg.autoSendPosReceiptEmail !== false;
    if (emailAllowed && contact.email?.trim() && this.email.isConfigured()) {
      const subject =
        kind === 'sale'
          ? `إيصال ${invoice.number} — ${company.name}`
          : kind === 'void'
            ? `إلغاء فاتورة ${invoice.number} — ${company.name}`
            : `استرداد فاتورة ${invoice.number} — ${company.name}`;
      const mail = await this.email.sendText({
        to: contact.email.trim(),
        subject,
        text: body,
        html: `<pre style="font-family:sans-serif;white-space:pre-wrap">${body.replace(/</g, '&lt;')}</pre>`,
      });
      emailStatus = mail.ok ? 'ok' : 'fail';
      emailError = mail.error;
    }

    let smsStatus: 'ok' | 'fail' | 'skipped' = 'skipped';
    let smsError: string | undefined;
    const smsAllowed = force || cfg.autoSendPosReceiptSms !== false;
    if (smsAllowed && isValidMobileE164(digits) && this.sms.isConfigured()) {
      const smsBody = body.slice(0, 600);
      const sms = await this.sms.sendText({ to: digits, body: smsBody });
      smsStatus = sms.ok ? 'ok' : 'fail';
      smsError = sms.error;
    }

    const delivery = {
      whatsapp: waOk ? 'ok' : 'fail',
      email: emailStatus,
      sms: smsStatus,
    };

    try {
      const existing =
        (invoice.customFieldsJson as Record<string, unknown>) || {};
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          customFieldsJson: {
            ...existing,
            delivery: {
              ...((existing.delivery as object) || {}),
              ...delivery,
              ...(waError ? { whatsappError: waError } : {}),
              ...(emailError ? { emailError } : {}),
              ...(smsError ? { smsError } : {}),
              kind,
              at: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });
    } catch {
      /* non-fatal */
    }

    return delivery;
  }

  /** Public customer dispute from receipt link. */
  async createDispute(
    publicCode: string,
    dto: { reason: string; reporterPhone?: string; reporterName?: string },
  ) {
    const reason = String(dto.reason || '').trim();
    if (reason.length < 5) {
      throw new BadRequestException('Reason is required (min 5 characters)');
    }

    const code = publicCode.trim();
    const invoice = await this.prisma.invoice.findFirst({
      where: { publicVerifyCode: code },
      select: {
        id: true,
        number: true,
        companyId: true,
        company: {
          select: {
            name: true,
            phone: true,
            country: true,
            securityConfig: true,
          },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Document not found');

    const dispute = await this.prisma.customerDispute.create({
      data: {
        companyId: invoice.companyId,
        invoiceId: invoice.id,
        publicCode: code,
        reason: reason.slice(0, 2000),
        reporterPhone: dto.reporterPhone?.trim()?.slice(0, 40) || null,
        reporterName: dto.reporterName?.trim()?.slice(0, 120) || null,
        status: 'OPEN',
      },
    });

    // Best-effort company notify
    try {
      const cfg = this.parseSecurity(invoice.company.securityConfig);
      const dial = dialCodeForCountry(invoice.company.country);
      const phones = new Set<string>();
      for (const p of cfg.whatsappNotifyPhones || []) {
        const d = toE164Digits(String(p), dial);
        if (isValidMobileE164(d)) phones.add(d);
      }
      if (invoice.company.phone) {
        const d = toE164Digits(invoice.company.phone, dial);
        if (isValidMobileE164(d)) phones.add(d);
      }

      const alertBody = [
        `بلاغ عميل على فاتورة ${invoice.number}`,
        `الشركة: ${invoice.company.name}`,
        `السبب: ${reason.slice(0, 200)}`,
        dto.reporterPhone ? `هاتف المبلّغ: ${dto.reporterPhone}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      if (this.whatsapp.isConfigured()) {
        for (const phone of phones) {
          await this.whatsapp.sendText(phone, alertBody);
        }
      }
    } catch (err) {
      this.logger.warn(
        `Dispute company notify failed: ${err instanceof Error ? err.message : err}`,
      );
    }

    return {
      ok: true,
      id: dispute.id,
      invoiceNumber: invoice.number,
    };
  }
}
