import {
  companyRequires2faForAdmins,
  envRequires2faForRole,
  parseRequire2faRoles,
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
});
