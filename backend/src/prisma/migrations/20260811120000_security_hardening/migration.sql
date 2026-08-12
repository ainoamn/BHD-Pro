-- Security and integrity hardening (2026-08-11)
-- Keep existing API keys operational, then make new keys read-only by default.
ALTER TABLE "company_api_keys"
  ADD COLUMN IF NOT EXISTS "scopes" JSONB,
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "last_used_ip" TEXT;

UPDATE "company_api_keys"
SET "scopes" = '["read","write","all:modules"]'::jsonb
WHERE "scopes" IS NULL;

ALTER TABLE "company_api_keys"
  ALTER COLUMN "scopes" SET NOT NULL,
  ALTER COLUMN "scopes" SET DEFAULT '["read","all:modules"]'::jsonb;

-- Stable idempotency key for exactly-once payment fulfillment.
ALTER TABLE "payments"
  ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_key"
  ON "payments"("idempotency_key");

-- One-time, hashed and expiring password reset tokens.
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "password_reset_tokens_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_tokens_token_hash_key"
  ON "password_reset_tokens"("token_hash");
CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_id_expires_at_idx"
  ON "password_reset_tokens"("user_id", "expires_at");

-- Atomic human-readable numbering across concurrent application replicas.
CREATE TABLE IF NOT EXISTS "document_sequences" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "series" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "last_value" INTEGER NOT NULL,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_sequences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_sequences_scope_series_period_key"
  ON "document_sequences"("scope", "series", "period");
