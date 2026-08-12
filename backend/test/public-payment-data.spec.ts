import {
  InvoiceStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { PaymentsService } from '../src/payments/payments.service';

describe('public payment data minimization', () => {
  it('returns only fields required to render the payment choice', async () => {
    const prisma = {
      invoice: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'internal-invoice-id',
          companyId: 'internal-company-id',
          number: 'INV-42',
          total: new Prisma.Decimal('10.000'),
          paidAmount: new Prisma.Decimal('2.500'),
          status: InvoiceStatus.SENT,
          paymentStatus: PaymentStatus.PARTIAL,
          company: { name: 'Merchant', currency: 'OMR' },
        }),
      },
    };
    const companyGateways = { listEnabled: jest.fn().mockResolvedValue([]) };
    const service = new PaymentsService(
      prisma as never,
      {} as never,
      companyGateways as never,
      {} as never,
      {} as never,
      {} as never,
    );

    const response = await service.getPublicInvoicePayInfo('opaque-code');
    expect(response).toEqual({
      number: 'INV-42',
      companyName: 'Merchant',
      remaining: 7.5,
      currency: 'OMR',
      gateways: [],
    });
    expect(response).not.toHaveProperty('id');
    expect(response).not.toHaveProperty('companyId');
    expect(response).not.toHaveProperty('contactName');
    expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { publicVerifyCode: 'opaque-code' } }),
    );
  });
});
