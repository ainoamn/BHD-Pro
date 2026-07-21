import { PaymentGatewaySlug } from '@prisma/client';
import type { PaymentAdapter } from '../payment.types';
import { baisaToOmr } from '../payment.types';

async function paypalAccessToken(config: Record<string, string>, isTestMode: boolean) {
  const clientId = config.clientId?.trim();
  const clientSecret = config.clientSecret?.trim();
  if (!clientId || !clientSecret) throw new Error('PayPal client ID and secret are required');

  const base = isTestMode ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

  const resp = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  if (!resp.ok) throw new Error('PayPal: failed to obtain access token');
  const body = (await resp.json()) as { access_token?: string };
  if (!body.access_token) throw new Error('PayPal: empty access token');
  return { token: body.access_token, base };
}

export const paypalAdapter: PaymentAdapter = {
  slug: PaymentGatewaySlug.PAYPAL,

  async createCheckout(config, input, isTestMode) {
    const { token, base } = await paypalAccessToken(config, isTestMode);
    const amountDecimal = baisaToOmr(input.amountBaisa).toFixed(3);

    const resp = await fetch(`${base}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.invoiceNumber,
            description: input.description.slice(0, 120),
            amount: { currency_code: input.currency, value: amountDecimal },
            custom_id: input.invoiceNumber,
          },
        ],
        application_context: {
          return_url: input.successUrl,
          cancel_url: input.cancelUrl,
          brand_name: 'BHD Pro',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`PayPal: ${errText.slice(0, 200)}`);
    }

    const body = (await resp.json()) as {
      id?: string;
      links?: Array<{ rel: string; href: string }>;
    };
    const approve = body.links?.find((l) => l.rel === 'approve' || l.rel === 'payer-action');
    if (!body.id || !approve?.href) throw new Error('PayPal: no approval URL returned');

    return { kind: 'redirect', externalId: body.id, redirectUrl: approve.href };
  },

  async verifyReturn(config, params, isTestMode) {
    const token = params.token;
    if (!token) return { paid: false };

    const { token: accessToken, base } = await paypalAccessToken(config, isTestMode);

    const captureResp = await fetch(`${base}/v2/checkout/orders/${token}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!captureResp.ok) return { paid: false };
    const body = (await captureResp.json()) as { status?: string; id?: string };
    return { paid: body.status === 'COMPLETED', externalId: body.id ?? token };
  },

  async handleWebhook(_config, rawBody) {
    try {
      const event = JSON.parse(rawBody) as {
        event_type?: string;
        resource?: { id?: string; custom_id?: string; status?: string };
      };
      if (
        event.event_type === 'CHECKOUT.ORDER.APPROVED' ||
        event.event_type === 'PAYMENT.CAPTURE.COMPLETED'
      ) {
        return {
          invoiceNumber: event.resource?.custom_id,
          externalId: event.resource?.id,
          paid: true,
        };
      }
    } catch {
      return null;
    }
    return null;
  },
};
