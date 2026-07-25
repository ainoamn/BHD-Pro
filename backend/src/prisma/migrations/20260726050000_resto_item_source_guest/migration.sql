-- Track guest vs staff order lines (guest QR auto-fires to KDS)
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'STAFF';
