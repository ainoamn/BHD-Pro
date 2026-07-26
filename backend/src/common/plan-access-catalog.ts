/**
 * Hierarchical plan access catalog — mirrors company sidebar + POS + Resto.
 * Stored on PlanDefinition.features.modules as Record<code, { enabled, transactionLimit }>.
 */

export type PlanModuleGrant = {
  enabled: boolean;
  /** null / -1 = unlimited; >=0 = allowed transactions (per billing period where applicable) */
  transactionLimit: number | null;
};

export type PlanAccessModule = {
  code: string;
  labelAr: string;
  labelEn: string;
  href?: string;
  /** Maps to legacy PlanFeatureKey for coarse gates */
  legacyFeature?: string;
  supportsLimit?: boolean;
};

export type PlanAccessGroup = {
  id: string;
  labelAr: string;
  labelEn: string;
  modules: PlanAccessModule[];
};

export const PLAN_ACCESS_GROUPS: PlanAccessGroup[] = [
  {
    id: 'accounting',
    labelAr: 'المحاسبة',
    labelEn: 'Accounting',
    modules: [
      { code: 'dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', href: '/dashboard', legacyFeature: 'accounting' },
      { code: 'sales', labelAr: 'مركز المبيعات', labelEn: 'Sales center', href: '/sales', legacyFeature: 'accounting', supportsLimit: true },
      { code: 'purchases', labelAr: 'مركز المشتريات', labelEn: 'Purchases', href: '/purchases', legacyFeature: 'accounting', supportsLimit: true },
      { code: 'accounting', labelAr: 'المحاسبة', labelEn: 'Accounting', href: '/accounting', legacyFeature: 'accounting' },
      { code: 'reports', labelAr: 'التقارير المالية', labelEn: 'Financial reports', href: '/reports', legacyFeature: 'advancedReports' },
      { code: 'chartOfAccounts', labelAr: 'شجرة الحسابات', labelEn: 'Chart of accounts', href: '/chart-of-accounts', legacyFeature: 'accounting' },
      { code: 'journal', labelAr: 'القيود اليومية', labelEn: 'Journal entries', href: '/journal', legacyFeature: 'accounting', supportsLimit: true },
      { code: 'bankAccounts', labelAr: 'الحسابات البنكية', labelEn: 'Bank accounts', href: '/bank-accounts', legacyFeature: 'accounting' },
      { code: 'costCenters', labelAr: 'مراكز التكلفة', labelEn: 'Cost centers', href: '/cost-centers', legacyFeature: 'accounting' },
      { code: 'branches', labelAr: 'الفروع', labelEn: 'Branches', href: '/branches', legacyFeature: 'multiBranch' },
      { code: 'projects', labelAr: 'المشاريع', labelEn: 'Projects', href: '/projects', legacyFeature: 'multiBranch' },
      { code: 'assets', labelAr: 'الأصول', labelEn: 'Assets', href: '/assets', legacyFeature: 'accounting' },
      { code: 'employees', labelAr: 'الموظفين والرواتب', labelEn: 'Employees & payroll', href: '/employees', legacyFeature: 'accounting' },
      { code: 'employeeClaims', labelAr: 'مطالبات الموظفين', labelEn: 'Employee claims', href: '/employee-claims', legacyFeature: 'accounting', supportsLimit: true },
      { code: 'commitments', labelAr: 'الالتزامات الدورية', labelEn: 'Recurring commitments', href: '/commitments', legacyFeature: 'accounting' },
      { code: 'managementAlerts', labelAr: 'تنبيهات الإدارة', labelEn: 'Management alerts', href: '/management-alerts', legacyFeature: 'accounting' },
      { code: 'inventory', labelAr: 'المخزون', labelEn: 'Inventory', href: '/inventory', legacyFeature: 'inventory' },
      { code: 'deliveryNotes', labelAr: 'إشعارات التسليم', labelEn: 'Delivery notes', href: '/delivery-notes', legacyFeature: 'inventory', supportsLimit: true },
      { code: 'stockCounts', labelAr: 'عمليات الجرد', labelEn: 'Stock counts', href: '/stock-counts', legacyFeature: 'inventory', supportsLimit: true },
      { code: 'warehouses', labelAr: 'المستودعات', labelEn: 'Warehouses', href: '/warehouses', legacyFeature: 'inventory' },
      { code: 'contacts', labelAr: 'دفتر العناوين', labelEn: 'Address book', href: '/contacts', legacyFeature: 'accounting' },
      { code: 'vat', labelAr: 'الفوترة الإلكترونية', labelEn: 'e-Invoicing / VAT', href: '/vat', legacyFeature: 'accounting' },
      { code: 'integrations', labelAr: 'الربط والإشعارات', labelEn: 'Integrations', href: '/integrations', legacyFeature: 'accounting' },
      { code: 'aiAnalytics', labelAr: 'مساعد AI', labelEn: 'AI assistant', href: '/ai-analytics', legacyFeature: 'aiAnalytics' },
      { code: 'settings', labelAr: 'إعدادات الشركة', labelEn: 'Company settings', href: '/settings', legacyFeature: 'accounting' },
      { code: 'periodLocks', labelAr: 'إقفال الفترات', labelEn: 'Period locks', href: '/period-locks', legacyFeature: 'accounting' },
      { code: 'taxRates', labelAr: 'المعدلات الضريبية', labelEn: 'Tax rates', href: '/tax-rates', legacyFeature: 'accounting' },
      { code: 'apiKeys', labelAr: 'مفاتيح API', labelEn: 'API keys', href: '/api-keys', legacyFeature: 'apiKeys' },
      { code: 'documentTemplates', labelAr: 'قوالب المستندات', labelEn: 'Document templates', href: '/document-templates', legacyFeature: 'accounting' },
      { code: 'customFields', labelAr: 'حقول مخصصة', labelEn: 'Custom fields', href: '/custom-fields', legacyFeature: 'accounting' },
      { code: 'exchangeRates', labelAr: 'أسعار الصرف', labelEn: 'Exchange rates', href: '/exchange-rates', legacyFeature: 'accounting' },
      { code: 'fxRevaluation', labelAr: 'إعادة تقييم العملات', labelEn: 'FX revaluation', href: '/fx-revaluation', legacyFeature: 'accounting' },
      { code: 'subscription', labelAr: 'الاشتراك', labelEn: 'Subscription', href: '/subscription', legacyFeature: 'accounting' },
      { code: 'users', labelAr: 'المستخدمين', labelEn: 'Users', href: '/users', legacyFeature: 'accounting' },
    ],
  },
  {
    id: 'pos',
    labelAr: 'الكاشير / POS',
    labelEn: 'POS / Cashier',
    modules: [
      { code: 'pos', labelAr: 'فتح نظام الكاشير', labelEn: 'Open POS app', href: '/pos', legacyFeature: 'pos' },
      { code: 'posSales', labelAr: 'مبيعات الكاشير', labelEn: 'POS sales', legacyFeature: 'pos', supportsLimit: true },
      { code: 'posShifts', labelAr: 'الورديات والصندوق', labelEn: 'Shifts & cash drawer', legacyFeature: 'pos' },
      { code: 'posInventory', labelAr: 'مخزون الكاشير', labelEn: 'POS inventory', legacyFeature: 'pos' },
      { code: 'posReports', labelAr: 'تقارير الكاشير', labelEn: 'POS reports', legacyFeature: 'pos' },
    ],
  },
  {
    id: 'resto',
    labelAr: 'نظام المطاعم',
    labelEn: 'Restaurants',
    modules: [
      { code: 'resto', labelAr: 'فتح نظام المطاعم', labelEn: 'Open restaurants app', href: '/resto', legacyFeature: 'resto' },
      { code: 'restoFloor', labelAr: 'الصالة والطاولات', labelEn: 'Floor & tables', legacyFeature: 'resto', supportsLimit: true },
      { code: 'restoKitchen', labelAr: 'المطبخ', labelEn: 'Kitchen', legacyFeature: 'resto' },
      { code: 'restoExpo', labelAr: 'التقديم (Expo)', labelEn: 'Expo', legacyFeature: 'resto' },
      { code: 'restoMenu', labelAr: 'القائمة والوصفات', labelEn: 'Menu & recipes', legacyFeature: 'resto' },
      { code: 'restoReservations', labelAr: 'الحجوزات والانتظار', labelEn: 'Reservations & waitlist', legacyFeature: 'resto', supportsLimit: true },
      { code: 'restoReports', labelAr: 'تقارير المطاعم', labelEn: 'Restaurant reports', legacyFeature: 'resto' },
      { code: 'restoSettings', labelAr: 'إعدادات المطاعم', labelEn: 'Restaurant settings', legacyFeature: 'resto' },
    ],
  },
];

