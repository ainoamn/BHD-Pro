import { PaymentGatewaySlug } from '@prisma/client';
import type { PaymentAdapter } from '../payment.types';

/** Simulated card checkout — frontend shows a card form then confirms via API. */
export const mockCardAdapter: PaymentAdapter = {
  slug: PaymentGatewaySlug.MOCK_CARD,

  async createCheckout(_config, input) {
    const externalId = `mock_${input.invoiceNumber}_${Date.now()}`;
    return {
      kind: 'card_form',
      externalId,
      instructions:
        'Test mode: enter any card number (16 digits), future expiry, and any CVV. No real charge.',
    };
  },

  async verifyReturn(_config, params) {
    return {
      paid: params.mock_paid === '1',
      externalId: params.external_id,
      invoiceNumber: params.invoice,
    };
  },
};
