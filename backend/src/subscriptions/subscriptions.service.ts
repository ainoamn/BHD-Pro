import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  PLAN_DETAILS,
  PlanFeatureKey,
} from '../common/plan-features';
import { PlanCatalogService } from './plan-catalog.service';

export { PLAN_DETAILS };

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private plans: PlanCatalogService,
  ) {}

  async getPlans() {
    const rows = await this.plans.listAll(false);
    return rows.map((p) => ({
      id: p.code,
      nameAr: p.nameAr,
      nameEn: p.nameEn,
      monthlyPrice: p.monthlyPrice,
      yearlyPrice: p.yearlyPrice,
      yearlyDiscountPct: p.yearlyDiscountPct,
      invoicesLimit: p.invoicesLimit,
      usersLimit: p.usersLimit,
      support: p.support,
      features: p.features,
      modules: p.modules,
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

    const planDetails = await this.plans.detailsFor(company.plan);
    const usersLimit =
      company.usersLimitOverride != null
        ? company.usersLimitOverride
        : planDetails.usersLimit;
    const invoicesLimit =
      company.invoicesLimitOverride != null
        ? company.invoicesLimitOverride
        : planDetails.invoicesLimit;
    const features = await this.plans.featuresFor(company.plan);
    const modules = await this.plans.modulesFor(company.plan);

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
      planDetails: {
        ...planDetails,
        usersLimit,
        invoicesLimit,
      },
      features,
      modules,
      permanentDiscountPct: Number(company.permanentDiscountPct || 0),
      permanentDiscountNote: company.permanentDiscountNote || null,
      planExpiry: company.planExpiry,
      planStartedAt: company.planStartedAt,
      currency: company.currency,
      usage: {
        invoicesThisMonth: invoiceCount,
        invoicesLimit,
        users: company._count.users,
        usersLimit,
      },
    };
  }

  async assertFeature(companyId: string, feature: PlanFeatureKey) {
    const company = await this.assertSubscriptionActive(companyId);
    const features = await this.plans.featuresFor(company.plan);
    if (!features[feature]) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PLAN_FEATURE_REQUIRED',
        feature,
        plan: company.plan,
        message: `Feature "${feature}" requires a higher plan. Upgrade from Subscription.`,
        upgradePath: '/subscription',
      });
    }
  }

  async assertSubscriptionActive(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        plan: true,
        planExpiry: true,
        usersLimitOverride: true,
        invoicesLimitOverride: true,
      },
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
    const details = await this.plans.detailsFor(company.plan);
    const limit =
      company.invoicesLimitOverride != null
        ? company.invoicesLimitOverride
        : details.invoicesLimit;
    if (limit < 0) return;

    const count = await this.prisma.invoice.count({
      where: {
        companyId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });
    if (count >= limit) {
      throw new ForbiddenException(
        `Monthly invoice limit (${limit}) reached. Upgrade your plan.`,
      );
    }
  }

  async assertCanCreateUser(companyId: string) {
    const company = await this.assertSubscriptionActive(companyId);
    const details = await this.plans.detailsFor(company.plan);
    const limit =
      company.usersLimitOverride != null
        ? company.usersLimitOverride
        : details.usersLimit;
    if (limit < 0) return;
    const count = await this.prisma.user.count({ where: { companyId } });
    if (count >= limit) {
      throw new ForbiddenException(
        `User limit (${limit}) reached. Upgrade your plan.`,
      );
    }
  }

  /**
   * Direct plan changes are disabled — upgrades must go through paid checkout.
   */
  async upgrade(_companyId: string, _plan: string, _billing: 'monthly' | 'yearly') {
    throw new BadRequestException(
      'Direct plan upgrades are disabled. Use the payment checkout flow to upgrade.',
    );
  }
}