export const PLATFORM_OPERATOR_GROUPS: PlanAccessGroup[] = [
  {
    id: 'console',
    labelAr: 'لوحة تحكم المنصة',
    labelEn: 'Platform console',
    modules: [
      { code: 'full', labelAr: 'صلاحية كاملة (كل الأقسام)', labelEn: 'Full access (all sections)' },
      { code: 'overview', labelAr: 'المؤشرات', labelEn: 'Overview', href: '/admin' },
      { code: 'tenants', labelAr: 'الشركات', labelEn: 'Companies', href: '/admin/tenants' },
      { code: 'users', labelAr: 'المستخدمون', labelEn: 'Users', href: '/admin/users' },
      { code: 'operators', labelAr: 'مشرفو المنصة', labelEn: 'Platform operators', href: '/admin/operators' },
      { code: 'billing', labelAr: 'الاشتراكات والمدفوعات', labelEn: 'Billing', href: '/admin/billing' },
      { code: 'plans', labelAr: 'الباقات والعروض', labelEn: 'Plans & offers', href: '/admin/plans' },
      { code: 'visits', labelAr: 'الزيارات', labelEn: 'Visits', href: '/admin/visits' },
      { code: 'gateways', labelAr: 'بوابات الدفع', labelEn: 'Payment gateways', href: '/admin/gateways' },
    ],
  },
];

