-- POS cashier commission + customer loyalty points

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "incentives_config" JSONB;

ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "loyalty_points" DECIMAL(14,3) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "cashier_commission_ledger" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "type" TEXT NOT NULL,
  "amount" DECIMAL(14,3) NOT NULL,
  "note" TEXT,
  "created_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cashier_commission_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cashier_commission_ledger_company_id_user_id_created_at_idx"
  ON "cashier_commission_ledger"("company_id", "user_id", "created_at");

CREATE TABLE IF NOT EXISTS "loyalty_points_ledger" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "contact_id" TEXT NOT NULL,
  "invoice_id" TEXT,
  "type" TEXT NOT NULL,
  "points" DECIMAL(14,3) NOT NULL,
  "note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_points_ledger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "loyalty_points_ledger_company_id_contact_id_created_at_idx"
  ON "loyalty_points_ledger"("company_id", "contact_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cashier_commission_ledger_company_id_fkey'
  ) THEN
    ALTER TABLE "cashier_commission_ledger"
      ADD CONSTRAINT "cashier_commission_ledger_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cashier_commission_ledger_user_id_fkey'
  ) THEN
    ALTER TABLE "cashier_commission_ledger"
      ADD CONSTRAINT "cashier_commission_ledger_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cashier_commission_ledger_created_by_id_fkey'
  ) THEN
    ALTER TABLE "cashier_commission_ledger"
      ADD CONSTRAINT "cashier_commission_ledger_created_by_id_fkey"
      FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_points_ledger_company_id_fkey'
  ) THEN
    ALTER TABLE "loyalty_points_ledger"
      ADD CONSTRAINT "loyalty_points_ledger_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loyalty_points_ledger_contact_id_fkey'
  ) THEN
    ALTER TABLE "loyalty_points_ledger"
      ADD CONSTRAINT "loyalty_points_ledger_contact_id_fkey"
      FOREIGN KEY ("contact_id") REFERENCES "contacts"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
