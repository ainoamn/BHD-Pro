import * as crypto from 'crypto';
import { PaymentGatewaySlug } from '@prisma/client';
import type { PaymentAdapter } from '../payment.types';

function stripeForm(data: Record<string, string | number>): string {
  return new URLSearchParams(Object.entries(data).map(([k, v]) => [k, String(v)])).toString();
}

export const stripeAdapter: PaymentAdapter = {
  slug: PaymentGatewaySlug.STRIPE,

  async createCheckout(config, input) {
    const secretKey = config.secretKey?.trim();
    if (!secretKey) throw new Error('Stripe secret key is required');

    const successUrl = input.successUrl;
    const cancelUrl = input.cancelUrl;

    const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: stripeForm({
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        'line_items[0][price_data][currency]': input.currency.toLowerCase(),
        'line_items[0][price_data][unit_amount]': input.amountBaisa,
        'line_items[0][price_data][product_data][name]': input.description.slice(0, 120),
        'line_items[0][quantity]': 1,
        'metadata[invoice_number]': input.invoiceNumber,
        customer_email: input.customerEmail ?? '',
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Stripe: ${errText.slice(0, 200)}`);
    }

    const body = (await resp.json()) as { id?: string; url?: string };
    if (!body.url || !body.id) throw new Error('Stripe: no checkout URL returned');

    return { kind: 'redirect', externalId: body.id, redirectUrl: body.url };
  },

  async verifyReturn(config, params) {
    const sessionId = params.session_id;
    if (!sessionId) return { paid: false };

    const secretKey = config.secretKey?.trim();
    if (!secretKey) return { paid: false };

    const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${sessionId}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
    });
    if (!resp.ok) return { paid: false };

    const body = (await resp.json()) as {
      payment_status?: string;
      id?: string;
      metadata?: Record<string, string>;
    };
    return {
      paid: body.payment_status === 'paid',
      externalId: body.id,
      invoiceNumber: body.metadata?.invoice_number,
    };
  },

  async handleWebhook(config, rawBody, headers) {
    const secret = config.webhookSecret?.trim();
    if (!secret) return null;

    const sig = headers['stripe-signature'] ?? headers['Stripe-Signature'];
    if (!sig || !verifyStripeSignature(rawBody, sig, secret)) return null;

    try {
      const event = JSON.parse(rawBody) as {
        type?: string;
        data?: { object?: { id?: string; payment_status?: string; metadata?: Record<string, string> } };
      };
      if (event.type !== 'checkout.session.completed') return null;
      const session = event.data?.object;
      if (!session || session.payment_status !== 'paid') return null;

      return {
        invoiceNumber: session.metadata?.invoice_number,
        externalId: session.id,
        paid: true,
      };
    } catch {
      return null;
    }
  },
};

function verifyStripeSignature(payload: string, header: string, secret: string): boolean {
  const parts = header.split(',').reduce(
    (acc, part) => {
      const [k, v] = part.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    },
    {} as Record<string, string>,
  );

  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const skew = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (skew > 300) return false; // 5-minute replay window

  const signed = `${timestamp}.${payload}`;
  const expected = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest();
  let provided: Buffer;
  try {
    provided = Buffer.from(signature, 'hex');
  } catch {
    return false;
  }
  if (provided.length !== expected.length) return false;

  try {
    return crypto.timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}
