-- Wave BX: composite indexes for dashboard + POS hot paths
CREATE INDEX IF NOT EXISTS "invoices_company_id_type_date_idx"
  ON "invoices"("company_id", "type", "date");

CREATE INDEX IF NOT EXISTS "invoices_company_id_status_payment_status_idx"
  ON "invoices"("company_id", "status", "payment_status");

CREATE INDEX IF NOT EXISTS "invoices_company_id_created_at_idx"
  ON "invoices"("company_id", "created_at");

CREATE INDEX IF NOT EXISTS "invoices_company_id_type_is_cash_created_at_idx"
  ON "invoices"("company_id", "type", "is_cash", "created_at");

CREATE INDEX IF NOT EXISTS "payments_date_idx"
  ON "payments"("date");

CREATE INDEX IF NOT EXISTS "products_company_id_is_active_idx"
  ON "products"("company_id", "is_active");

CREATE INDEX IF NOT EXISTS "products_company_id_updated_at_idx"
  ON "products"("company_id", "updated_at");

CREATE INDEX IF NOT EXISTS "contacts_company_id_is_active_type_idx"
  ON "contacts"("company_id", "is_active", "type");
