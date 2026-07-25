-- Restaurant ops config JSON (day-part hour schedules, etc.)
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "resto_config" JSONB;
