-- Product allergens (EU14 codes) + void actor audit on resto lines
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "voided_by_id" TEXT;
