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

export const ALL_PLAN_FEATURE_KEYS: PlanFeatureKey[] = [
  'accounting',
  'inventory',
  'pos',
  'resto',
  'aiAnalytics',
  'multiBranch',
  'apiKeys',
  'advancedReports',
];

export const PLAN_FEATURE_LABELS: Record<
  PlanFeatureKey,
  { ar: string; en: string }
> = {
  accounting: { ar: 'المحاسبة', en: 'Accounting' },
  inventory: { ar: 'المخزون', en: 'Inventory' },
  pos: { ar: 'الكاشير / POS', en: 'POS' },
  resto: { ar: 'المطاعم', en: 'Restaurants' },
  aiAnalytics: { ar: 'تحليلات AI', en: 'AI Analytics' },
  multiBranch: { ar: 'فروع متعددة', en: 'Multi-branch' },
  apiKeys: { ar: 'مفاتيح API', en: 'API keys' },
  advancedReports: { ar: 'تقارير متقدمة', en: 'Advanced reports' },
};

export const PLAN_DETAILS: Record<
  string,
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

/** Defaults when DB plan_definitions row is missing. */
export const PLAN_FEATURES: Record<string, Record<PlanFeatureKey, boolean>> = {
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

export function normalizePlanFeatures(
  raw?: Record<string, unknown> | null,
  fallbackPlan?: string,
): Record<PlanFeatureKey, boolean> {
  const base = {
    ...(PLAN_FEATURES[fallbackPlan || 'STARTER'] || PLAN_FEATURES.STARTER),
  };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of ALL_PLAN_FEATURE_KEYS) {
    if (typeof raw[key] === 'boolean') base[key] = raw[key] as boolean;
  }
  // Core modules stay on unless explicitly turned off
  return base;
}

export function featuresForPlan(plan: string): Record<PlanFeatureKey, boolean> {
  const code = String(plan || 'STARTER');
  return { ...(PLAN_FEATURES[code] || PLAN_FEATURES.STARTER) };
}
