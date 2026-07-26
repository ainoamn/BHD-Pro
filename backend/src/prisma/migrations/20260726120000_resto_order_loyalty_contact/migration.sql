-- Loyalty contact on resto orders
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "contact_id" TEXT;

CREATE INDEX IF NOT EXISTS "resto_orders_company_id_contact_id_idx" ON "resto_orders"("company_id", "contact_id");

DO $$ BEGIN
  ALTER TABLE "resto_orders" ADD CONSTRAINT "resto_orders_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
