-- Dietary tags + day-part availability on menu products
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "dietary_tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "day_parts" TEXT[] DEFAULT ARRAY[]::TEXT[];
