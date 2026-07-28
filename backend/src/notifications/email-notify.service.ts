import { Injectable, Logger } from '@nestjs/common';

/** Optional SMTP / Resend email sender. Falls back to log-only when unset. */
@Injectable()
export class EmailNotifyService {
  private readonly logger = new Logger(EmailNotifyService.name);

  isConfigured(): boolean {
    if (process.env.EMAIL_ENABLED === 'false') return false;
    if (process.env.RESEND_API_KEY) return true;
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return true;
    }
    if ((process.env.EMAIL_MODE || '').toLowerCase() === 'mock') return true;
    return false;
  }

  mode(): 'resend' | 'smtp' | 'mock' | 'off' {
    if ((process.env.EMAIL_MODE || '').toLowerCase() === 'mock') return 'mock';
    if (process.env.RESEND_API_KEY) return 'resend';
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      return 'smtp';
    }
    return 'off';
  }

  async sendText(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<{ ok: boolean; error?: string; mode: string; mock?: boolean }> {
    const mode = this.mode();
    if (mode === 'off') {
      return { ok: false, error: 'Email is not configured', mode };
    }

    if (mode === 'mock') {
      this.logger.log(`[mock-email] to=${opts.to} subject=${opts.subject} body=${opts.text.slice(0, 200)}`);
      return { ok: true, mode, mock: true };
    }

    if (mode === 'resend') {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || 'Hisaby <noreply@hisaby.pro>',
            to: [opts.to],
            subject: opts.subject,
            text: opts.text,
            html: opts.html || `<pre>${opts.text}</pre>`,
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          this.logger.warn(`Resend failed: ${res.status} ${t}`);
          return { ok: false, error: `Resend ${res.status}`, mode };
        }
        return { ok: true, mode };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'send failed';
        return { ok: false, error: message, mode };
      }
    }

    // SMTP via nodemailer if present
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || process.env.SMTP_USER,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
      });
      return { ok: true, mode: 'smtp' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'smtp failed';
      this.logger.warn(`SMTP send error: ${message}`);
      return { ok: false, error: message, mode: 'smtp' };
    }
  }
}
