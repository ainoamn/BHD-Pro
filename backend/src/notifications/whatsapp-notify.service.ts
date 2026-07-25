import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/** Meta WhatsApp Cloud API (+ mock) text/document sender. */
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
      const res = await fetch(url, {
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
        const text = await res.text();
        this.logger.warn(`WhatsApp send failed: ${res.status} ${text}`);
        return { ok: false, error: `WhatsApp API ${res.status}` };
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'send failed';
      this.logger.warn(`WhatsApp send error: ${message}`);
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
      const res = await fetch(url, {
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
        const text = await res.text();
        this.logger.warn(`WhatsApp document failed: ${res.status} ${text}`);
        // fallback to text with link
        return this.sendText(toE164, `${caption}\n${link}`);
      }
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'send failed';
      return this.sendText(toE164, `${caption}\n${link}`).then((r) =>
        r.ok ? r : { ok: false, error: message },
      );
    }
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
