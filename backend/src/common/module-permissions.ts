import { UserRole } from '@prisma/client';

export const MODULE_KEYS = [
  'dashboard',
  'sales',
  'purchases',
  'accounting',
  'reports',
  'chartOfAccounts',
  'journal',
  'bankAccounts',
  'costCenters',
  'branches',
  'projects',
  'assets',
  'employees',
  'employeeClaims',
  'commitments',
  'managementAlerts',
  'inventory',
  'deliveryNotes',
  'stockCounts',
  'warehouses',
  'contacts',
  'vat',
  'integrations',
  'aiAnalytics',
  'users',
  'settings',
  'posSales',
  'posShifts',
  'posInventory',
  'posContacts',
  'posBooks',
  'floor',
  'kitchen',
  'expo',
  'restoMenu',
  'restoReservations',
  'restoReports',
  'restoContacts',
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
    dashboard: 'view',
    contacts: 'view',
    inventory: 'view',
    floor: 'edit',
    kitchen: 'edit',
    expo: 'edit',
    restoMenu: 'edit',
    restoReservations: 'edit',
    restoReports: 'edit',
    restoContacts: 'edit',
    posShifts: 'edit',
    posInventory: 'view',
    posContacts: 'view',
    posBooks: 'view',
    settings: 'view',
    reports: 'view',
  },
  CASHIER: {
    ...ALL_HIDDEN,
    posSales: 'edit',
    posShifts: 'edit',
    posInventory: 'view',
    posContacts: 'edit',
    posBooks: 'edit',
    contacts: 'view',
    inventory: 'hidden',
    floor: 'view',
  },
  WAITER: {
    ...ALL_HIDDEN,
    floor: 'edit',
    kitchen: 'view',
    expo: 'view',
    restoReservations: 'view',
    restoContacts: 'view',
  },
  KITCHEN: {
    ...ALL_HIDDEN,
    kitchen: 'edit',
    expo: 'view',
    restoMenu: 'view',
  },
  ACCOUNTANT: {
    ...ALL_HIDDEN,
    dashboard: 'edit',
    sales: 'edit',
    purchases: 'edit',
    accounting: 'edit',
    reports: 'edit',
    chartOfAccounts: 'edit',
    journal: 'edit',
    bankAccounts: 'edit',
    costCenters: 'edit',
    branches: 'edit',
    projects: 'edit',
    assets: 'edit',
    employees: 'edit',
    employeeClaims: 'edit',
    commitments: 'edit',
    managementAlerts: 'edit',
    inventory: 'edit',
    deliveryNotes: 'edit',
    stockCounts: 'edit',
    warehouses: 'edit',
    contacts: 'edit',
    vat: 'edit',
    integrations: 'view',
    aiAnalytics: 'view',
    settings: 'view',
    users: 'hidden',
    kitchen: 'hidden',
    expo: 'hidden',
  },
  VIEWER: {
    ...ALL_HIDDEN,
    dashboard: 'view',
    sales: 'view',
    purchases: 'view',
    accounting: 'view',
    reports: 'view',
    chartOfAccounts: 'view',
    journal: 'view',
    bankAccounts: 'view',
    costCenters: 'view',
    branches: 'view',
    projects: 'view',
    assets: 'view',
    employees: 'view',
    employeeClaims: 'view',
    commitments: 'view',
    managementAlerts: 'view',
    inventory: 'view',
    deliveryNotes: 'view',
    stockCounts: 'view',
    warehouses: 'view',
    contacts: 'view',
    vat: 'view',
    integrations: 'view',
    aiAnalytics: 'view',
    posSales: 'view',
    posShifts: 'view',
    posInventory: 'view',
    posContacts: 'view',
    posBooks: 'view',
    floor: 'view',
    kitchen: 'view',
    expo: 'view',
    restoMenu: 'view',
    restoReservations: 'view',
    restoReports: 'view',
    restoContacts: 'view',
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
  // Cashiers must not inherit legacy ERP inventory access from stored overrides
  if (role === UserRole.CASHIER || role === 'CASHIER') {
    next.inventory = 'hidden';
    next.warehouses = 'hidden';
    next.stockCounts = 'hidden';
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
