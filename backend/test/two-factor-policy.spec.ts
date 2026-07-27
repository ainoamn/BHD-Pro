import {
  companyRequires2faForAdmins,
  computeTwoFactorGrace,
  envRequires2faForRole,
  isHard2faAfterGraceEnabled,
  isTwoFactorSetupExemptPath,
  parseRequire2faGraceDays,
  parseRequire2faRoles,
  resolveTwoFactorGraceStart,
} from '../src/auth/two-factor-policy';

describe('two-factor-policy', () => {
  it('defaults ADMIN and MANAGER when env empty string treated as off', () => {
    // empty after trim → off (explicit disable via blank not recommended; parse uses default in callers)
    expect(parseRequire2faRoles('ADMIN,MANAGER').roles).toEqual(['ADMIN', 'MANAGER']);
    expect(envRequires2faForRole('ADMIN', 'ADMIN,MANAGER')).toBe(true);
    expect(envRequires2faForRole('CASHIER', 'ADMIN,MANAGER')).toBe(false);
  });

  it('honours ACCOUNTANT when listed', () => {
    const env = 'ADMIN,MANAGER,ACCOUNTANT';
    expect(envRequires2faForRole('accountant', env)).toBe(true);
    expect(envRequires2faForRole('VIEWER', env)).toBe(false);
  });

  it('disables env policy for off|none|-', () => {
    expect(parseRequire2faRoles('off').off).toBe(true);
    expect(envRequires2faForRole('ADMIN', 'off')).toBe(false);
    expect(envRequires2faForRole('ADMIN', 'none')).toBe(false);
    expect(envRequires2faForRole('ADMIN', '-')).toBe(false);
  });

  it('company require2faForAdmins only hits ADMIN/MANAGER', () => {
    expect(
      companyRequires2faForAdmins('ADMIN', { require2faForAdmins: true }),
    ).toBe(true);
    expect(
      companyRequires2faForAdmins('CASHIER', { require2faForAdmins: true }),
    ).toBe(false);
    expect(companyRequires2faForAdmins('ADMIN', { require2faForAdmins: false })).toBe(
      false,
    );
    expect(companyRequires2faForAdmins('ADMIN', null)).toBe(false);
  });

  it('parses grace days (default 7, 0 allowed)', () => {
    expect(parseRequire2faGraceDays(undefined)).toBe(7);
    expect(parseRequire2faGraceDays('0')).toBe(0);
    expect(parseRequire2faGraceDays('14')).toBe(14);
    expect(parseRequire2faGraceDays('nope')).toBe(7);
  });

  it('resolves grace start only from env (no silent createdAt lock)', () => {
    const fromEnv = resolveTwoFactorGraceStart('2026-07-01T00:00:00.000Z', '2020-01-01');
    expect(fromEnv?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(resolveTwoFactorGraceStart('', '2026-07-20T12:00:00.000Z')).toBeNull();
  });

  it('computes grace window and past-grace', () => {
    const start = new Date('2026-07-01T00:00:00.000Z');
    const day3 = new Date('2026-07-04T00:00:00.000Z');
    const mid = computeTwoFactorGrace(true, false, 7, start, day3);
    expect(mid.pastGrace).toBe(false);
    expect(mid.daysLeft).toBe(4);
    expect(mid.deadline).toBe('2026-07-08T00:00:00.000Z');

    const after = computeTwoFactorGrace(
      true,
      false,
      7,
      start,
      new Date('2026-07-10T00:00:00.000Z'),
    );
    expect(after.pastGrace).toBe(true);
    expect(after.daysLeft).toBe(0);

    expect(computeTwoFactorGrace(true, true, 7, start, day3).pastGrace).toBe(false);
    expect(computeTwoFactorGrace(true, false, 0, start, day3).pastGrace).toBe(true);
    expect(computeTwoFactorGrace(true, false, 7, null, day3).pastGrace).toBe(false);
  });

  it('hard-after-grace defaults off', () => {
    expect(isHard2faAfterGraceEnabled(undefined)).toBe(false);
    expect(isHard2faAfterGraceEnabled('1')).toBe(true);
    expect(isHard2faAfterGraceEnabled('off')).toBe(false);
    expect(isTwoFactorSetupExemptPath('/api/auth/2fa/setup')).toBe(true);
    expect(isTwoFactorSetupExemptPath('/api/pos/sales')).toBe(false);
  });
});
