import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan } from '@prisma/client';

export const PLAN_DETAILS: Record<
  Plan,
  {
    nameAr: string;
    nameEn: string;
    monthlyPrice: number;
    yearlyPrice: number;
    invoicesLimit: number;
    usersLimit: number;
    support: string;
  }
> = {
  STARTER: {
    nameAr: 'بدائية',
    nameEn: 'Starter',
    monthlyPrice: 5,
    yearlyPrice: 48,
    invoicesLimit: 50,
    usersLimit: 2,
    support: 'email',
  },
  PROFESSIONAL: {
    nameAr: 'محترفة',
    nameEn: 'Professional',
    monthlyPrice: 15,
    yearlyPrice: 144,
    invoicesLimit: 500,
    usersLimit: 10,
    support: 'priority',
  },
  ENTERPRISE: {
    nameAr: 'مؤسسية',
    nameEn: 'Enterprise',
    monthlyPrice: 35,
    yearlyPrice: 336,
    invoicesLimit: -1,
    usersLimit: -1,
    support: '24/7',
  },
};

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  getPlans() {
    return Object.entries(PLAN_DETAILS).map(([key, details]) => ({
      id: key as Plan,
      ...details,
      currency: 'OMR',
    }));
  }

  async getCurrent(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      include: {
        _count: { select: { users: true, invoices: true } },
      },
    });
    if (!company) throw new NotFoundException('Company not found');

    const planDetails = PLAN_DETAILS[company.plan];
    const invoiceCount = await this.prisma.invoice.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    return {
      plan: company.plan,
      planDetails,
      planExpiry: company.planExpiry,
      currency: company.currency,
      usage: {
        invoicesThisMonth: invoiceCount,
        invoicesLimit: planDetails.invoicesLimit,
        users: company._count.users,
        usersLimit: planDetails.usersLimit,
      },
    };
  }

  async upgrade(companyId: string, plan: Plan, billing: 'monthly' | 'yearly') {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Company not found');

    const expiry = new Date();
    if (billing === 'yearly') {
      expiry.setFullYear(expiry.getFullYear() + 1);
    } else {
      expiry.setMonth(expiry.getMonth() + 1);
    }

    return this.prisma.company.update({
      where: { id: companyId },
      data: { plan, planExpiry: expiry },
    });
  }
}
