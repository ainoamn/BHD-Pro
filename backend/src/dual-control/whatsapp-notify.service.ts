import { BadRequestException, Injectable, Logger } from '@nestjs/common';

/** Meta WhatsApp Cloud API text sender (optional — requires env). */
@Injectable()
export class WhatsappNotifyService {
  private readonly logger = new Logger(WhatsappNotifyService.name);

  isConfigured(): boolean {
    return !!(
      process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_ENABLED !== 'false'
    );
  }

  async sendText(toE164: string, body: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { ok: false, error: 'WhatsApp is not configured on the server' };
    }

    const phone = toE164.replace(/[^\d]/g, '');
    if (phone.length < 8) {
      throw new BadRequestException('Invalid WhatsApp phone number');
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
          text: { preview_url: false, body },
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
}
