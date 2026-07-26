-- AlterTable
ALTER TABLE "pos_shifts" ADD COLUMN IF NOT EXISTS "closing_denomination_json" JSONB;
