import { PaymentGatewaySlug } from '@prisma/client';
import type { PaymentAdapter } from '../payment.types';

function offlineAdapter(slug: PaymentGatewaySlug): PaymentAdapter {
  return {
    slug,
    async createCheckout(config, input) {
      const bankDetails: Record<string, string> = {};
      for (const key of ['bankName', 'accountName', 'accountNumber', 'iban']) {
        if (config[key]) bankDetails[key] = config[key];
      }
      return {
        kind: 'offline',
        instructions: config.instructions || input.description,
        bankDetails: Object.keys(bankDetails).length ? bankDetails : undefined,
      };
    },
  };
}

export const bankTransferAdapter = offlineAdapter(PaymentGatewaySlug.BANK_TRANSFER);
export const manualAdapter = offlineAdapter(PaymentGatewaySlug.MANUAL);
