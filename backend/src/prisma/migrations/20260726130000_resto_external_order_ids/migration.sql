-- External aggregator / marketplace order identity (idempotent ingest)
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "external_channel" TEXT;
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "external_order_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "resto_orders_company_id_external_channel_external_order_id_key"
  ON "resto_orders"("company_id", "external_channel", "external_order_id");
