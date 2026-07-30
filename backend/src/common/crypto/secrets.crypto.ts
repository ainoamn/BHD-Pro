import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

function deriveKey(): Buffer | null {
  const raw = process.env.PAYMENT_SECRETS_KEY?.trim();
  if (!raw) return null;
  return createHash('sha256').update(raw).digest();
}

/** Encrypt secret fields at rest (AES-256-GCM). Plain values pass through until a key is set. */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(PREFIX)) return plaintext;
  const key = deriveKey();
  if (!key) return plaintext;
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(value: string): string {
  if (!value || !value.startsWith(PREFIX)) return value;
  const key = deriveKey();
  if (!key) {
    throw new Error('PAYMENT_SECRETS_KEY required to decrypt stored secrets');
  }
  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Invalid encrypted secret format');
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64url');
  const tag = Buffer.from(tagB64, 'base64url');
  const data = Buffer.from(dataB64, 'base64url');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function encryptConfigSecrets(
  config: Record<string, string>,
  secretKeys: string[],
): Record<string, string> {
  const out = { ...config };
  for (const key of secretKeys) {
    if (out[key] && out[key] !== '••••••••') {
      out[key] = encryptSecret(out[key]);
    } else if (out[key] === '••••••••') {
      delete out[key]; // keep existing when UI sends mask
    }
  }
  return out;
}

export function decryptConfigSecrets(
  config: Record<string, string>,
  secretKeys: string[],
): Record<string, string> {
  const out = { ...config };
  for (const key of secretKeys) {
    if (out[key]) out[key] = decryptSecret(out[key]);
  }
  return out;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function assertProductionSecrets() {
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) return;

  const jwt = process.env.JWT_SECRET || '';
  const refresh = process.env.JWT_REFRESH_SECRET || '';
  const weak = [
    'qootk-dev-secret-change-in-production',
    'qootk-dev-refresh-secret',
    'change-me',
    'secret',
    'REPLACE_WITH',
    'CHANGE_ME',
  ];

  if (jwt.length < 32 || weak.some((w) => jwt.includes(w))) {
    throw new Error(
      'FATAL: JWT_SECRET must be a strong random value (≥32 chars) in production',
    );
  }
  if (refresh.length < 32 || weak.some((w) => refresh.includes(w))) {
    throw new Error(
      'FATAL: JWT_REFRESH_SECRET must be a strong random value (≥32 chars) in production',
    );
  }
  if (jwt === refresh) {
    throw new Error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must differ');
  }
  const paymentSecretsKey = process.env.PAYMENT_SECRETS_KEY || '';
  if (
    paymentSecretsKey.length < 32 ||
    weak.some((w) => paymentSecretsKey.includes(w))
  ) {
    throw new Error(
      'FATAL: PAYMENT_SECRETS_KEY (≥32 chars) required in production to encrypt gateway secrets',
    );
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
