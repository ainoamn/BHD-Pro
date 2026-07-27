/**
 * Env-driven 2FA role policy (pure — unit-tested).
 * REQUIRE_2FA_ROLES defaults to ADMIN,MANAGER.
 * Set to off|none|- to disable the env policy.
 *
 * Grace (Wave BO):
 * REQUIRE_2FA_GRACE_DAYS defaults to 7 (0 = immediate past once GRACE_FROM is set).
 * REQUIRE_2FA_GRACE_FROM ISO date — required to start/end the grace window.
 * REQUIRE_2FA_HARD_AFTER_GRACE defaults off — set 1 to block mutations after grace.
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

const MS_PER_DAY = 86_400_000;

export function parseRequire2faGraceDays(envRaw?: string | null): number {
  const raw = (envRaw ?? '7').trim();
  if (!raw) return 7;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return 7;
  return n;
}

/** Prefer env grace-from. Without it, no hard deadline (soft banner only). */
export function resolveTwoFactorGraceStart(
  graceFromEnv?: string | null,
  _userCreatedAt?: Date | string | null,
): Date | null {
  const raw = (graceFromEnv ?? '').trim();
  if (raw) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export type TwoFactorGraceInfo = {
  pastGrace: boolean;
  deadline: string | null;
  daysLeft: number | null;
};

export function computeTwoFactorGrace(
  required: boolean,
  enabled: boolean,
  graceDays: number,
  graceStart: Date | null,
  now: Date = new Date(),
): TwoFactorGraceInfo {
  if (!required || enabled) {
    return { pastGrace: false, deadline: null, daysLeft: null };
  }
  // No GRACE_FROM → soft require (banner) without ending the window.
  if (!graceStart) {
    return { pastGrace: false, deadline: null, daysLeft: null };
  }
  if (graceDays === 0) {
    return { pastGrace: true, deadline: graceStart.toISOString(), daysLeft: 0 };
  }
  const deadlineMs = graceStart.getTime() + graceDays * MS_PER_DAY;
  const msLeft = deadlineMs - now.getTime();
  return {
    pastGrace: msLeft <= 0,
    deadline: new Date(deadlineMs).toISOString(),
    daysLeft: msLeft <= 0 ? 0 : Math.ceil(msLeft / MS_PER_DAY),
  };
}

/** Default off — set 1|true|on to block mutations after grace (needs GRACE_FROM). */
export function isHard2faAfterGraceEnabled(envRaw?: string | null): boolean {
  const raw = (envRaw ?? 'off').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

/** Paths that must stay reachable so users can finish TOTP setup after grace. */
export function isTwoFactorSetupExemptPath(pathOrUrl: string): boolean {
  const path = String(pathOrUrl || '').split('?')[0].toLowerCase();
  return (
    /\/auth\/2fa(\/|$)/.test(path) ||
    /\/auth\/(logout|me|refresh)(\/|$)/.test(path) ||
    /\/health(\/|$)/.test(path)
  );
}
