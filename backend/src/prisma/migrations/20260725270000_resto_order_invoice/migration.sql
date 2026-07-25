-- Resto R4: link closed orders to POS/Accounting invoices

ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "invoice_id" TEXT;
CREATE INDEX IF NOT EXISTS "resto_orders_invoice_id_idx" ON "resto_orders"("invoice_id");
