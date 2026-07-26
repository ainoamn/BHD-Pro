/** Plan-gated product features surfaced in the company console. */

export type UpgradeFeatureKey =
  | "pos"
  | "resto"
  | "aiAnalytics"
  | "multiBranch"
  | "apiKeys"
  | "advancedReports";

export type UpgradeFeatureMeta = {
  key: UpgradeFeatureKey;
  labelAr: string;
  labelEn: string;
  hintAr: string;
  hintEn: string;
  href: string;
  /** Lowest plan that includes this feature */
  minPlan: "PROFESSIONAL" | "ENTERPRISE";
};

export const UPGRADE_FEATURES: Record<UpgradeFeatureKey, UpgradeFeatureMeta> = {
  pos: {
    key: "pos",
    labelAr: "الكاشير / POS",
    labelEn: "POS / Cashier",
    hintAr: "نقاط البيع والورديات والمخزون السريع للكاشير.",
    hintEn: "Point of sale, shifts, and fast cashier inventory.",
    href: "/pos",
    minPlan: "PROFESSIONAL",
  },
  resto: {
    key: "resto",
    labelAr: "المطاعم",
    labelEn: "Restaurants",
    hintAr: "الصالة والمطبخ والقائمة والحجوزات.",
    hintEn: "Floor, kitchen, menu, and reservations.",
    href: "/resto",
    minPlan: "ENTERPRISE",
  },
  aiAnalytics: {
    key: "aiAnalytics",
    labelAr: "تحليلات الذكاء الاصطناعي",
    labelEn: "AI Analytics",
    hintAr: "رؤى وتنبؤات مدعومة بالذكاء الاصطناعي.",
    hintEn: "AI-powered insights and forecasts.",
    href: "/ai-analytics",
    minPlan: "ENTERPRISE",
  },
  multiBranch: {
    key: "multiBranch",
    labelAr: "الفروع والمشاريع",
    labelEn: "Branches & projects",
    hintAr: "إدارة فروع ومشاريع متعددة في نفس الشركة.",
    hintEn: "Manage multiple branches and projects in one company.",
    href: "/branches",
    minPlan: "PROFESSIONAL",
  },
  apiKeys: {
    key: "apiKeys",
    labelAr: "مفاتيح API",
    labelEn: "API keys",
    hintAr: "تكاملات خارجية عبر واجهة برمجة التطبيقات.",
    hintEn: "External integrations via the API.",
    href: "/api-keys",
    minPlan: "PROFESSIONAL",
  },
  advancedReports: {
    key: "advancedReports",
    labelAr: "التقارير المتقدمة",
    labelEn: "Advanced reports",
    hintAr: "تقارير مالية وتحليلية أوسع ضمن الباقة.",
    hintEn: "Broader financial and analytical reports on your plan.",
    href: "/reports",
    minPlan: "PROFESSIONAL",
  },
};

const FEATURE_STORAGE = "hisaby-upgrade-feature";
const RETURN_STORAGE = "hisaby-upgrade-return";

export function parseUpgradeFeature(
  raw?: string | null,
): UpgradeFeatureKey | null {
  if (!raw) return null;
  return raw in UPGRADE_FEATURES ? (raw as UpgradeFeatureKey) : null;
}

export function subscriptionUpgradeHref(
  feature?: UpgradeFeatureKey | string | null,
  from?: string | null,
) {
  const params = new URLSearchParams();
  const f = parseUpgradeFeature(feature);
  if (f) params.set("feature", f);
  else if (feature && typeof feature === "string") params.set("module", feature);
  if (from) params.set("from", from);
  const q = params.toString();
  return q ? `/subscription?${q}` : "/subscription";
}

export function rememberUpgradeIntent(
  feature?: UpgradeFeatureKey | null,
  from?: string | null,
) {
  if (typeof window === "undefined") return;
  try {
    if (feature) sessionStorage.setItem(FEATURE_STORAGE, feature);
    else sessionStorage.removeItem(FEATURE_STORAGE);
    if (from) sessionStorage.setItem(RETURN_STORAGE, from);
    else if (feature) {
      sessionStorage.setItem(RETURN_STORAGE, UPGRADE_FEATURES[feature].href);
    }
  } catch {
    /* ignore */
  }
}

export function readUpgradeIntent(): {
  feature: UpgradeFeatureKey | null;
  returnTo: string | null;
} {
  if (typeof window === "undefined") {
    return { feature: null, returnTo: null };
  }
  try {
    const feature = parseUpgradeFeature(sessionStorage.getItem(FEATURE_STORAGE));
    const returnTo = sessionStorage.getItem(RETURN_STORAGE);
    return { feature, returnTo };
  } catch {
    return { feature: null, returnTo: null };
  }
}

export function clearUpgradeIntent() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(FEATURE_STORAGE);
    sessionStorage.removeItem(RETURN_STORAGE);
  } catch {
    /* ignore */
  }
}

export function planRank(plan?: string | null): number {
  if (plan === "ENTERPRISE") return 3;
  if (plan === "PROFESSIONAL") return 2;
  if (plan === "STARTER") return 1;
  return 0;
}

export function planIncludesFeature(
  planId: string | undefined,
  feature: UpgradeFeatureKey,
): boolean {
  const min = UPGRADE_FEATURES[feature].minPlan;
  return planRank(planId) >= planRank(min);
}
