-- Link POS cash drawer movements to GL journals

ALTER TABLE "pos_cash_movements"
  ADD COLUMN IF NOT EXISTS "journal_id" TEXT;

CREATE INDEX IF NOT EXISTS "pos_cash_movements_journal_id_idx"
  ON "pos_cash_movements"("journal_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pos_cash_movements_journal_id_fkey'
  ) THEN
    ALTER TABLE "pos_cash_movements"
      ADD CONSTRAINT "pos_cash_movements_journal_id_fkey"
      FOREIGN KEY ("journal_id") REFERENCES "journals"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
