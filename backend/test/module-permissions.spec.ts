import { Test, TestingModule } from '@nestjs/testing';
import {
  canAccessModule,
  resolveModulePermissions,
} from '../src/common/module-permissions';
import { moduleForPath } from '../src/common/guards/module-permission.guard';

describe('module-permissions', () => {
  it('maps authenticated API controller paths to module permissions', () => {
    expect(moduleForPath('/api/invoices')).toBe('sales');
    expect(moduleForPath('/api/purchase-orders')).toBe('purchases');
    expect(moduleForPath('/api/accounts')).toBe('chartOfAccounts');
    expect(moduleForPath('/api/products')).toBe('inventory');
    expect(moduleForPath('/api/resto/kitchen')).toBe('kitchen');
    expect(moduleForPath('/api/payments/company-gateways')).toBe('settings');
  });

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
    expect(canAccessModule(perms, 'inventory', 'view')).toBe(false);
  });

  it('forces CASHIER ERP inventory hidden even if stored override says edit', () => {
    const perms = resolveModulePermissions('CASHIER', {
      inventory: 'edit',
      warehouses: 'view',
      stockCounts: 'edit',
    });
    expect(canAccessModule(perms, 'inventory', 'view')).toBe(false);
    expect(canAccessModule(perms, 'posInventory', 'view')).toBe(true);
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
