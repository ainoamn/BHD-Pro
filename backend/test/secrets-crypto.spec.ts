import {
  decryptSecret,
  encryptSecret,
  hashToken,
} from '../src/common/crypto/secrets.crypto';

describe('versioned purpose-separated secret encryption', () => {
  const original = { ...process.env };

  beforeEach(() => {
    process.env.PAYMENT_SECRETS_KEY = 'payment-key-material-that-is-long-and-random-2026';
    process.env.PAYMENT_SECRETS_KEY_ID = 'pay-1';
    process.env.TOTP_SECRETS_KEY = 'totp-key-material-that-is-long-and-separate-2026';
    process.env.TOTP_SECRETS_KEY_ID = 'totp-1';
    delete process.env.PAYMENT_SECRETS_PREVIOUS_KEYS;
  });

  afterAll(() => {
    process.env = original;
  });

  it('round-trips v2 data only with the same purpose and AAD', () => {
    const encrypted = encryptSecret('sk_live_secret', {
      purpose: 'payment',
      aad: 'company:c1:gateway:THAWANI:secretKey',
    });
    expect(encrypted).toMatch(/^enc:v2:payment:pay-1:/);
    expect(
      decryptSecret(encrypted, {
        purpose: 'payment',
        aad: 'company:c1:gateway:THAWANI:secretKey',
      }),
    ).toBe('sk_live_secret');
    expect(() =>
      decryptSecret(encrypted, {
        purpose: 'payment',
        aad: 'company:c2:gateway:THAWANI:secretKey',
      }),
    ).toThrow();
    expect(() => decryptSecret(encrypted, { purpose: 'totp' })).toThrow(
      'purpose mismatch',
    );
  });

  it('decrypts old v2 ciphertext through the previous-key ring after rotation', () => {
    const encrypted = encryptSecret('rotatable', {
      purpose: 'payment',
      aad: 'tenant:1',
    });
    process.env.PAYMENT_SECRETS_KEY = 'new-payment-key-material-that-is-long-and-random-2026';
    process.env.PAYMENT_SECRETS_KEY_ID = 'pay-2';
    process.env.PAYMENT_SECRETS_PREVIOUS_KEYS = JSON.stringify({
      'pay-1': 'payment-key-material-that-is-long-and-random-2026',
    });
    expect(
      decryptSecret(encrypted, { purpose: 'payment', aad: 'tenant:1' }),
    ).toBe('rotatable');
  });

  it('hashes reset tokens without retaining the raw value', () => {
    expect(hashToken('one-time-token')).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken('one-time-token')).not.toContain('one-time-token');
  });
});
