-- AlterTable
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sold_by_weight" BOOLEAN NOT NULL DEFAULT false;
