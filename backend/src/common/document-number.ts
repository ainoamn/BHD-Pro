import { PrismaService } from '../prisma/prisma.service';

export function seedAfter(latestNumber?: string | null): number {
  const match = String(latestNumber || '').match(/(\d+)$/);
  if (!match) return 1;
  const value = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(value) && value >= 0 ? value + 1 : 1;
}

/**
 * Atomic sequence allocation. The initial seed allows a zero-downtime rollout
 * over existing human-readable document numbers.
 */
export async function nextDocumentNumber(
  prisma: PrismaService,
  options: {
    scope: string;
    series: string;
    period: string;
    prefix: string;
    seed?: number;
    pad?: number;
  },
): Promise<string> {
  const seed = Math.max(1, Math.trunc(options.seed || 1));
  const row = await prisma.documentSequence.upsert({
    where: {
      scope_series_period: {
        scope: options.scope,
        series: options.series,
        period: options.period,
      },
    },
    create: {
      scope: options.scope,
      series: options.series,
      period: options.period,
      lastValue: seed,
    },
    update: { lastValue: { increment: 1 } },
    select: { lastValue: true },
  });
  return `${options.prefix}${String(row.lastValue).padStart(options.pad || 4, '0')}`;
}

