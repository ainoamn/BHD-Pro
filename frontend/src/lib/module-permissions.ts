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

export function moduleForRestoPath(pathname: string | null | undefined): ModuleKey | null {
  if (!pathname) return null;
  const hit = Object.entries(RESTO_SECTION_MODULE).find(
    ([href]) => pathname === href || pathname.startsWith(href + "/"),
  );
  // Prefer longest match
  const matches = Object.entries(RESTO_SECTION_MODULE)
    .filter(([href]) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b[0].length - a[0].length);
  return matches[0]?.[1] || hit?.[1] || (pathname.startsWith("/resto") ? "floor" : null);
}
