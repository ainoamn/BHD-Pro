import { Injectable, Logger } from '@nestjs/common';

/**
 * Twilio SMS (or mock). Parallel to WhatsApp/Email for POS receipts & alerts.
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+ TWILIO_MODE=mock).
 */
@Injectable()
export class SmsNotifyService {
  private readonly logger = new Logger(SmsNotifyService.name);

  isConfigured(): boolean {
    if (process.env.SMS_ENABLED === 'false') return false;
    if ((process.env.TWILIO_MODE || process.env.SMS_MODE || '').toLowerCase() === 'mock') {
      return true;
    }
    return !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
    );
  }

  mode(): 'twilio' | 'mock' | 'off' {
    if ((process.env.TWILIO_MODE || process.env.SMS_MODE || '').toLowerCase() === 'mock') {
      return 'mock';
    }
    if (
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_FROM
    ) {
      return 'twilio';
    }
    return 'off';
  }

  async sendText(opts: {
    to: string;
    body: string;
  }): Promise<{ ok: boolean; error?: string; mode: string; sid?: string }> {
    const mode = this.mode();
    if (mode === 'off') {
      return { ok: false, error: 'SMS is not configured', mode };
    }

    const to = opts.to.trim();
    if (!to) return { ok: false, error: 'Missing recipient', mode };

    if (mode === 'mock') {
      this.logger.log(`[mock-sms] to=${to} body=${opts.body.slice(0, 200)}`);
      return { ok: true, mode, sid: `mock_${Date.now()}` };
    }

    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const token = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_FROM!;
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const form = new URLSearchParams({
      To: to.startsWith('+') ? to : `+${to.replace(/\D/g, '')}`,
      From: from,
      Body: opts.body.slice(0, 1500),
    });

    try {
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: form.toString(),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        sid?: string;
        message?: string;
        error_message?: string;
      };
      if (!res.ok) {
        const err = data.error_message || data.message || `Twilio ${res.status}`;
        this.logger.warn(`Twilio SMS failed: ${err}`);
        return { ok: false, error: err, mode };
      }
      return { ok: true, mode, sid: data.sid };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'sms failed';
      this.logger.warn(`Twilio SMS error: ${message}`);
      return { ok: false, error: message, mode };
    }
  }
}
