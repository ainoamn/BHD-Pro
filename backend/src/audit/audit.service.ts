import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditPayload = {
  companyId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(payload: AuditPayload) {
    try {
      await this.prisma.auditLog.create({
        data: {
          companyId: payload.companyId,
          userId: payload.userId || null,
          action: payload.action,
          entity: payload.entity,
          entityId: payload.entityId || null,
          oldValues: (payload.oldValues as object) ?? undefined,
          newValues: (payload.newValues as object) ?? undefined,
          ipAddress: payload.ipAddress || null,
          userAgent: payload.userAgent || null,
        },
      });
    } catch {
      // Never break business flow because of audit write failures
    }
  }

  async findAll(
    companyId: string,
    opts: { limit?: number; entity?: string; action?: string } = {},
  ) {
    const take = Math.min(Math.max(opts.limit ?? 100, 1), 500);
    const where: {
      companyId: string;
      entity?: string;
      action?: string;
    } = { companyId };

    if (opts.entity) where.entity = opts.entity;
    if (opts.action) where.action = opts.action;

    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { total, limit: take, rows };
  }
}
