import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class ManagementAlertsService {
  constructor(private prisma: PrismaService) {}

  private assertManager(role: string) {
    if (
      role !== UserRole.ADMIN &&
      role !== UserRole.MANAGER &&
      role !== UserRole.ACCOUNTANT
    ) {
      throw new ForbiddenException('Management alerts are restricted');
    }
  }

  list(companyId: string, role: string, status?: string) {
    this.assertManager(role);
    return this.prisma.managementAlert.findMany({
      where: {
        companyId,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async resolve(companyId: string, role: string, userId: string, id: string, status = 'RESOLVED') {
    this.assertManager(role);
    const row = await this.prisma.managementAlert.findFirst({ where: { id, companyId } });
    if (!row) throw new NotFoundException('Alert not found');
    return this.prisma.managementAlert.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
        resolvedById: userId,
      },
    });
  }

  async createAlert(data: {
    companyId: string;
    type: string;
    severity?: string;
    title: string;
    message: string;
    entityType?: string;
    entityId?: string;
    payloadJson?: object;
  }) {
    return this.prisma.managementAlert.create({
      data: {
        companyId: data.companyId,
        type: data.type,
        severity: data.severity || 'MEDIUM',
        title: data.title,
        message: data.message,
        entityType: data.entityType,
        entityId: data.entityId,
        payloadJson: data.payloadJson || {},
      },
    });
  }

  /** Scan payment for duplicate refs / near-identical recent amounts (management-only). */
  async scanPayment(
    companyId: string,
    payment: {
      id: string;
      amount: number;
      reference?: string | null;
      invoiceId: string;
      method: string;
    },
  ) {
    if (payment.reference) {
      const dupRef = await this.prisma.payment.findFirst({
        where: {
          id: { not: payment.id },
          reference: payment.reference,
          invoice: { companyId },
        },
        include: { invoice: { select: { number: true } } },
      });
      if (dupRef) {
        await this.createAlert({
          companyId,
          type: 'DUPLICATE_REFERENCE',
          severity: 'HIGH',
          title: 'مرجع دفع مكرر',
          message: `المرجع "${payment.reference}" مستخدم أيضاً على فاتورة ${dupRef.invoice.number}`,
          entityType: 'PAYMENT',
          entityId: payment.id,
          payloadJson: { otherPaymentId: dupRef.id, reference: payment.reference },
        });
      }
    }

    const amount = Number(payment.amount);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const similar = await this.prisma.payment.findMany({
      where: {
        id: { not: payment.id },
        method: payment.method as never,
        date: { gte: since },
        invoice: { companyId },
        amount: {
          gte: amount * 0.98,
          lte: amount * 1.02,
        },
      },
      take: 5,
      include: { invoice: { select: { number: true } } },
    });

    if (similar.length >= 2) {
      await this.createAlert({
        companyId,
        type: 'SIMILAR_TRANSACTION',
        severity: 'MEDIUM',
        title: 'معاملات متشابهة متكررة',
        message: `وُجدت ${similar.length} دفعات بمبلغ قريب (~${amount}) خلال 7 أيام`,
        entityType: 'PAYMENT',
        entityId: payment.id,
        payloadJson: {
          similarIds: similar.map((s) => s.id),
          invoices: similar.map((s) => s.invoice.number),
        },
      });
    }
  }
}
