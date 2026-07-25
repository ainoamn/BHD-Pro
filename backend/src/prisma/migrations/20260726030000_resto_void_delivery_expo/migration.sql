-- Delivery guest fields, void/comp on items
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "guest_name" TEXT;
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "guest_phone" TEXT;
ALTER TABLE "resto_orders" ADD COLUMN IF NOT EXISTS "delivery_address" TEXT;

ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "is_comp" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "void_reason" TEXT;
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMP(3);
