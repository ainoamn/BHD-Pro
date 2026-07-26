/** Mirrors backend PLAN_FEATURES defaults for admin UI bootstrapping. */
export const PLAN_FEATURES: Record<string, Record<string, boolean>> = {
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
