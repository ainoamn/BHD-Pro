/** Roles that may freely pick any POS warehouse (managers). */
export function canSwitchWarehouseFreely(role: string): boolean {
  const r = String(role || '').toUpperCase();
  return r === 'ADMIN' || r === 'MANAGER' || r === 'RESTO_MANAGER';
}
