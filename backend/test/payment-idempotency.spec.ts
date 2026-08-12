import {
  BillingInvoiceStatus,
  BillingPurpose,
  PaymentGatewaySlug,
} from '@prisma/client';
import { PaymentsService } from '../src/payments/payments.service';

describe('payment fulfillment idempotency', () => {
  it('allows only one concurrent caller to claim a pending billing invoice', async () => {
    const billing = {
      id: 'billing-1',
      companyId: 'company-1',
      number: 'PAY-2026-0001',
      status: BillingInvoiceStatus.PENDING,
      purpose: BillingPurpose.SUBSCRIPTION,
      gatewaySlug: PaymentGatewaySlug.THAWANI,
      metadataJson: { plan: 'PROFESSIONAL', billing: 'monthly' },
    };
    let claimed = false;
    const tx = {
      billingInvoice: {
        updateMany: jest.fn(async () => {
          if (claimed) return { count: 0 };
          claimed = true;
          return { count: 1 };
        }),
        findUnique: jest.fn().mockResolvedValue({
          ...billing,
          status: BillingInvoiceStatus.PAID,
        }),
      },
      company: { update: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      billingInvoice: { findUnique: jest.fn().mockResolvedValue(billing) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const redis = { invalidateDashboardStats: jest.fn().mockResolvedValue(undefined) };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      {} as never,
      {} as never,
      redis as never,
      {} as never,
    );

    await Promise.all([
      service.fulfillBillingInvoice(billing.id, 'session-1'),
      service.fulfillBillingInvoice(billing.id, 'session-1'),
    ]);

    expect(tx.company.update).toHaveBeenCalledTimes(1);
    expect(redis.invalidateDashboardStats).toHaveBeenCalledTimes(1);
  });
});
