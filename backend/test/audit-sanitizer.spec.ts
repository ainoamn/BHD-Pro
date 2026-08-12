import { sanitizeForAudit } from '../src/audit/audit-sanitizer';

describe('sanitizeForAudit', () => {
  it('redacts secrets recursively, including gateway config and approvals', () => {
    const result = sanitizeForAudit({
      name: 'Thawani',
      configJson: {
        publishableKey: 'pk_live_public',
        secretKey: 'sk_live_private',
        webhookSecret: 'whsec_private',
      },
      nested: {
        password: 'Password123',
        approval: { pin: '1234', otp: '999999' },
      },
      rows: [{ badgeSecret: 'nfc-secret', description: 'safe text' }],
    }) as Record<string, unknown>;

    expect(result.name).toBe('Thawani');
    expect(result.configJson).toBe('[redacted]');
    expect(result.nested).toEqual({
      password: '[redacted]',
      approval: '[redacted]',
    });
    expect(result.rows).toEqual([
      { badgeSecret: '[redacted]', description: 'safe text' },
    ]);
  });

  it('bounds large and cyclic inputs without throwing', () => {
    const input: Record<string, unknown> = { value: 'x'.repeat(3_000) };
    input.self = input;
    const result = sanitizeForAudit(input) as Record<string, unknown>;

    expect(String(result.value)).toContain('[truncated]');
    expect(result.self).toBe('[circular]');
  });
});
