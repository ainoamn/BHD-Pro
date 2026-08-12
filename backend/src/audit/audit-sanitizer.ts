const REDACTED = '[redacted]';
const MAX_DEPTH = 8;
const MAX_KEYS = 100;
const MAX_ARRAY_ITEMS = 100;
const MAX_STRING_LENGTH = 2_000;

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'currentpassword',
  'newpassword',
  'temporarypassword',
  'passcode',
  'pin',
  'otp',
  'totp',
  'totpcode',
  'code',
  'cvv',
  'cvc',
  'token',
  'temptoken',
  'refreshtoken',
  'accesstoken',
  'idtoken',
  'invitetoken',
  'secret',
  'secretkey',
  'webhooksecret',
  'clientsecret',
  'privatekey',
  'apikey',
  'badgesecret',
  'configjson',
  'credentials',
  'approval',
]);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizeKey(key);
  if (SENSITIVE_KEYS.has(normalized)) return true;
  return /(password|passwd|secret|token|credential|privatekey|api-?key|webhook|cvv|cvc|passcode|badge)/i.test(
    normalized,
  );
}

/**
 * Produce a bounded, JSON-safe audit snapshot. Sensitive values are removed at
 * every depth; large or cyclic request bodies cannot exhaust the audit path.
 */
export function sanitizeForAudit(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet<object>(),
): unknown {
  if (value == null || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH
      ? `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]`
      : value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return String(value);
  if (depth >= MAX_DEPTH) return '[max-depth]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeForAudit(item, depth + 1, seen));
    if (value.length > MAX_ARRAY_ITEMS) items.push('[truncated]');
    return items;
  }

  const out: Record<string, unknown> = {};
  const entries = Object.entries(value as Record<string, unknown>).slice(
    0,
    MAX_KEYS,
  );
  for (const [key, child] of entries) {
    out[key] = isSensitiveKey(key)
      ? REDACTED
      : sanitizeForAudit(child, depth + 1, seen);
  }
  if (Object.keys(value as Record<string, unknown>).length > MAX_KEYS) {
    out.__truncated__ = true;
  }
  return out;
}

