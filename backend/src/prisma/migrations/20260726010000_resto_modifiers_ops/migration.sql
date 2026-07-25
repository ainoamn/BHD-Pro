-- World-class resto ops: menu modifiers catalog
CREATE TABLE IF NOT EXISTS "resto_modifiers" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_en" TEXT,
    "price_delta" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_modifiers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resto_modifiers_company_id_sort_order_idx" ON "resto_modifiers"("company_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "resto_modifiers" ADD CONSTRAINT "resto_modifiers_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
