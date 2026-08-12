import { DocumentShareService } from '../src/invoices/document-share.service';

describe('public document data minimization', () => {
  it('selects explicit public fields and keeps internal identifiers out', async () => {
    let capturedSelect: Record<string, unknown> | undefined;
    const prisma = {
      invoice: {
        findFirst: jest.fn(async (query: { select: Record<string, unknown> }) => {
          capturedSelect = query.select;
          return {
            number: 'INV-1',
            type: 'INVOICE',
            company: { name: 'Tenant', ftaConfig: null },
            items: [],
            contact: { name: 'Customer' },
          };
        }),
      },
      documentTemplate: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new DocumentShareService(
      prisma as never,
      {} as never,
      {} as never,
    );
    await service.resolveByPublicCode('PUBLIC123');
    // First lookup resolves the opaque code; return its tenant-bound identity.
    expect(prisma.invoice.findFirst).toHaveBeenCalled();
    const serialized = JSON.stringify(capturedSelect);
    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('companyId');
    expect(serialized).not.toContain('createdBy');
  });
});
