-- Accounting Wave A–D: payroll/claims GL, payment bank link, commitments, attachments, management alerts

-- PayrollRun
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "payment_method" "PaymentMethod";
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "bank_account_id" TEXT;
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "gl_accrual_journal_id" TEXT;
ALTER TABLE "payroll_runs" ADD COLUMN IF NOT EXISTS "gl_payment_journal_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_gl_accrual_journal_id_key" ON "payroll_runs"("gl_accrual_journal_id");
CREATE UNIQUE INDEX IF NOT EXISTS "payroll_runs_gl_payment_journal_id_key" ON "payroll_runs"("gl_payment_journal_id");

DO $$ BEGIN
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_bank_account_id_fkey"
    FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_gl_accrual_journal_id_fkey"
    FOREIGN KEY ("gl_accrual_journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_runs" ADD CONSTRAINT "payroll_runs_gl_payment_journal_id_fkey"
    FOREIGN KEY ("gl_payment_journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Drop old single gl_journal_id if present from partial migration
ALTER TABLE "payroll_runs" DROP CONSTRAINT IF EXISTS "payroll_runs_gl_journal_id_fkey";
DROP INDEX IF EXISTS "payroll_runs_gl_journal_id_key";
ALTER TABLE "payroll_runs" DROP COLUMN IF EXISTS "gl_journal_id";

-- EmployeeClaim
ALTER TABLE "employee_claims" ADD COLUMN IF NOT EXISTS "payment_method" "PaymentMethod";
ALTER TABLE "employee_claims" ADD COLUMN IF NOT EXISTS "bank_account_id" TEXT;
ALTER TABLE "employee_claims" ADD COLUMN IF NOT EXISTS "gl_accrual_journal_id" TEXT;
ALTER TABLE "employee_claims" ADD COLUMN IF NOT EXISTS "gl_payment_journal_id" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "employee_claims_gl_accrual_journal_id_key" ON "employee_claims"("gl_accrual_journal_id");
CREATE UNIQUE INDEX IF NOT EXISTS "employee_claims_gl_payment_journal_id_key" ON "employee_claims"("gl_payment_journal_id");

DO $$ BEGIN
  ALTER TABLE "employee_claims" ADD CONSTRAINT "employee_claims_bank_account_id_fkey"
    FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_claims" ADD CONSTRAINT "employee_claims_gl_accrual_journal_id_fkey"
    FOREIGN KEY ("gl_accrual_journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "employee_claims" ADD CONSTRAINT "employee_claims_gl_payment_journal_id_fkey"
    FOREIGN KEY ("gl_payment_journal_id") REFERENCES "journals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "employee_claims" DROP CONSTRAINT IF EXISTS "employee_claims_gl_journal_id_fkey";
DROP INDEX IF EXISTS "employee_claims_gl_journal_id_key";
ALTER TABLE "employee_claims" DROP COLUMN IF EXISTS "gl_journal_id";

-- Payment → bank account
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "bank_account_id" TEXT;
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_bank_account_id_fkey"
    FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "payments_bank_account_id_idx" ON "payments"("bank_account_id");

-- Unique payment reference per company (via invoice.company)
CREATE UNIQUE INDEX IF NOT EXISTS "payments_invoice_reference_unique"
  ON "payments"("invoice_id", "reference")
  WHERE "reference" IS NOT NULL AND "reference" <> '';

-- Recurring commitments
CREATE TABLE IF NOT EXISTS "recurring_commitments" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'OTHER',
  "amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'OMR',
  "frequency" TEXT NOT NULL DEFAULT 'MONTHLY',
  "next_run_at" TIMESTAMP(3) NOT NULL,
  "day_of_month" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "paused_until" TIMESTAMP(3),
  "expense_account_id" TEXT,
  "payable_account_id" TEXT,
  "bank_account_id" TEXT,
  "contact_id" TEXT,
  "notes" TEXT,
  "last_run_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "recurring_commitments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "recurring_commitments_company_id_idx" ON "recurring_commitments"("company_id");
CREATE INDEX IF NOT EXISTS "recurring_commitments_next_run_at_idx" ON "recurring_commitments"("next_run_at");
CREATE INDEX IF NOT EXISTS "recurring_commitments_status_idx" ON "recurring_commitments"("status");

DO $$ BEGIN
  ALTER TABLE "recurring_commitments" ADD CONSTRAINT "recurring_commitments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "recurring_commitments" ADD CONSTRAINT "recurring_commitments_bank_account_id_fkey"
    FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Attachments
CREATE TABLE IF NOT EXISTS "attachments" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT,
  "size_bytes" INTEGER NOT NULL DEFAULT 0,
  "storage_key" TEXT NOT NULL,
  "uploaded_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "attachments_company_entity_idx" ON "attachments"("company_id", "entity_type", "entity_id");

DO $$ BEGIN
  ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Management alerts (fraud / duplicate)
CREATE TABLE IF NOT EXISTS "management_alerts" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "payload_json" JSONB NOT NULL DEFAULT '{}',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolved_at" TIMESTAMP(3),
  "resolved_by_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "management_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "management_alerts_company_status_idx" ON "management_alerts"("company_id", "status");

DO $$ BEGIN
  ALTER TABLE "management_alerts" ADD CONSTRAINT "management_alerts_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
