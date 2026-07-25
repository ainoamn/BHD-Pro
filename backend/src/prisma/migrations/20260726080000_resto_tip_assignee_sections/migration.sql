-- Tip assignee on resto orders + server ↔ zone section staffing

ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "tip_assignee_id" TEXT;

CREATE TABLE IF NOT EXISTS "resto_server_sections" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "zone_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_server_sections_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resto_orders_company_id_tip_assignee_id_idx" ON "resto_orders"("company_id", "tip_assignee_id");
CREATE INDEX IF NOT EXISTS "resto_server_sections_company_id_zone_id_ends_at_idx" ON "resto_server_sections"("company_id", "zone_id", "ends_at");
CREATE INDEX IF NOT EXISTS "resto_server_sections_company_id_user_id_ends_at_idx" ON "resto_server_sections"("company_id", "user_id", "ends_at");

DO $$ BEGIN
  ALTER TABLE "resto_orders" ADD CONSTRAINT "resto_orders_tip_assignee_id_fkey"
    FOREIGN KEY ("tip_assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "resto_server_sections" ADD CONSTRAINT "resto_server_sections_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "resto_server_sections" ADD CONSTRAINT "resto_server_sections_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "resto_server_sections" ADD CONSTRAINT "resto_server_sections_zone_id_fkey"
    FOREIGN KEY ("zone_id") REFERENCES "resto_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
