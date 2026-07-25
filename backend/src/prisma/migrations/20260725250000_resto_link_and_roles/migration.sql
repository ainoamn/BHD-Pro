-- Hisaby Restaurants: company link fields + F&B staff roles

ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "resto_linked_at" TIMESTAMP(3);
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "resto_integration_key_hash" TEXT;
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "resto_integration_key_prefix" TEXT;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'WAITER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'KITCHEN';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "UserRole" ADD VALUE 'RESTO_MANAGER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
