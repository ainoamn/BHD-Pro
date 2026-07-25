-- POS cash drawer paid-in / paid-out movements (audit trail for expected cash)

CREATE TABLE IF NOT EXISTS "pos_cash_movements" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "shift_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(14,3) NOT NULL,
    "reason" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_cash_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pos_cash_movements_company_id_shift_id_idx"
  ON "pos_cash_movements"("company_id", "shift_id");

CREATE INDEX IF NOT EXISTS "pos_cash_movements_shift_id_created_at_idx"
  ON "pos_cash_movements"("shift_id", "created_at");

ALTER TABLE "pos_cash_movements"
  ADD CONSTRAINT "pos_cash_movements_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_cash_movements"
  ADD CONSTRAINT "pos_cash_movements_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "pos_shifts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_cash_movements"
  ADD CONSTRAINT "pos_cash_movements_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
