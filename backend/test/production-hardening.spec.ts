import { ForbiddenException } from '@nestjs/common';
import { assertPublicRegistrationAllowed } from '../src/auth/registration-policy';
import { assertProductionSecrets } from '../src/common/crypto/secrets.crypto';
import {
  getBootstrapAdminEmails,
  isProtectedPlatformAdminEmail,
} from '../src/common/guards/platform-admin.guard';

describe('production hardening', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(48);
    process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
    process.env.PAYMENT_SECRETS_KEY = 'c'.repeat(48);
    process.env.CORS_ORIGIN = 'https://hisaby.pro,https://www.hisaby.pro';
    process.env.FRONTEND_URL = 'https://www.hisaby.pro';
    process.env.API_PUBLIC_URL = 'https://hisaby.pro';
    process.env.PLATFORM_ADMIN_EMAILS = 'operator@hisaby.pro';
    process.env.PLATFORM_OWNER_EMAIL = 'owner@hisaby.pro';
    process.env.ALLOW_PUBLIC_REGISTRATION = 'false';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('accepts explicit HTTPS origins and strong secrets', () => {
    expect(() => assertProductionSecrets()).not.toThrow();
  });

  it.each([
    '*',
    'http://hisaby.pro',
    'https://hisaby.pro,http://www.hisaby.pro',
    'not-a-url',
  ])('rejects unsafe production CORS origin: %s', (origin) => {
    process.env.CORS_ORIGIN = origin;
    expect(() => assertProductionSecrets()).toThrow(/CORS_ORIGIN/);
  });

  it('rejects placeholder production secrets', () => {
    process.env.PAYMENT_SECRETS_KEY =
      'REPLACE_WITH_OPENSSL_RAND_BASE64_48';
    expect(() => assertProductionSecrets()).toThrow(/PAYMENT_SECRETS_KEY/);
  });

  it('uses only environment-configured production administrators', () => {
    expect(getBootstrapAdminEmails().sort()).toEqual([
      'operator@hisaby.pro',
      'owner@hisaby.pro',
    ]);
    expect(isProtectedPlatformAdminEmail('owner@hisaby.pro')).toBe(true);
    expect(isProtectedPlatformAdminEmail('admin@hisaby.pro')).toBe(false);
  });

  it('blocks public tenant registration by default in production', () => {
    expect(() => assertPublicRegistrationAllowed()).toThrow(
      ForbiddenException,
    );
  });
});
