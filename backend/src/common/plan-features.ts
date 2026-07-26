import { Plan } from '@prisma/client';

/** Product modules gated by subscription plan. */
export type PlanFeatureKey =
  | 'accounting'
  | 'inventory'
  | 'pos'
  | 'resto'
  | 'aiAnalytics'
  | 'multiBranch'
  | 'apiKeys'
  | 'advancedReports';

export const PLAN_FEATURES: Record<Plan, Record<PlanFeatureKey, boolean>> = {
  STARTER: {
    accounting: true,
    inventory: true,
    pos: false,
    resto: false,
    aiAnalytics: false,
    multiBranch: false,
    apiKeys: false,
    advancedReports: false,
  },
  PROFESSIONAL: {
    accounting: true,
    inventory: true,
    pos: true,
    resto: false,
    aiAnalytics: false,
    multiBranch: true,
    apiKeys: true,
    advancedReports: true,
  },
  ENTERPRISE: {
    accounting: true,
    inventory: true,
    pos: true,
    resto: true,
    aiAnalytics: true,
    multiBranch: true,
    apiKeys: true,
    advancedReports: true,
  },
};

export function featuresForPlan(plan: Plan): Record<PlanFeatureKey, boolean> {
  return { ...PLAN_FEATURES[plan] };
}
