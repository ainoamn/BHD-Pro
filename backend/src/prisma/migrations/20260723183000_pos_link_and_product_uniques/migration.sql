-- Hisaby POS linking columns + company-scoped product identity

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "pos_linked_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "pos_integration_key_hash" TEXT,
  ADD COLUMN IF NOT EXISTS "pos_integration_key_prefix" TEXT;

-- Replace global SKU/barcode uniqueness with per-company uniqueness
DROP INDEX IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "products_barcode_key";

CREATE UNIQUE INDEX IF NOT EXISTS "products_company_id_sku_key"
  ON "products"("company_id", "sku");

CREATE UNIQUE INDEX IF NOT EXISTS "products_company_id_barcode_key"
  ON "products"("company_id", "barcode");
