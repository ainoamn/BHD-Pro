/** Mirrors backend module permission keys for the company app. */
export const MODULE_KEYS = [
  "dashboard",
  "sales",
  "purchases",
  "accounting",
  "reports",
  "chartOfAccounts",
  "journal",
  "bankAccounts",
  "costCenters",
  "branches",
  "projects",
  "assets",
  "employees",
  "employeeClaims",
  "commitments",
  "managementAlerts",
  "inventory",
  "deliveryNotes",
  "stockCounts",
  "warehouses",
  "contacts",
  "vat",
  "integrations",
  "aiAnalytics",
  "users",
  "settings",
  "posSales",
  "posShifts",
  "posInventory",
  "posContacts",
  "posBooks",
  "floor",
  "kitchen",
  "expo",
  "restoMenu",
  "restoReservations",
  "restoReports",
  "restoContacts",
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type AccessLevel = "hidden" | "view" | "edit";
export type ModulePermissions = Record<ModuleKey, AccessLevel>;

export const MODULE_LABELS: Record<
  ModuleKey,
  { ar: string; en: string }
> = {
  posSales: { ar: "مبيعات الكاشير", en: "POS sales" },
  posShifts: { ar: "ورديات الصندوق", en: "Cash shifts" },
  posInventory: { ar: "مخزون الكاشير", en: "POS inventory" },
  posContacts: { ar: "دفتر عناوين الكاشير", en: "POS contacts" },
  posBooks: { ar: "دفاتر الكاشير", en: "POS books" },
  dashboard: { ar: "لوحة التحكم", en: "Dashboard" },
  sales: { ar: "المبيعات", en: "Sales" },
  purchases: { ar: "المشتريات", en: "Purchases" },
  accounting: { ar: "القيود اليومية", en: "Accounting workspace" },
  chartOfAccounts: { ar: "شجرة الحسابات", en: "Chart of accounts" },
  journal: { ar: "دفتر اليومية", en: "Journal" },
  bankAccounts: { ar: "الحسابات البنكية", en: "Bank accounts" },
  costCenters: { ar: "مراكز التكلفة", en: "Cost centers" },
  branches: { ar: "الفروع", en: "Branches" },
  projects: { ar: "المشاريع", en: "Projects" },
  assets: { ar: "الأصول", en: "Assets" },
  employees: { ar: "الموظفون", en: "Employees" },
  employeeClaims: { ar: "مطالبات الموظفين", en: "Employee claims" },
  commitments: { ar: "الالتزامات", en: "Commitments" },
  managementAlerts: { ar: "تنبيهات الإدارة", en: "Management alerts" },
  inventory: { ar: "المخزون", en: "Inventory" },
  deliveryNotes: { ar: "أذون التسليم", en: "Delivery notes" },
  stockCounts: { ar: "الجرد", en: "Stock counts" },
  warehouses: { ar: "المستودعات", en: "Warehouses" },
  contacts: { ar: "دفتر العناوين", en: "Address book" },
  vat: { ar: "الضريبة", en: "VAT" },
  integrations: { ar: "التكاملات", en: "Integrations" },
  aiAnalytics: { ar: "تحليلات ذكية", en: "AI analytics" },
  floor: { ar: "صالة وطاولات", en: "Floor & tables" },
  kitchen: { ar: "المطبخ", en: "Kitchen" },
  expo: { ar: "التقديم (Expo)", en: "Expo pass" },
  restoMenu: { ar: "قائمة المطاعم", en: "Restaurant menu" },
  restoReservations: { ar: "الحجوزات والانتظار", en: "Reservations & waitlist" },
  restoReports: { ar: "تقارير المطاعم", en: "Restaurant reports" },
  restoContacts: { ar: "جهات اتصال المطاعم", en: "Restaurants contacts" },
  reports: { ar: "التقارير المالية", en: "Financial reports" },
  users: { ar: "المستخدمون", en: "Users" },
  settings: { ar: "الإعدادات", en: "Settings" },
};

/** Nested groups for the company users permission UI (same style as plan tree). */
export const USER_ACCESS_GROUPS: {
  id: string;
  labelAr: string;
  labelEn: string;
  modules: ModuleKey[];
}[] = [
  {
    id: "accounting",
    labelAr: "المحاسبة والإدارة",
    labelEn: "Accounting & admin",
    modules: [
      "dashboard",
      "sales",
      "purchases",
      "accounting",
      "reports",
      "chartOfAccounts",
      "journal",
      "bankAccounts",
      "costCenters",
      "branches",
      "projects",
      "assets",
      "employees",
      "employeeClaims",
      "commitments",
      "managementAlerts",
      "inventory",
      "deliveryNotes",
      "stockCounts",
      "warehouses",
      "contacts",
      "vat",
      "integrations",
      "aiAnalytics",
      "users",
      "settings",
    ],
  },
  {
    id: "pos",
    labelAr: "الكاشير / POS",
    labelEn: "POS / Cashier",
    modules: ["posSales", "posShifts", "posInventory", "posContacts", "posBooks"],
  },
  {
    id: "resto",
    labelAr: "نظام المطاعم",
    labelEn: "Restaurants",
    modules: [
      "floor",
      "kitchen",
      "expo",
      "restoMenu",
      "restoReservations",
      "restoReports",
      "restoContacts",
    ],
  },
];

const ALL_EDIT = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, "edit"]),
) as ModulePermissions;