export function allPlanModuleCodes(): string[] {
  return PLAN_ACCESS_GROUPS.flatMap((g) => g.modules.map((m) => m.code));
}

/** href (e.g. /sales) → module code */
export function moduleCodeByHref(href: string): string | null {
  const path = href.split('?')[0].replace(/\/$/, '') || '/';
  for (const g of PLAN_ACCESS_GROUPS) {
    for (const m of g.modules) {
      if (m.href === path) return m.code;
    }
  }
  return null;
}

export function findPlanModule(code: string): PlanAccessModule | undefined {
  for (const g of PLAN_ACCESS_GROUPS) {
    const m = g.modules.find((x) => x.code === code);
    if (m) return m;
  }
  return undefined;
}

export function defaultModulesFromLegacy(
  legacy: Record<string, boolean>,
): Record<string, PlanModuleGrant> {
  const out: Record<string, PlanModuleGrant> = {};
  for (const g of PLAN_ACCESS_GROUPS) {
    for (const m of g.modules) {
      const feat = m.legacyFeature || 'accounting';
      const enabled = legacy[feat] !== false;
      out[m.code] = { enabled, transactionLimit: null };
    }
  }
  return out;
}

export function legacyFromModules(
  modules: Record<string, PlanModuleGrant>,
): Record<string, boolean> {
  const legacy: Record<string, boolean> = {
    accounting: false,
    inventory: false,
    pos: false,
    resto: false,
    aiAnalytics: false,
    multiBranch: false,
    apiKeys: false,
    advancedReports: false,
  };
  for (const g of PLAN_ACCESS_GROUPS) {
    for (const m of g.modules) {
      if (!modules[m.code]?.enabled) continue;
      const feat = m.legacyFeature || 'accounting';
      if (feat in legacy) legacy[feat] = true;
    }
  }
  // Core accounting stays true if any accounting module on
  if (
    Object.entries(modules).some(
      ([code, g]) =>
        g.enabled &&
        PLAN_ACCESS_GROUPS[0].modules.some((m) => m.code === code),
    )
  ) {
    legacy.accounting = true;
  }
  return legacy;
}

export function normalizePlanAccess(
  raw?: Record<string, unknown> | null,
  fallbackLegacy?: Record<string, boolean>,
): {
  modules: Record<string, PlanModuleGrant>;
  /** Coarse flags for existing guards */
  legacy: Record<string, boolean>;
} {
  const legacyBase = fallbackLegacy || {
    accounting: true,
    inventory: true,
    pos: false,
    resto: false,
    aiAnalytics: false,
    multiBranch: false,
    apiKeys: false,
    advancedReports: false,
  };

  // New shape: { modules: { sales: { enabled, transactionLimit }, ... }, accounting?: boolean, ... }
  const modulesRaw = (raw?.modules && typeof raw.modules === 'object'
    ? (raw.modules as Record<string, unknown>)
    : null);

  if (modulesRaw) {
    const modules: Record<string, PlanModuleGrant> = defaultModulesFromLegacy(legacyBase);
    for (const code of allPlanModuleCodes()) {
      const row = modulesRaw[code];
      if (row && typeof row === 'object') {
        const r = row as Record<string, unknown>;
        modules[code] = {
          enabled: r.enabled !== false,
          transactionLimit:
            typeof r.transactionLimit === 'number' ? r.transactionLimit : null,
        };
      } else if (typeof row === 'boolean') {
        modules[code] = { enabled: row, transactionLimit: null };
      }
    }
    return { modules, legacy: legacyFromModules(modules) };
  }

  // Old shape: flat booleans
  const flat: Record<string, boolean> = { ...legacyBase };
  if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'boolean' && k in flat) flat[k] = v;
    }
  }
  const modules = defaultModulesFromLegacy(flat);
  return { modules, legacy: flat };
}
