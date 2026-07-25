-- App ↔ warehouse sector bind + warehouse sector/branch
CREATE TYPE "WarehouseSector" AS ENUM ('GENERAL', 'RETAIL', 'RESTAURANT');

ALTER TABLE "warehouses"
  ADD COLUMN IF NOT EXISTS "sector" "WarehouseSector" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS "branch_id" TEXT;

ALTER TABLE "companies"
  ADD COLUMN IF NOT EXISTS "pos_warehouse_id" TEXT,
  ADD COLUMN IF NOT EXISTS "resto_warehouse_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "warehouses"
    ADD CONSTRAINT "warehouses_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "companies"
    ADD CONSTRAINT "companies_pos_warehouse_id_fkey"
    FOREIGN KEY ("pos_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "companies"
    ADD CONSTRAINT "companies_resto_warehouse_id_fkey"
    FOREIGN KEY ("resto_warehouse_id") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "warehouses_company_id_sector_idx" ON "warehouses"("company_id", "sector");
CREATE INDEX IF NOT EXISTS "warehouses_branch_id_idx" ON "warehouses"("branch_id");
