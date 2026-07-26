-- Optional per day-part sale price overrides (JSON map)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "day_part_prices" JSONB NOT NULL DEFAULT '{}';
