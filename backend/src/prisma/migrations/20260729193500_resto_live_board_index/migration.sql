-- Live restaurant board: closed orders for the current business day.
CREATE INDEX IF NOT EXISTS "resto_orders_company_id_status_closed_at_idx"
  ON "resto_orders"("company_id", "status", "closed_at");
