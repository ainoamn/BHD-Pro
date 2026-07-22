import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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

  async assertSubscriptionActive(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: { plan: true, planExpiry: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    if (company.planExpiry && company.planExpiry.getTime() < Date.now()) {
      throw new ForbiddenException(
        'Subscription expired. Renew from the Subscription page to continue.',
      );
    }
    return company;
  }

  async assertCanCreateInvoice(companyId: string) {
    const company = await this.assertSubscriptionActive(companyId);
    const limit = PLAN_DETAILS[company.plan].invoicesLimit;
    if (limit < 0) return;

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const count = await this.prisma.invoice.count({
      where: { companyId, createdAt: { gte: startOfMonth } },
    });
    if (count >= limit) {
      throw new ForbiddenException(
        `Monthly invoice limit reached (${limit}). Upgrade your plan to continue.`,
      );
    }
  }

  async assertCanCreateUser(companyId: string) {
    const company = await this.assertSubscriptionActive(companyId);
    const limit = PLAN_DETAILS[company.plan].usersLimit;
    if (limit < 0) return;

    const count = await this.prisma.user.count({
      where: { companyId, isActive: true },
    });
    if (count >= limit) {
      throw new ForbiddenException(
        `User limit reached (${limit}). Upgrade your plan to add more users.`,
      );
    }
  }

  /**
   * Direct plan changes are disabled — upgrades must go through paid checkout
   * (`POST /payments/subscription/checkout`) and webhook/return fulfillment.
   */
  async upgrade(_companyId: string, _plan: Plan, _billing: 'monthly' | 'yearly') {
    throw new BadRequestException(
      'Direct plan upgrades are disabled. Use the payment checkout flow to upgrade.',
    );
  }
}
