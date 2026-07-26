-- Seat assignment on resto order lines (1..guests; NULL = shared)
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "seat" INTEGER;

CREATE INDEX IF NOT EXISTS "resto_order_items_order_id_seat_idx"
  ON "resto_order_items"("order_id", "seat");
