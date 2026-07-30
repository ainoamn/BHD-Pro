-- Restaurant reports filter by tenant and creation range without status.
CREATE INDEX IF NOT EXISTS "resto_orders_company_id_created_at_idx"
  ON "resto_orders"("company_id", "created_at");
