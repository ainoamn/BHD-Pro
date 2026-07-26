-- AlterTable
ALTER TABLE "pos_drafts" ADD COLUMN IF NOT EXISTS "held_amount" DECIMAL(14,3);
ALTER TABLE "pos_drafts" ADD COLUMN IF NOT EXISTS "held_method" TEXT;
ALTER TABLE "pos_drafts" ADD COLUMN IF NOT EXISTS "held_movement_id" TEXT;
