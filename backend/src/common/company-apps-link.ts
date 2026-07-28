import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Hisaby apps (Accounting + POS + Restaurants) share one company.
 * Linking is always-on; plan/subscription gates which modules appear.
 */
export async function ensureCompanyAppsLinked(
  prisma: PrismaService,
  companyId: string,
): Promise<{ posLinkedAt: Date; restoLinkedAt: Date }> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { posLinkedAt: true, restoLinkedAt: true },
  });
  if (!company) throw new NotFoundException('Company not found');

  if (company.posLinkedAt && company.restoLinkedAt) {
    return {
      posLinkedAt: company.posLinkedAt,
      restoLinkedAt: company.restoLinkedAt,
    };
  }

  const now = new Date();
  const updated = await prisma.company.update({
    where: { id: companyId },
    data: {
      ...(!company.posLinkedAt ? { posLinkedAt: now } : {}),
      ...(!company.restoLinkedAt ? { restoLinkedAt: now } : {}),
    },
    select: { posLinkedAt: true, restoLinkedAt: true },
  });

  return {
    posLinkedAt: updated.posLinkedAt!,
    restoLinkedAt: updated.restoLinkedAt!,
  };
}
