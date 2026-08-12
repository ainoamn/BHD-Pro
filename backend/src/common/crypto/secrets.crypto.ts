import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from 'crypto';

const V1_PREFIX = 'enc:v1:';
const V2_PREFIX = 'enc:v2:';

export type SecretPurpose = 'payment' | 'totp';
export type SecretContext = {
  purpose?: SecretPurpose;
  aad?: string;
};

type KeyMaterial = { id: string; raw: string };

function sanitizeKeyId(value: string): string {
  const id = value.trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  return id || 'current';
}

function envPrefix(purpose: SecretPurpose): string {
  return purpose === 'totp' ? 'TOTP_SECRETS' : 'PAYMENT_SECRETS';
}

function currentKey(purpose: SecretPurpose): KeyMaterial | null {
  const prefix = envPrefix(purpose);
  const purposeSpecific = process.env[`${prefix}_KEY`]?.trim();
  // Non-production fallback keeps local development compatible. Production
  // requires a purpose-specific TOTP key in assertProductionSecrets().
  const raw =
    purposeSpecific ||
    (purpose === 'totp'
      ? process.env.PAYMENT_SECRETS_KEY?.trim()
      : process.env.PAYMENT_SECRETS_KEY?.trim());
  if (!raw) return null;
  return {
    id: sanitizeKeyId(process.env[`${prefix}_KEY_ID`] || 'current'),
    raw,
  };
}

function previousKeys(purpose: SecretPurpose): KeyMaterial[] {
  const raw = process.env[`${envPrefix(purpose)}_PREVIOUS_KEYS`]?.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed)
      .filter(([, value]) => typeof value === 'string' && value.length >= 16)
      .map(([id, value]) => ({ id: sanitizeKeyId(id), raw: String(value) }));
  } catch {
    throw new Error(
      `${envPrefix(purpose)}_PREVIOUS_KEYS must be a JSON object of key-id to secret`,
    );
  }
}

function deriveKey(raw: string, purpose: SecretPurpose): Buffer {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(raw, 'utf8'),
      Buffer.from('hisaby-secrets-v2', 'utf8'),
      Buffer.from(`purpose:${purpose}`, 'utf8'),
      32,
    ),
  );
}

function aadFor(purpose: SecretPurpose, aad?: string): Buffer {
  return Buffer.from(`hisaby:${purpose}:${aad || 'global'}`, 'utf8');
}

/** AES-256-GCM with purpose separation, key id, and authenticated context. */
export function encryptSecret(
  plaintext: string,
  context: SecretContext = {},
): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(V1_PREFIX) || plaintext.startsWith(V2_PREFIX)) {
    return plaintext;
  }
  const purpose = context.purpose || 'payment';
  const material = currentKey(purpose);
  if (!material) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    deriveKey(material.raw, purpose),
    iv,
  );
  cipher.setAAD(aadFor(purpose, context.aad));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${V2_PREFIX}${purpose}:${material.id}:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

