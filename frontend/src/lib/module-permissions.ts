/** Mirrors backend module permission keys for the company app. */
export const MODULE_KEYS = [
  "posSales",
  "posShifts",
  "posInventory",
  "floor",
  "kitchen",
  "expo",
  "restoMenu",
  "restoReservations",
  "restoReports",
  "reports",
  "users",
  "settings",
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
  floor: { ar: "صالة وطاولات", en: "Floor & tables" },
  kitchen: { ar: "المطبخ", en: "Kitchen" },
  expo: { ar: "التقديم (Expo)", en: "Expo pass" },
  restoMenu: { ar: "قائمة المطاعم", en: "Restaurant menu" },
  restoReservations: { ar: "الحجوزات والانتظار", en: "Reservations & waitlist" },
  restoReports: { ar: "تقارير المطاعم", en: "Restaurant reports" },
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
    modules: ["reports", "users", "settings"],
  },
  {
    id: "pos",
    labelAr: "الكاشير / POS",
    labelEn: "POS / Cashier",
    modules: ["posSales", "posShifts", "posInventory"],
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
    floor: "edit",
    kitchen: "edit",
    expo: "edit",
    restoMenu: "edit",
    restoReservations: "edit",
    restoReports: "edit",
    posShifts: "edit",
    settings: "view",
    reports: "view",
  },
  CASHIER: {
    ...ALL_HIDDEN,
    posSales: "edit",
    posShifts: "edit",
    posInventory: "view",
    floor: "view",
  },
  WAITER: {
    ...ALL_HIDDEN,
    floor: "edit",
    kitchen: "view",
    expo: "view",
    restoReservations: "view",
  },
  KITCHEN: {
    ...ALL_HIDDEN,
    kitchen: "edit",
    expo: "view",
    restoMenu: "view",
  },
  ACCOUNTANT: {
    ...ALL_VIEW,
    reports: "edit",
    settings: "view",
    users: "hidden",
    kitchen: "hidden",
    expo: "hidden",
    floor: "view",
    posSales: "view",
    posShifts: "view",
  },
  VIEWER: {
    ...ALL_VIEW,
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
  "/resto/shifts": "posShifts",
  "/resto/settings": "settings",
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
