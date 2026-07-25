-- POS parked carts (multi-device sync)

CREATE TABLE "pos_drafts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "contact_id" TEXT,
    "lines_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_drafts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "pos_drafts_company_id_idx" ON "pos_drafts"("company_id");
CREATE INDEX "pos_drafts_company_id_created_at_idx" ON "pos_drafts"("company_id", "created_at");

ALTER TABLE "pos_drafts"
  ADD CONSTRAINT "pos_drafts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_drafts"
  ADD CONSTRAINT "pos_drafts_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