const ALL_VIEW = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, "view"]),
) as ModulePermissions;

const ALL_HIDDEN = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, "hidden"]),
) as ModulePermissions;

/** Sensible defaults by company role — mirrors backend. */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, ModulePermissions> = {
  ADMIN: { ...ALL_EDIT },
  MANAGER: {
    ...ALL_EDIT,
    users: "view",
  },
  RESTO_MANAGER: {
    ...ALL_HIDDEN,
    dashboard: "view",
    contacts: "view",
    inventory: "view",
    floor: "edit",
    kitchen: "edit",
    expo: "edit",
    restoMenu: "edit",
    restoReservations: "edit",
    restoReports: "edit",
    restoContacts: "edit",
    posShifts: "edit",
    posInventory: "view",
    posContacts: "view",
    posBooks: "view",
    settings: "view",
    reports: "view",
  },
  CASHIER: {
    ...ALL_HIDDEN,
    posSales: "edit",
    posShifts: "edit",
    posInventory: "view",
    posContacts: "edit",
    posBooks: "edit",
    contacts: "view",
    inventory: "hidden",
    floor: "view",
  },
  WAITER: {
    ...ALL_HIDDEN,
    floor: "edit",
    kitchen: "view",
    expo: "view",
    restoReservations: "view",
    restoContacts: "view",
  },
  KITCHEN: {
    ...ALL_HIDDEN,
    kitchen: "edit",
    expo: "view",
    restoMenu: "view",
  },
  ACCOUNTANT: {
    ...ALL_HIDDEN,
    dashboard: "edit",
    sales: "edit",
    purchases: "edit",
    accounting: "edit",
    reports: "edit",
    chartOfAccounts: "edit",
    journal: "edit",
    bankAccounts: "edit",
    costCenters: "edit",
    branches: "edit",
    projects: "edit",
    assets: "edit",
    employees: "edit",
    employeeClaims: "edit",
    commitments: "edit",
    managementAlerts: "edit",
    inventory: "edit",
    deliveryNotes: "edit",
    stockCounts: "edit",
    warehouses: "edit",
    contacts: "edit",
    vat: "edit",
    integrations: "view",
    aiAnalytics: "view",
    settings: "view",
    users: "hidden",
    kitchen: "hidden",
    expo: "hidden",
  },
  VIEWER: {
    ...ALL_HIDDEN,
    dashboard: "view",
    sales: "view",
    purchases: "view",
    accounting: "view",
    reports: "view",
    chartOfAccounts: "view",
    journal: "view",
    bankAccounts: "view",
    costCenters: "view",
    branches: "view",
    projects: "view",
    assets: "view",
    employees: "view",
    employeeClaims: "view",
    commitments: "view",
    managementAlerts: "view",
    inventory: "view",
    deliveryNotes: "view",
    stockCounts: "view",
    warehouses: "view",
    contacts: "view",
    vat: "view",
    integrations: "view",
    aiAnalytics: "view",
    posSales: "view",
    posShifts: "view",
    posInventory: "view",
    posContacts: "view",
    posBooks: "view",
    floor: "view",
    kitchen: "view",
    expo: "view",
    restoMenu: "view",
    restoReservations: "view",
    restoReports: "view",
    restoContacts: "view",
    users: "hidden",
    settings: "hidden",
  },
};

export function defaultsForRole(role: string): ModulePermissions {
  return {
    ...(ROLE_DEFAULT_PERMISSIONS[role] || {
      ...ALL_HIDDEN,
      reports: "view",
    }),
  };
}

