/**
 * Env-driven 2FA role policy (pure — unit-tested).
 * REQUIRE_2FA_ROLES defaults to ADMIN,MANAGER.
 * Set to off|none|- to disable the env policy.
 */
export function parseRequire2faRoles(
  envRaw?: string | null,
): { off: boolean; roles: string[] } {
  const raw = (envRaw ?? 'ADMIN,MANAGER').trim();
  const off =
    !raw ||
    raw.toLowerCase() === 'off' ||
    raw.toLowerCase() === 'none' ||
    raw === '-';
  if (off) return { off: true, roles: [] };
  const roles = raw
    .split(',')
    .map((r) => r.trim().toUpperCase())
    .filter(Boolean);
  return { off: false, roles };
}

export function envRequires2faForRole(
  role: string,
  envRaw?: string | null,
): boolean {
  const { off, roles } = parseRequire2faRoles(envRaw);
  if (off) return false;
  return roles.includes(String(role || '').toUpperCase());
}

/** Company securityConfig.require2faForAdmins forces ADMIN/MANAGER only. */
export function companyRequires2faForAdmins(
  role: string,
  securityConfig: unknown,
): boolean {
  const r = String(role || '').toUpperCase();
  if (r !== 'ADMIN' && r !== 'MANAGER') return false;
  if (!securityConfig || typeof securityConfig !== 'object' || Array.isArray(securityConfig)) {
    return false;
  }
  return (securityConfig as { require2faForAdmins?: boolean }).require2faForAdmins === true;
}
