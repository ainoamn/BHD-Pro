import { ForbiddenException } from '@nestjs/common';
import { assertTenantContext } from '../src/auth/guards/jwt-auth.guard';

describe('tenant isolation boundary', () => {
  it('rejects an explicit company header from another tenant', () => {
    expect(() =>
      assertTenantContext({
        user: { companyId: 'tenant-a' },
        headers: { 'x-company-id': 'tenant-b' },
      }),
    ).toThrow(ForbiddenException);
  });

  it('accepts the authenticated tenant or no redundant header', () => {
    expect(() =>
      assertTenantContext({
        user: { companyId: 'tenant-a' },
        headers: { 'x-company-id': 'tenant-a' },
      }),
    ).not.toThrow();
    expect(() =>
      assertTenantContext({ user: { companyId: 'tenant-a' }, headers: {} }),
    ).not.toThrow();
  });
});