export function resolveModulePermissions(
  role: string,
  stored?: Partial<ModulePermissions> | null,
): ModulePermissions {
  const base = defaultsForRole(role);
  if (!stored || typeof stored !== "object") return { ...base };
  const next = { ...base };
  for (const key of MODULE_KEYS) {
    const v = stored[key];
    if (v === "hidden" || v === "view" || v === "edit") next[key] = v;
  }
  if (role === "ADMIN") return { ...ALL_EDIT };
  return next;
}

const RANK: Record<AccessLevel, number> = {
  hidden: 0,
  view: 1,
  edit: 2,
};

export function canAccessModule(
  permissions: Partial<ModulePermissions> | null | undefined,
  module: ModuleKey,
  needed: AccessLevel = "view",
): boolean {
  if (needed === "hidden") return true;
  const level = (permissions?.[module] as AccessLevel) || "hidden";
  return RANK[level] >= RANK[needed];
}

export const RESTO_SECTION_MODULE: Record<string, ModuleKey> = {
  "/resto": "floor",
  "/resto/takeaway": "floor",
  "/resto/delivery": "floor",
  "/resto/board": "floor",
  "/resto/kitchen": "kitchen",
  "/resto/expo": "expo",
  "/resto/menu": "restoMenu",
  "/resto/recipes": "restoMenu",
  "/resto/reservations": "restoReservations",
  "/resto/waitlist": "restoReservations",
  "/resto/reports": "restoReports",
  "/resto/contacts": "restoContacts",
  "/resto/shifts": "posShifts",
  "/resto/settings": "settings",
};

export const POS_SECTION_MODULE: Record<string, ModuleKey> = {
  "/pos": "posSales",
  "/pos/inventory": "posInventory",
  "/pos/contacts": "posContacts",
  "/pos/books": "posBooks",
  "/pos/shifts": "posShifts",
  "/pos/approvals": "posShifts",
  "/pos/settings": "settings",
};

export function moduleForRestoPath(
  pathname: string | null | undefined,
): ModuleKey | null {
  if (!pathname) return null;
  const hit = Object.entries(RESTO_SECTION_MODULE).find(
    ([href]) => pathname === href || pathname.startsWith(href + "/"),
  );
  const matches = Object.entries(RESTO_SECTION_MODULE)
    .filter(([href]) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b[0].length - a[0].length);
  return (
    matches[0]?.[1] || hit?.[1] || (pathname.startsWith("/resto") ? "floor" : null)
  );
}

export function moduleForPosPath(
  pathname: string | null | undefined,
): ModuleKey | null {
  if (!pathname) return null;
  const matches = Object.entries(POS_SECTION_MODULE)
    .filter(([href]) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b[0].length - a[0].length);
  return matches[0]?.[1] || (pathname.startsWith("/pos") ? "posSales" : null);
}

export const DASHBOARD_SECTION_MODULE: Record<string, ModuleKey> = {
  "/dashboard": "dashboard",
  "/sales": "sales",
  "/purchases": "purchases",
  "/accounting": "accounting",
  "/reports": "reports",
  "/chart-of-accounts": "chartOfAccounts",
  "/journal": "journal",
  "/bank-accounts": "bankAccounts",
  "/cost-centers": "costCenters",
  "/branches": "branches",
  "/projects": "projects",
  "/assets": "assets",
  "/employees": "employees",
  "/employee-claims": "employeeClaims",
  "/commitments": "commitments",
  "/management-alerts": "managementAlerts",
  "/manager-digests": "managementAlerts",
  "/inventory": "inventory",
  "/delivery-notes": "deliveryNotes",
  "/stock-counts": "stockCounts",
  "/warehouses": "warehouses",
  "/contacts": "contacts",
  "/vat": "vat",
  "/integrations": "integrations",
  "/ai-analytics": "aiAnalytics",
  "/settings": "settings",
  "/period-locks": "settings",
  "/tax-rates": "settings",
  "/api-keys": "settings",
  "/document-templates": "settings",
  "/custom-fields": "settings",
  "/exchange-rates": "settings",
  "/fx-revaluation": "settings",
  "/subscription": "settings",
  "/users": "users",
};

export function moduleForDashboardPath(
  pathname: string | null | undefined,
): ModuleKey | null {
  if (!pathname) return null;
  const matches = Object.entries(DASHBOARD_SECTION_MODULE)
    .filter(([href]) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b[0].length - a[0].length);
  return matches[0]?.[1] || null;
}
