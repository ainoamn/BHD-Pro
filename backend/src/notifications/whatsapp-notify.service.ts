import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/** Meta WhatsApp Cloud API (+ mock) text/document/template sender. */
@Injectable()
export class WhatsappNotifyService {
  private readonly logger = new Logger(WhatsappNotifyService.name);

  isConfigured(): boolean {
    if (process.env.WHATSAPP_ENABLED === 'false') return false;
    if ((process.env.WHATSAPP_TOKEN || '').toLowerCase() === 'mock') return true;
    return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
  }

  mode(): 'live' | 'mock' | 'off' {
    if (!this.isConfigured()) return 'off';
    if ((process.env.WHATSAPP_TOKEN || '').toLowerCase() === 'mock') return 'mock';
    return 'live';
  }

  /** Approved template name for POS receipts (business-initiated). */
  receiptTemplateName(): string | null {
    const name = (process.env.WHATSAPP_RECEIPT_TEMPLATE || '').trim();
    return name || null;
  }

  receiptTemplateLang(): string {
    return (process.env.WHATSAPP_RECEIPT_TEMPLATE_LANG || 'ar').trim() || 'ar';
  }

  /** Approved template for guest / resto alerts; falls back to receipt template. */
  guestTemplateName(): string | null {
    const name = (process.env.WHATSAPP_GUEST_TEMPLATE || '').trim();
    return name || this.receiptTemplateName();
  }

  guestTemplateLang(): string {
    return (
      (process.env.WHATSAPP_GUEST_TEMPLATE_LANG || '').trim() ||
      this.receiptTemplateLang()
    );
  }

  private metaFetchTimeoutMs(): number {
    const n = Number(process.env.WHATSAPP_FETCH_TIMEOUT_MS || 12000);
    return Number.isFinite(n) && n >= 3000 ? n : 12000;
  }

