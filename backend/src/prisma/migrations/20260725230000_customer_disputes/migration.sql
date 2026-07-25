-- Customer dispute reports from public receipt links

CREATE TABLE IF NOT EXISTS "customer_disputes" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "invoice_id" TEXT NOT NULL,
  "public_code" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "reporter_phone" TEXT,
  "reporter_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_disputes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "customer_disputes_company_id_status_idx"
  ON "customer_disputes"("company_id", "status");

CREATE INDEX IF NOT EXISTS "customer_disputes_invoice_id_idx"
  ON "customer_disputes"("invoice_id");

CREATE INDEX IF NOT EXISTS "customer_disputes_public_code_idx"
  ON "customer_disputes"("public_code");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_disputes_company_id_fkey'
  ) THEN
    ALTER TABLE "customer_disputes"
      ADD CONSTRAINT "customer_disputes_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_disputes_invoice_id_fkey'
  ) THEN
    ALTER TABLE "customer_disputes"
      ADD CONSTRAINT "customer_disputes_invoice_id_fkey"
      FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
