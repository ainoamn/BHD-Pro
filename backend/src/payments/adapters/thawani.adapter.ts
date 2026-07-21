import * as crypto from 'crypto';
import { PaymentGatewaySlug } from '@prisma/client';
import type { PaymentAdapter } from '../payment.types';

function checkoutHost(isTestMode: boolean, baseUrl: string) {
  if (baseUrl.includes('uat')) return 'https://uatcheckout.thawani.om';
  if (!isTestMode) return 'https://checkout.thawani.om';
  return 'https://uatcheckout.thawani.om';
}

function verifyThawaniWebhook(
  rawBody: string,
  headers: Record<string, string>,
  webhookSecret: string,
): boolean {
  const secret = webhookSecret.trim();
  if (!secret) return false;

  const headerSig =
    headers['thawani-signature'] ||
    headers['x-thawani-signature'] ||
    headers['x-webhook-signature'] ||
    headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!headerSig) return false;

  // Shared-secret bearer style
  if (headerSig === secret) return true;

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  const provided = headerSig.replace(/^sha256=/i, '').trim();
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(provided, 'hex');
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    try {
      return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
    } catch {
      return false;
    }
  }
}

export const thawaniAdapter: PaymentAdapter = {
  slug: PaymentGatewaySlug.THAWANI,

  async createCheckout(config, input, isTestMode) {
    const secretKey = config.secretKey?.trim();
    const publishableKey = config.publishableKey?.trim();
    const baseUrl = (config.baseUrl?.trim() || 'https://uatcheckout.thawani.om/api/v1').replace(/\/$/, '');

    if (!secretKey || !publishableKey) {
      throw new Error('Thawani publishable and secret keys are required');
    }

    const resp = await fetch(`${baseUrl}/checkout/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': secretKey,
      },
      body: JSON.stringify({
        client_reference_id: input.invoiceNumber,
        mode: 'payment',
        products: [
          {
            name: input.description.slice(0, 120),
            quantity: 1,
            unit_amount: input.amountBaisa,
          },
        ],
        success_url: input.successUrl,
        cancel_url: input.cancelUrl,
        metadata: input.metadata,
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Thawani: ${errText.slice(0, 200)}`);
    }

    const body = (await resp.json()) as { data?: { session_id?: string }; session_id?: string };
    const sessionId = body.data?.session_id ?? body.session_id;
    if (!sessionId) throw new Error('Thawani: no session id returned');

    const host = checkoutHost(isTestMode, baseUrl);
    return {
      kind: 'redirect',
      externalId: sessionId,
      redirectUrl: `${host}/pay/${sessionId}?key=${publishableKey}`,
    };
  },

  async verifyReturn(config, params) {
    const sessionId = params.session_id;
    if (!sessionId) return { paid: false };

    const secretKey = config.secretKey?.trim();
    const baseUrl = (config.baseUrl?.trim() || 'https://uatcheckout.thawani.om/api/v1').replace(/\/$/, '');
    if (!secretKey) return { paid: false };

    const resp = await fetch(`${baseUrl}/checkout/session/${sessionId}`, {
      headers: { 'thawani-api-key': secretKey },
    });
    if (!resp.ok) return { paid: false };

    const body = (await resp.json()) as {
      data?: { payment_status?: string };
      payment_status?: string;
    };
    const status = body.data?.payment_status ?? body.payment_status;
    return { paid: status === 'paid', externalId: sessionId };
  },

  async handleWebhook(config, rawBody, headers) {
    const webhookSecret = config.webhookSecret?.trim();
    if (!webhookSecret) return null; // fail closed — never fulfill without secret
    if (!verifyThawaniWebhook(rawBody, headers, webhookSecret)) return null;

    try {
      const payload = JSON.parse(rawBody) as {
        data?: { session_id?: string; payment_status?: string; client_reference_id?: string };
        event_type?: string;
      };
      const data = payload.data;
      if (!data) return null;

      const paid =
        data.payment_status === 'paid' ||
        payload.event_type === 'checkout.completed' ||
        payload.event_type === 'payment.succeeded';

      return {
        invoiceNumber: data.client_reference_id,
        externalId: data.session_id,
        paid,
      };
    } catch {
      return null;
    }
  },
};
