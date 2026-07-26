-- KDS rush / hold flags on order lines
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "is_rush" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "held_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "resto_order_items_is_rush_held_at_idx"
  ON "resto_order_items"("is_rush", "held_at");
