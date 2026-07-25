-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'STORE_CREDIT';

-- Seed liability 2130 for existing companies (new companies get it via AuthService chart seed)
INSERT INTO "accounts" ("id", "company_id", "code", "name", "type", "category", "opening_balance", "current_balance", "is_active", "is_bank", "created_at", "updated_at")
SELECT gen_random_uuid()::text, c.id, '2130', 'ائتمان عملاء (رصيد متجر)', 'LIABILITY', 'CURRENT_LIABILITY', 0, 0, true, false, NOW(), NOW()
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "accounts" a WHERE a."company_id" = c.id AND a."code" = '2130'
);
