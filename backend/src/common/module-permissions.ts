import { UserRole } from '@prisma/client';

export const MODULE_KEYS = [
  'posSales',
  'posShifts',
  'posInventory',
  'floor',
  'kitchen',
  'expo',
  'restoMenu',
  'restoReservations',
  'restoReports',
  'reports',
  'users',
  'settings',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];
export type AccessLevel = 'hidden' | 'view' | 'edit';
export type ModulePermissions = Record<ModuleKey, AccessLevel>;

const ALL_EDIT = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, 'edit']),
) as ModulePermissions;

const ALL_VIEW = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, 'view']),
) as ModulePermissions;

const ALL_HIDDEN = Object.fromEntries(
  MODULE_KEYS.map((k) => [k, 'hidden']),
) as ModulePermissions;

/** Sensible defaults by company role — company admin can override per user. */
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, ModulePermissions> = {
  ADMIN: { ...ALL_EDIT },
  MANAGER: {
    ...ALL_EDIT,
    users: 'view',
  },
  RESTO_MANAGER: {
    ...ALL_HIDDEN,
    floor: 'edit',
    kitchen: 'edit',
    expo: 'edit',
    restoMenu: 'edit',
    restoReservations: 'edit',
    restoReports: 'edit',
    posShifts: 'edit',
    settings: 'view',
    reports: 'view',
  },
  CASHIER: {
    ...ALL_HIDDEN,
    posSales: 'edit',
    posShifts: 'edit',
    posInventory: 'view',
    floor: 'view',
  },
  WAITER: {
    ...ALL_HIDDEN,
    floor: 'edit',
    kitchen: 'view',
    expo: 'view',
    restoReservations: 'view',
  },
  KITCHEN: {
    ...ALL_HIDDEN,
    kitchen: 'edit',
    expo: 'view',
    restoMenu: 'view',
  },
  ACCOUNTANT: {
    ...ALL_VIEW,
    reports: 'edit',
    settings: 'view',
    users: 'hidden',
    kitchen: 'hidden',
    expo: 'hidden',
    floor: 'view',
    posSales: 'view',
    posShifts: 'view',
  },
  VIEWER: {
    ...ALL_VIEW,
    users: 'hidden',
    settings: 'hidden',
  },
};

export function resolveModulePermissions(
  role: UserRole | string,
  stored?: unknown,
): ModulePermissions {
  const base =
    ROLE_DEFAULT_PERMISSIONS[role as UserRole] ||
    ({ ...ALL_HIDDEN, reports: 'view' } as ModulePermissions);

  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    return { ...base };
  }

  const raw = stored as Record<string, string>;
  const next = { ...base };
  for (const key of MODULE_KEYS) {
    const v = raw[key];
    if (v === 'hidden' || v === 'view' || v === 'edit') {
      next[key] = v;
    }
  }
  // Company ADMIN always retains full edit
  if (role === UserRole.ADMIN || role === 'ADMIN') {
    return { ...ALL_EDIT };
  }
  return next;
}

const RANK: Record<AccessLevel, number> = {
  hidden: 0,
  view: 1,
  edit: 2,
};

export function canAccessModule(
  permissions: ModulePermissions | undefined,
  module: ModuleKey,
  needed: AccessLevel = 'view',
): boolean {
  if (needed === 'hidden') return true;
  const level = permissions?.[module] || 'hidden';
  return RANK[level] >= RANK[needed];
}

export function accessForHttpMethod(method: string): AccessLevel {
  const m = method.toUpperCase();
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return 'view';
  return 'edit';
}
