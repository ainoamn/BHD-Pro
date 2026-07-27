-- Wave BC: user home warehouse + POS deferred fulfillment
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "default_warehouse_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pos_warehouse_id" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pos_fulfillment_status" TEXT;

CREATE INDEX IF NOT EXISTS "users_default_warehouse_id_idx" ON "users"("default_warehouse_id");
CREATE INDEX IF NOT EXISTS "invoices_pos_warehouse_id_idx" ON "invoices"("pos_warehouse_id");
CREATE INDEX IF NOT EXISTS "invoices_pos_fulfillment_status_idx" ON "invoices"("pos_fulfillment_status");

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_default_warehouse_id_fkey"
    FOREIGN KEY ("default_warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_pos_warehouse_id_fkey"
    FOREIGN KEY ("pos_warehouse_id") REFERENCES "warehouses"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
