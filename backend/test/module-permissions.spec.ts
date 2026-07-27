import { Test, TestingModule } from '@nestjs/testing';
import {
  canAccessModule,
  resolveModulePermissions,
} from '../src/common/module-permissions';

describe('module-permissions', () => {
  it('gives ADMIN full edit access', () => {
    const perms = resolveModulePermissions('ADMIN');
    expect(canAccessModule(perms, 'users', 'edit')).toBe(true);
    expect(canAccessModule(perms, 'posSales', 'edit')).toBe(true);
  });

  it('keeps CASHIER limited to POS modules by default', () => {
    const perms = resolveModulePermissions('CASHIER');
    expect(canAccessModule(perms, 'posSales', 'edit')).toBe(true);
    expect(canAccessModule(perms, 'dashboard', 'view')).toBe(false);
    expect(canAccessModule(perms, 'users', 'view')).toBe(false);
  });

  it('allows ACCOUNTANT accounting modules and hides kitchen', () => {
    const perms = resolveModulePermissions('ACCOUNTANT');
    expect(canAccessModule(perms, 'sales', 'edit')).toBe(true);
    expect(canAccessModule(perms, 'kitchen', 'view')).toBe(false);
  });
});

describe('nest testing smoke', () => {
  it('boots an empty testing module', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [],
    }).compile();
    expect(module).toBeDefined();
  });
});
