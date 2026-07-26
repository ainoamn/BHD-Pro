import { PaymentGatewaySlug } from '@prisma/client';
import type { PaymentAdapter } from '../payment.types';
import { stripeAdapter } from './stripe.adapter';
import { thawaniAdapter } from './thawani.adapter';
import { paypalAdapter } from './paypal.adapter';
import { bankTransferAdapter, manualAdapter } from './offline.adapter';
import { mockCardAdapter } from './mock-card.adapter';

const adapters: Record<PaymentGatewaySlug, PaymentAdapter> = {
  STRIPE: stripeAdapter,
  THAWANI: thawaniAdapter,
  PAYPAL: paypalAdapter,
  BANK_TRANSFER: bankTransferAdapter,
  MANUAL: manualAdapter,
  MOCK_CARD: mockCardAdapter,
};

export function getPaymentAdapter(slug: PaymentGatewaySlug): PaymentAdapter {
  return adapters[slug];
}
