-- Delivery dispatch fields + support for resto split tender (no schema for payments — uses POS)
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "delivery_status" TEXT;
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "driver_name" TEXT;
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "driver_phone" TEXT;
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMP(3);