function decryptV1(value: string): string {
  const raw = process.env.PAYMENT_SECRETS_KEY?.trim();
  if (!raw) {
    throw new Error('PAYMENT_SECRETS_KEY required to decrypt legacy secrets');
  }
  const parts = value.slice(V1_PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format');
  const [ivB64, tagB64, dataB64] = parts;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    createHash('sha256').update(raw).digest(),
    Buffer.from(ivB64, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const data = Buffer.from(dataB64, 'base64url');
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    'utf8',
  );
}

export function decryptSecret(
  value: string,
  context: SecretContext = {},
): string {
  if (!value || (!value.startsWith(V1_PREFIX) && !value.startsWith(V2_PREFIX))) {
    return value;
  }
  if (value.startsWith(V1_PREFIX)) return decryptV1(value);

  const parts = value.slice(V2_PREFIX.length).split(':');
  if (parts.length !== 5) throw new Error('Invalid encrypted secret format');
  const [storedPurpose, keyId, ivB64, tagB64, dataB64] = parts;
  if (storedPurpose !== 'payment' && storedPurpose !== 'totp') {
    throw new Error('Invalid encrypted secret purpose');
  }
  const purpose = storedPurpose as SecretPurpose;
  if (context.purpose && context.purpose !== purpose) {
    throw new Error('Encrypted secret purpose mismatch');
  }
  const current = currentKey(purpose);
  const candidates = [...(current ? [current] : []), ...previousKeys(purpose)];
  const ordered = [
    ...candidates.filter((candidate) => candidate.id === keyId),
    ...candidates.filter((candidate) => candidate.id !== keyId),
  ];
  if (!ordered.length) {
    throw new Error(`${envPrefix(purpose)}_KEY required to decrypt stored secrets`);
  }

  let lastError: unknown;
  for (const material of ordered) {
    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        deriveKey(material.raw, purpose),
        Buffer.from(ivB64, 'base64url'),
      );
      decipher.setAAD(aadFor(purpose, context.aad));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
      const data = Buffer.from(dataB64, 'base64url');
      return Buffer.concat([decipher.update(data), decipher.final()]).toString(
        'utf8',
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(
    `Unable to decrypt ${purpose} secret with configured key ring: ${
      lastError instanceof Error ? lastError.message : 'authentication failed'
    }`,
  );
}

export function encryptConfigSecrets(
  config: Record<string, string>,
  secretKeys: string[],
  context: Omit<SecretContext, 'purpose'> = {},
): Record<string, string> {
  const out = { ...config };
  for (const key of secretKeys) {
    if (out[key] && out[key] !== '••••••••') {
      out[key] = encryptSecret(out[key], {
        purpose: 'payment',
        aad: [context.aad, key].filter(Boolean).join(':'),
      });
    } else if (out[key] === '••••••••') {
      delete out[key];
    }
  }
  return out;
}

export function decryptConfigSecrets(
  config: Record<string, string>,
  secretKeys: string[],
  context: Omit<SecretContext, 'purpose'> = {},
): Record<string, string> {
  const out = { ...config };
  for (const key of secretKeys) {
    if (out[key]) {
      out[key] = decryptSecret(out[key], {
        purpose: 'payment',
        aad: [context.aad, key].filter(Boolean).join(':'),
      });
    }
  }
  return out;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function assertStrongSecret(name: string, value: string, weak: string[]) {
  if (value.length < 32 || weak.some((candidate) => value.includes(candidate))) {
    throw new Error(`FATAL: ${name} must be a strong random value (≥32 chars)`);
  }
}

/**
 * When true, production refuses to boot without dedicated TOTP key + S3 (or
 * explicit ALLOW_INSECURE_DATAURL_STORAGE). Default is transitional so an
 * existing Render service (PAYMENT key only + dataurl) can Manual-Deploy
 * hardening without immediate outage — set HARDENING_STRICT_BOOT=true after
 * ops adds TOTP_SECRETS_KEY and S3 (or the insecure flag).
 */
export function isHardeningStrictBoot(): boolean {
  return (
    process.env.HARDENING_STRICT_BOOT === '1' ||
    process.env.HARDENING_STRICT_BOOT === 'true'
  );
}

export function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;

  const jwt = process.env.JWT_SECRET || '';
  const refresh = process.env.JWT_REFRESH_SECRET || '';
  const paymentSecretsKey = process.env.PAYMENT_SECRETS_KEY || '';
  const totpSecretsKey = process.env.TOTP_SECRETS_KEY || '';
  const strict = isHardeningStrictBoot();
  const weak = [
    'qootk-dev-secret-change-in-production',
    'qootk-dev-refresh-secret',
    'change-me',
    'secret',
    'REPLACE_WITH',
    'CHANGE_ME',
  ];

  assertStrongSecret('JWT_SECRET', jwt, weak);
  assertStrongSecret('JWT_REFRESH_SECRET', refresh, weak);
  if (jwt === refresh) {
    throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }
  assertStrongSecret('PAYMENT_SECRETS_KEY', paymentSecretsKey, weak);

  if (totpSecretsKey) {
    assertStrongSecret('TOTP_SECRETS_KEY', totpSecretsKey, weak);
    if (paymentSecretsKey === totpSecretsKey) {
      throw new Error(
        'FATAL: PAYMENT_SECRETS_KEY and TOTP_SECRETS_KEY must differ',
      );
    }
  } else if (strict) {
    assertStrongSecret('TOTP_SECRETS_KEY', totpSecretsKey, weak);
  } else {
    console.error(
      '[SECURITY] TOTP_SECRETS_KEY unset — transitional boot uses PAYMENT_SECRETS_KEY fallback for TOTP. Set a distinct TOTP_SECRETS_KEY then HARDENING_STRICT_BOOT=true.',
    );
  }

  const storage = (process.env.ATTACHMENT_STORAGE || '').toLowerCase();
  const insecureStorageAllowed =
    process.env.ALLOW_INSECURE_DATAURL_STORAGE === '1' ||
    process.env.ALLOW_INSECURE_DATAURL_STORAGE === 'true';
  if (storage !== 's3' && !insecureStorageAllowed) {
    if (strict) {
      throw new Error(
        'FATAL: production attachments require ATTACHMENT_STORAGE=s3 (temporary override: ALLOW_INSECURE_DATAURL_STORAGE=true)',
      );
    }
    console.error(
      '[SECURITY] ATTACHMENT_STORAGE is not s3 — transitional boot allows dataurl/local. Set S3 or ALLOW_INSECURE_DATAURL_STORAGE=true, then HARDENING_STRICT_BOOT=true.',
    );
  }
  if (
    storage === 's3' &&
    (!process.env.S3_BUCKET ||
      !process.env.S3_ACCESS_KEY_ID ||
      !process.env.S3_SECRET_ACCESS_KEY)
  ) {
    throw new Error('FATAL: S3 attachment storage credentials are incomplete');
  }

  const corsOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (
    !corsOrigins.length ||
    corsOrigins.includes('*') ||
    corsOrigins.some((origin) => {
      try {
        return new URL(origin).protocol !== 'https:';
      } catch {
        return true;
      }
    })
  ) {
    throw new Error(
      'FATAL: CORS_ORIGIN must contain only explicit HTTPS origins in production',
    );
  }

  for (const key of ['FRONTEND_URL', 'API_PUBLIC_URL']) {
    const value = process.env[key] || '';
    try {
      if (new URL(value).protocol !== 'https:') throw new Error();
    } catch {
      throw new Error(`FATAL: ${key} must be an absolute HTTPS URL`);
    }
  }
}
