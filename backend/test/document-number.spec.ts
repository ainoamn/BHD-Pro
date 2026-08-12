import { nextDocumentNumber, seedAfter } from '../src/common/document-number';

describe('atomic document number allocation', () => {
  it('extracts a numeric seed without lexicographic sorting assumptions', () => {
    expect(seedAfter('INV-2026-0099')).toBe(100);
    expect(seedAfter('invalid')).toBe(1);
  });

  it('uses a single database upsert/increment operation', async () => {
    const upsert = jest.fn().mockResolvedValue({ lastValue: 10001 });
    const prisma = { documentSequence: { upsert } };
    await expect(
      nextDocumentNumber(prisma as never, {
        scope: 'company-1',
        series: 'invoice',
        period: '2026',
        prefix: 'INV-2026-',
        seed: 42,
      }),
    ).resolves.toBe('INV-2026-10001');
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { lastValue: { increment: 1 } },
        create: expect.objectContaining({ lastValue: 42 }),
      }),
    );
  });
});
