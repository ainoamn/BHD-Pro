-- CASHIER role + POS shifts + dual-control WhatsApp OTP + invoice.pos_shift_id

ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'CASHIER';

CREATE TABLE IF NOT EXISTS "pos_shifts" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "warehouse_id" TEXT,
    "opened_by_id" TEXT NOT NULL,
    "closed_by_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "opening_float" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "closing_cash" DECIMAL(14,3),
    "notes" TEXT,
    "z_report_json" JSONB,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_shifts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "pos_shifts_company_id_status_idx" ON "pos_shifts"("company_id", "status");
CREATE INDEX IF NOT EXISTS "pos_shifts_company_id_opened_at_idx" ON "pos_shifts"("company_id", "opened_at");

ALTER TABLE "pos_shifts"
  ADD CONSTRAINT "pos_shifts_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pos_shifts"
  ADD CONSTRAINT "pos_shifts_warehouse_id_fkey"
  FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_shifts"
  ADD CONSTRAINT "pos_shifts_opened_by_id_fkey"
  FOREIGN KEY ("opened_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_shifts"
  ADD CONSTRAINT "pos_shifts_closed_by_id_fkey"
  FOREIGN KEY ("closed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pos_shift_id" TEXT;

CREATE INDEX IF NOT EXISTS "invoices_pos_shift_id_idx" ON "invoices"("pos_shift_id");

DO $$ BEGIN
  ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_pos_shift_id_fkey"
    FOREIGN KEY ("pos_shift_id") REFERENCES "pos_shifts"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "dual_control_otps" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "sent_to" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dual_control_otps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "dual_control_otps_company_id_action_requested_by_id_idx"
  ON "dual_control_otps"("company_id", "action", "requested_by_id");

ALTER TABLE "dual_control_otps"
  ADD CONSTRAINT "dual_control_otps_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "dual_control_otps"
  ADD CONSTRAINT "dual_control_otps_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
