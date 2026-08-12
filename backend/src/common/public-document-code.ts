import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const ALPHABET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function randomPublicCode(length = 18): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join(
    '',
  );
}

/** Allocate an opaque, non-sequential reference without exposing the invoice UUID. */
export async function ensurePublicDocumentCode(
  prisma: PrismaService,
  invoiceId: string,
): Promise<string> {
  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { publicVerifyCode: true },
  });
  if (existing?.publicVerifyCode) return existing.publicVerifyCode;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomPublicCode();
    try {
      const claimed = await prisma.invoice.updateMany({
        where: { id: invoiceId, publicVerifyCode: null },
        data: { publicVerifyCode: code },
      });
      if (claimed.count === 1) return code;
      const winner = await prisma.invoice.findUnique({
        where: { id: invoiceId },
        select: { publicVerifyCode: true },
      });
      if (winner?.publicVerifyCode) return winner.publicVerifyCode;
    } catch {
      // Unique collision; retry with fresh entropy.
    }
  }
  throw new Error('Could not allocate a public document reference');
}