  private async metaFetch(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.metaFetchTimeoutMs());
    try {
      return await fetch(url, { ...init, signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  private async parseMetaError(res: Response): Promise<string> {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as {
        error?: { message?: string; code?: number; error_data?: { details?: string } };
      };
      const msg = json?.error?.message || text;
      const details = json?.error?.error_data?.details;
      const code = json?.error?.code;
      return [code ? `#${code}` : null, msg, details].filter(Boolean).join(' — ').slice(0, 500);
    } catch {
      return `WhatsApp API ${res.status}: ${text.slice(0, 400)}`;
    }
  }

  async sendText(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp is not configured on the server' };
    }

    const phone = toE164.replace(/[^\d]/g, '');
    if (phone.length < 8) {
      throw new BadRequestException('Invalid WhatsApp phone number');
    }

    if (this.mode() === 'mock') {
      this.logger.log(`[mock-whatsapp] to=${phone} body=${body.slice(0, 240)}`);
      return { ok: true };
    }

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = process.env.WHATSAPP_TOKEN!;
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

    try {
      const res = await this.metaFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { preview_url: true, body },
        }),
      });
      if (!res.ok) {
        const err = await this.parseMetaError(res);
        this.logger.warn(`WhatsApp send failed: ${err}`);
        return { ok: false, error: err };
      }
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'WhatsApp API timeout'
          : err instanceof Error
            ? err.message
            : 'send failed';
      this.logger.warn(`WhatsApp send error: ${message}`);
      return { ok: false, error: message };
    }
  }

  /**
   * Business-initiated message via approved template.
   * Body params order must match the Meta template variables {{1}}…{{n}}.
   */
  async sendTemplate(
    toE164: string,
    templateName: string,
    bodyParams: string[],
    lang?: string,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp is not configured on the server' };
    }
    const phone = toE164.replace(/[^\d]/g, '');
    if (phone.length < 8) {
      return { ok: false, error: 'Invalid WhatsApp phone number' };
    }
    if (this.mode() === 'mock') {
      this.logger.log(
        `[mock-whatsapp-template] to=${phone} name=${templateName} params=${bodyParams.join('|')}`,
      );
      return { ok: true };
    }

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = process.env.WHATSAPP_TOKEN!;
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;
    const language = { code: (lang || this.receiptTemplateLang()).trim() || 'ar' };
    const components =
      bodyParams.length > 0
        ? [
            {
              type: 'body',
              parameters: bodyParams.map((text) => ({
                type: 'text',
                text: String(text || '-').slice(0, 1024),
              })),
            },
          ]
        : undefined;

    try {
      const res = await this.metaFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'template',
          template: {
            name: templateName,
            language,
            ...(components ? { components } : {}),
          },
        }),
      });
      if (!res.ok) {
        const err = await this.parseMetaError(res);
        this.logger.warn(`WhatsApp template failed: ${err}`);
        return { ok: false, error: err };
      }
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'WhatsApp API timeout'
          : err instanceof Error
            ? err.message
            : 'send failed';
      this.logger.warn(`WhatsApp template error: ${message}`);
      return { ok: false, error: message };
    }
  }

  /** Send a document link (Cloud API link type) — used for invoices/receipts. */
  async sendDocumentLink(
    toE164: string,
    link: string,
    caption: string,
    filename = 'document.pdf',
  ): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp is not configured on the server' };
    }
    const phone = toE164.replace(/[^\d]/g, '');
    if (this.mode() === 'mock') {
      this.logger.log(`[mock-whatsapp-doc] to=${phone} link=${link} caption=${caption}`);
      return { ok: true };
    }

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = process.env.WHATSAPP_TOKEN!;
    const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

    try {
      const res = await this.metaFetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone,
          type: 'document',
          document: { link, caption, filename },
        }),
      });
      if (!res.ok) {
        const err = await this.parseMetaError(res);
        this.logger.warn(`WhatsApp document failed: ${err}`);
        return this.sendText(toE164, `${caption}\n${link}`);
      }
      return { ok: true };
    } catch (err) {
      const message =
        err instanceof Error && err.name === 'AbortError'
          ? 'WhatsApp API timeout'
          : err instanceof Error
            ? err.message
            : 'send failed';
      return this.sendText(toE164, `${caption}\n${link}`).then((r) =>
        r.ok ? r : { ok: false, error: message },
      );
    }
  }

  /**
   * POS receipt: prefer approved template (required for first contact),
   * else session text/document (only works inside 24h customer window).
   */
  async sendPosReceipt(
    toE164: string,
    opts: {
      customerName: string;
      companyName: string;
      invoiceNumber: string;
      amount: string;
      viewUrl: string;
      fullBody: string;
    },
  ): Promise<{ ok: boolean; error?: string; via?: 'template' | 'text' }> {
    const template = this.receiptTemplateName();
    if (template) {
      const result = await this.sendTemplate(toE164, template, [
        opts.customerName,
        opts.companyName,
        opts.invoiceNumber,
        opts.amount,
        opts.viewUrl,
      ]);
      if (result.ok) return { ...result, via: 'template' };
      this.logger.warn(`Receipt template failed, trying session text: ${result.error}`);
    }

    const text = await this.sendDocumentLink(
      toE164,
      opts.viewUrl,
      opts.fullBody.slice(0, 900),
      `${opts.invoiceNumber || 'receipt'}.pdf`,
    );
    if (text.ok) return { ...text, via: 'text' };

    const hint =
      !template && /24|window|template|re-engage|131047|131026/i.test(text.error || '')
        ? ' — أنشئ قالباً معتمداً واضبط WHATSAPP_RECEIPT_TEMPLATE'
        : '';
    return {
      ok: false,
      error: `${text.error || 'send failed'}${hint}`,
      via: 'text',
    };
  }

  /**
   * Guest / restaurant alert: prefer template (first contact), else session text.
   * Template vars: {{1}} guest · {{2}} company · {{3}} title · {{4}} detail · {{5}} link
   */
  async sendGuestNotify(
    toE164: string,
    opts: {
      guestName: string;
      companyName: string;
      title: string;
      detail: string;
      link?: string | null;
      fullBody: string;
    },
  ): Promise<{ ok: boolean; error?: string; via?: 'template' | 'text' }> {
    const template = this.guestTemplateName();
    if (template) {
      const result = await this.sendTemplate(
        toE164,
        template,
        [
          opts.guestName || '-',
          opts.companyName || '-',
          opts.title || '-',
          (opts.detail || '-').slice(0, 200),
          opts.link || '-',
        ],
        this.guestTemplateLang(),
      );
      if (result.ok) return { ...result, via: 'template' };
      this.logger.warn(`Guest template failed, trying session text: ${result.error}`);
    }

    const text = await this.sendText(toE164, opts.fullBody);
    if (text.ok) return { ...text, via: 'text' };

    const hint =
      !template && /24|window|template|re-engage|131047|131026/i.test(text.error || '')
        ? ' — أنشئ قالباً واضبط WHATSAPP_RECEIPT_TEMPLATE أو WHATSAPP_GUEST_TEMPLATE'
        : '';
    return {
      ok: false,
      error: `${text.error || 'send failed'}${hint}`,
      via: 'text',
    };
  }

  /** Send a 6-digit OTP message (dual-control / verification flows). */
  async sendOtp(
    toE164: string,
    code: string,
    purpose = 'verification',
  ): Promise<{ ok: boolean; error?: string }> {
    const body = `Hisaby OTP: ${code}\nPurpose: ${purpose}\nValid 10 minutes.\nDo not share this code.`;
    return this.sendText(toE164, body);
  }
}
