import { PaymentGatewaySlug } from '@prisma/client';

export type GatewayConfig = Record<string, string>;

export type CheckoutResult = {
  kind: 'redirect' | 'offline' | 'free';
  redirectUrl?: string;
  externalId?: string;
  instructions?: string;
  bankDetails?: Record<string, string>;
};

export type CheckoutInput = {
  invoiceNumber: string;
  invoiceId: string;
  amountBaisa: number;
  currency: string;
  description: string;
  customerEmail?: string;
  customerName?: string;
  successUrl: string;
  cancelUrl: string;
  metadata: Record<string, string>;
};

export type PaymentAdapter = {
  slug: PaymentGatewaySlug;
  createCheckout(
    config: GatewayConfig,
    input: CheckoutInput,
    isTestMode: boolean,
  ): Promise<CheckoutResult>;
  verifyReturn?(
    config: GatewayConfig,
    params: Record<string, string>,
    isTestMode: boolean,
  ): Promise<{ paid: boolean; externalId?: string }>;
  handleWebhook?(
    config: GatewayConfig,
    rawBody: string,
    headers: Record<string, string>,
    isTestMode: boolean,
  ): Promise<{ invoiceNumber?: string; externalId?: string; paid: boolean } | null>;
};

export function omrToBaisa(omr: number): number {
  return Math.round(Number(omr) * 1000);
}

export function baisaToOmr(baisa: number): number {
  return Number((baisa / 1000).toFixed(3));
}

export function slugToKey(slug: PaymentGatewaySlug): string {
  return slug.toLowerCase();
}
