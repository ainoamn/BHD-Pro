import { ensureCompanyAppsLinked } from '../src/common/company-apps-link';

describe('ensureCompanyAppsLinked', () => {
  it('returns existing timestamps when already linked', async () => {
    const posLinkedAt = new Date('2026-01-01');
    const restoLinkedAt = new Date('2026-01-02');
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({ posLinkedAt, restoLinkedAt }),
        update: jest.fn(),
      },
    } as any;

    const result = await ensureCompanyAppsLinked(prisma, 'co1');
    expect(result).toEqual({ posLinkedAt, restoLinkedAt });
    expect(prisma.company.update).not.toHaveBeenCalled();
  });

  it('fills missing link timestamps', async () => {
    const now = new Date('2026-07-28T12:00:00Z');
    jest.useFakeTimers().setSystemTime(now);
    const prisma = {
      company: {
        findUnique: jest.fn().mockResolvedValue({
          posLinkedAt: null,
          restoLinkedAt: new Date('2026-01-01'),
        }),
        update: jest.fn().mockResolvedValue({
          posLinkedAt: now,
          restoLinkedAt: new Date('2026-01-01'),
        }),
      },
    } as any;

    const result = await ensureCompanyAppsLinked(prisma, 'co1');
    expect(prisma.company.update).toHaveBeenCalledWith({
      where: { id: 'co1' },
      data: { posLinkedAt: now },
      select: { posLinkedAt: true, restoLinkedAt: true },
    });
    expect(result.posLinkedAt).toEqual(now);
    jest.useRealTimers();
  });
});
