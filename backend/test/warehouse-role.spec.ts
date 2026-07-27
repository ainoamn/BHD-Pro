import { canSwitchWarehouseFreely } from '../src/pos/warehouse-role';

describe('warehouse-role', () => {
  it('allows managers to switch freely', () => {
    expect(canSwitchWarehouseFreely('ADMIN')).toBe(true);
    expect(canSwitchWarehouseFreely('MANAGER')).toBe(true);
    expect(canSwitchWarehouseFreely('RESTO_MANAGER')).toBe(true);
  });

  it('locks cashiers and floor staff', () => {
    expect(canSwitchWarehouseFreely('CASHIER')).toBe(false);
    expect(canSwitchWarehouseFreely('WAITER')).toBe(false);
    expect(canSwitchWarehouseFreely('ACCOUNTANT')).toBe(false);
    expect(canSwitchWarehouseFreely('')).toBe(false);
  });
});
