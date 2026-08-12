import * as crypto from 'crypto';
import { PaymentGatewaySlug } from '@prisma/client';
import type { PaymentAdapter } from '../payment.types';

function thawaniEndpoints(isTestMode: boolean, configured?: string) {
  const origin = isTestMode
    ? 'https://uatcheckout.thawani.om'
    : 'https://checkout.thawani.om';
  const expectedApi = `${origin}/api/v1`;
  if (configured?.trim()) {
    let parsed: URL;
    try {
      parsed = new URL(configured.trim());
    } catch {
      throw new Error('Thawani API URL is invalid');
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.origin !== origin ||
      parsed.pathname.replace(/\/$/, '') !== '/api/v1' ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error('Thawani API URL is not allowlisted for the selected mode');
    }
  }
  return { apiBase: expectedApi, checkoutOrigin: origin };
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
    const endpoints = thawaniEndpoints(isTestMode, config.baseUrl);

    if (!secretKey || !publishableKey) {
      throw new Error('Thawani publishable and secret keys are required');
    }

    const resp = await fetch(`${endpoints.apiBase}/checkout/session`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
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

    return {
      kind: 'redirect',
      externalId: sessionId,
      redirectUrl: `${endpoints.checkoutOrigin}/pay/${encodeURIComponent(sessionId)}?key=${encodeURIComponent(publishableKey)}`,
    };
  },

  async verifyReturn(config, params, isTestMode) {
    const sessionId = params.session_id;
    if (!sessionId) return { paid: false };

    const secretKey = config.secretKey?.trim();
    const endpoints = thawaniEndpoints(isTestMode, config.baseUrl);
    if (!secretKey) return { paid: false };

    const resp = await fetch(`${endpoints.apiBase}/checkout/session/${encodeURIComponent(sessionId)}`, {
      headers: { 'thawani-api-key': secretKey },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) return { paid: false };

    const body = (await resp.json()) as {
      data?: {
        payment_status?: string;
        client_reference_id?: string;
        metadata?: Record<string, string>;
      };
      payment_status?: string;
    };
    const data = body.data;
    const status = data?.payment_status ?? body.payment_status;
    return {
      paid: status === 'paid',
      externalId: sessionId,
      invoiceNumber: data?.client_reference_id || data?.metadata?.invoice_number,
    };
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
