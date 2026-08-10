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
    const n = Number(process.env.WHATSAPP_FETCH_TIMEOUT_MS || 8000);
    return Number.isFinite(n) && n >= 3000 ? n : 8000;
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

  private async parseMetaMessageId(res: Response): Promise<string | undefined> {
    try {
      const json = (await res.json()) as {
        messages?: Array<{ id?: string }>;
      };
      return json?.messages?.[0]?.id || undefined;
    } catch {
      return undefined;
    }
  }

  private maskPhone(phone: string): string {
    const d = phone.replace(/\D/g, '');
    if (d.length < 4) return '****';
    return `${'*'.repeat(Math.max(0, d.length - 4))}${d.slice(-4)}`;
  }

  async sendText(
    toE164: string,
    body: string,
  ): Promise<{ ok: boolean; error?: string; mock?: boolean; messageId?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp is not configured on the server' };
    }

    const phone = toE164.replace(/[^\d]/g, '');
    if (phone.length < 8) {
      throw new BadRequestException('Invalid WhatsApp phone number');
    }

    if (this.mode() === 'mock') {
      this.logger.log(`[mock-whatsapp] to=${this.maskPhone(phone)} body=${body.slice(0, 240)}`);
      return { ok: true, mock: true };
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
        this.logger.warn(`WhatsApp send failed to=${this.maskPhone(phone)}: ${err}`);
        return { ok: false, error: err };
      }
      const messageId = await this.parseMetaMessageId(res);
      this.logger.log(
        `WhatsApp text accepted to=${this.maskPhone(phone)} id=${messageId || 'n/a'}`,
      );
      return { ok: true, messageId };
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

  private sanitizeTemplateText(text: string): string {
    // Meta rejects newlines/tabs in body variables (#132018 family)
    return String(text || '-')
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 1024) || '-';
  }

  /**
   * Business-initiated message via approved template.
   * Tries primary language, then optional fallbacks (WHATSAPP_RECEIPT_TEMPLATE_LANGS).
   * Retries named→positional or reverse if parameter mismatch is likely.
   */
  async sendTemplate(
    toE164: string,
    templateName: string,
    bodyParams: string[],
    lang?: string,
    paramNames?: string[],
  ): Promise<{ ok: boolean; error?: string; mock?: boolean; messageId?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp is not configured on the server' };
    }
    const phone = toE164.replace(/[^\d]/g, '');
    if (phone.length < 8) {
      return { ok: false, error: 'Invalid WhatsApp phone number' };
    }
    if (this.mode() === 'mock') {
      this.logger.log(
        `[mock-whatsapp-template] to=${this.maskPhone(phone)} name=${templateName} params=${bodyParams.length}`,
      );
      return { ok: true, mock: true };
    }

    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID!;
    const token = process.env.WHATSAPP_TOKEN!;
    const url = `https://graph.facebook.com/v21.0/${phoneId}/messages`;
    const primaryLang = (lang || this.receiptTemplateLang()).trim() || 'ar';
    const extraLangs = (process.env.WHATSAPP_RECEIPT_TEMPLATE_LANGS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const langs = [...new Set([primaryLang, ...extraLangs, 'ar', 'en'])].slice(0, 4);

    const envNames = (process.env.WHATSAPP_TEMPLATE_PARAM_NAMES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const names =
      paramNames && paramNames.length
        ? paramNames
        : envNames.length
          ? envNames
          : [];
    const cleanParams = bodyParams.map((p) => this.sanitizeTemplateText(String(p)));

    const attempts: Array<{ named: boolean; names?: string[] }> = [];
    if (names.length > 0 && names.length === cleanParams.length) {
      attempts.push({ named: true, names });
      attempts.push({ named: false });
    } else {
      attempts.push({ named: false });
      if (names.length === cleanParams.length && names.length > 0) {
        attempts.push({ named: true, names });
      } else if (cleanParams.length === 5) {
        // Meta new UI often uses these names for utility receipts
        attempts.push({
          named: true,
          names: [
            'customer_name',
            'company_name',
            'invoice_number',
            'amount',
            'receipt_url',
          ],
        });
      }
    }

    let lastError = 'template send failed';
    for (const language of langs) {
      for (const attempt of attempts) {
        const components =
          cleanParams.length > 0
            ? [
                {
                  type: 'body',
                  parameters: cleanParams.map((text, i) => ({
                    type: 'text' as const,
                    text,
                    ...(attempt.named && attempt.names
                      ? { parameter_name: attempt.names[i] }
                      : {}),
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
                language: { code: language },
                ...(components ? { components } : {}),
              },
            }),
          });
          if (!res.ok) {
            const err = await this.parseMetaError(res);
            lastError = err;
            this.logger.warn(
              `WhatsApp template failed name=${templateName} lang=${language} named=${attempt.named} to=${this.maskPhone(phone)} params=${cleanParams.length}: ${err}`,
            );
            // Try next combination
            continue;
          }
          const messageId = await this.parseMetaMessageId(res);
          this.logger.log(
            `WhatsApp template accepted name=${templateName} lang=${language} named=${attempt.named} to=${this.maskPhone(phone)} id=${messageId || 'n/a'}`,
          );
          return { ok: true, messageId };
        } catch (err) {
          lastError =
            err instanceof Error && err.name === 'AbortError'
              ? 'WhatsApp API timeout'
              : err instanceof Error
                ? err.message
                : 'send failed';
          this.logger.warn(`WhatsApp template error: ${lastError}`);
        }
      }
    }
    return { ok: false, error: lastError };
  }

  /** Send a document link (Cloud API link type) — used for invoices/receipts. */
  async sendDocumentLink(
    toE164: string,
    link: string,
    caption: string,
    filename = 'document.pdf',
  ): Promise<{ ok: boolean; error?: string; mock?: boolean; messageId?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp is not configured on the server' };
    }
    const phone = toE164.replace(/[^\d]/g, '');
    if (this.mode() === 'mock') {
      this.logger.log(
        `[mock-whatsapp-doc] to=${this.maskPhone(phone)} link=${link} caption=${caption.slice(0, 80)}`,
      );
      return { ok: true, mock: true };
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
      const messageId = await this.parseMetaMessageId(res);
      return { ok: true, messageId };
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

  /** Named body vars for pos_receipt (Meta new UI). Empty = positional {{1}}… */
  receiptParamNames(): string[] {
    const style = (process.env.WHATSAPP_RECEIPT_PARAM_STYLE || 'positional').trim().toLowerCase();
    if (style === 'named') {
      const fromEnv = (process.env.WHATSAPP_RECEIPT_PARAM_NAMES || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (fromEnv.length) return fromEnv;
      return [
        'customer_name',
        'company_name',
        'invoice_number',
        'amount',
        'receipt_url',
      ];
    }
    return [];
  }

  guestParamNames(): string[] {
    const style = (
      process.env.WHATSAPP_GUEST_PARAM_STYLE ||
      process.env.WHATSAPP_RECEIPT_PARAM_STYLE ||
      'positional'
    )
      .trim()
      .toLowerCase();
    if (style !== 'named') return [];
    const fromEnv = (process.env.WHATSAPP_GUEST_PARAM_NAMES || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (fromEnv.length) return fromEnv;
    return this.receiptParamNames();
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
  ): Promise<{
    ok: boolean;
    error?: string;
    via?: 'template' | 'text';
    mock?: boolean;
    messageId?: string;
    /** Meta template error when session fallback was used instead. */
    templateError?: string;
  }> {
    const template = this.receiptTemplateName();
    if (template) {
      const result = await this.sendTemplate(
        toE164,
        template,
        [
          opts.customerName,
          opts.companyName,
          opts.invoiceNumber,
          opts.amount,
          opts.viewUrl,
        ],
        this.receiptTemplateLang(),
        this.receiptParamNames(),
      );
      if (result.ok) {
        return {
          ok: true,
          via: 'template',
          mock: !!result.mock,
          messageId: result.messageId,
        };
      }
      this.logger.warn(
        `Receipt template failed — not treating session fallback as full success: ${result.error}`,
      );
      // Session text only works inside the 24h window and hides template misconfig.
      // Prefer surfacing the Meta template error so cashiers can fix pos_receipt.
      return {
        ok: false,
        error: result.error || 'template send failed',
        via: 'template',
        templateError: result.error,
      };
    }

    const text = await this.sendDocumentLink(
      toE164,
      opts.viewUrl,
      opts.fullBody.slice(0, 900),
      `${opts.invoiceNumber || 'receipt'}.pdf`,
    );
    if (text.ok) {
      return {
        ok: true,
        via: 'text',
        mock: !!text.mock,
        messageId: text.messageId,
      };
    }

    const hint = /24|window|template|re-engage|131047|131026/i.test(text.error || '')
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
  ): Promise<{ ok: boolean; error?: string; via?: 'template' | 'text'; mock?: boolean }> {
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
        this.guestParamNames(),
      );
      if (result.ok) {
        return {
          ...result,
          via: 'template',
          mock: !!(result as { mock?: boolean }).mock,
        };
      }
      this.logger.warn(`Guest template failed, trying session text: ${result.error}`);
    }

    const text = await this.sendText(toE164, opts.fullBody);
    if (text.ok) {
      return {
        ...text,
        via: 'text',
        mock: !!(text as { mock?: boolean }).mock,
      };
    }

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

  /** Approved Authentication/Utility template for OTP ({{1}} = code). */
  otpTemplateName(): string | null {
    const name = (process.env.WHATSAPP_OTP_TEMPLATE || '').trim();
    return name || null;
  }

  otpTemplateLang(): string {
    return (process.env.WHATSAPP_OTP_TEMPLATE_LANG || 'en').trim() || 'en';
  }

  /** Send a 6-digit OTP message (dual-control / verification flows). */
  async sendOtp(
    toE164: string,
    code: string,
    purpose = 'verification',
  ): Promise<{ ok: boolean; error?: string; via?: 'template' | 'text'; mock?: boolean }> {
    const template = this.otpTemplateName();
    if (template) {
      const result = await this.sendTemplate(
        toE164,
        template,
        [String(code)],
        this.otpTemplateLang(),
      );
      if (result.ok) {
        return {
          ...result,
          via: 'template',
          mock: !!(result as { mock?: boolean }).mock,
        };
      }
      this.logger.warn(`OTP template failed, trying session text: ${result.error}`);
    }

    const body = `Hisaby OTP: ${code}\nPurpose: ${purpose}\nValid 10 minutes.\nDo not share this code.`;
    const text = await this.sendText(toE164, body);
    return {
      ...text,
      via: 'text',
      mock: !!(text as { mock?: boolean }).mock,
    };
  }
}
