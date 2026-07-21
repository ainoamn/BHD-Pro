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

async function verifyPayPalWebhook(
  config: Record<string, string>,
  rawBody: string,
  headers: Record<string, string>,
  isTestMode: boolean,
): Promise<boolean> {
  const webhookId = config.webhookId?.trim();
  if (!webhookId) return false;

  const transmissionId = headers['paypal-transmission-id'] || headers['Paypal-Transmission-Id'];
  const transmissionTime =
    headers['paypal-transmission-time'] || headers['Paypal-Transmission-Time'];
  const certUrl = headers['paypal-cert-url'] || headers['Paypal-Cert-Url'];
  const authAlgo = headers['paypal-auth-algo'] || headers['Paypal-Auth-Algo'];
  const transmissionSig =
    headers['paypal-transmission-sig'] || headers['Paypal-Transmission-Sig'];

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return false;
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }

  const { token, base } = await paypalAccessToken(config, isTestMode);
  const resp = await fetch(`${base}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: webhookId,
      webhook_event: event,
    }),
  });

  if (!resp.ok) return false;
  const body = (await resp.json()) as { verification_status?: string };
  return body.verification_status === 'SUCCESS';
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

  async handleWebhook(config, rawBody, headers, isTestMode) {
    const ok = await verifyPayPalWebhook(config, rawBody, headers, isTestMode);
    if (!ok) return null;

    try {
      const event = JSON.parse(rawBody) as {
        event_type?: string;
        resource?: { id?: string; custom_id?: string; status?: string; purchase_units?: Array<{ custom_id?: string }> };
      };
      if (
        event.event_type === 'CHECKOUT.ORDER.APPROVED' ||
        event.event_type === 'PAYMENT.CAPTURE.COMPLETED'
      ) {
        const invoiceNumber =
          event.resource?.custom_id ||
          event.resource?.purchase_units?.[0]?.custom_id;
        return {
          invoiceNumber,
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
