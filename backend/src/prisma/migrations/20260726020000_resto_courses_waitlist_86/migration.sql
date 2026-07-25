-- Courses on order items + waitlist + 86 board
ALTER TABLE "resto_order_items" ADD COLUMN IF NOT EXISTS "course" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS "resto_order_items_order_id_course_status_idx"
  ON "resto_order_items"("order_id", "course", "status");

CREATE TYPE "RestoWaitlistStatus" AS ENUM ('WAITING', 'NOTIFIED', 'SEATED', 'CANCELLED', 'NO_SHOW');

CREATE TABLE IF NOT EXISTS "resto_waitlist" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "guest_name" TEXT NOT NULL,
    "phone" TEXT,
    "guests" INTEGER NOT NULL DEFAULT 2,
    "quoted_minutes" INTEGER,
    "status" "RestoWaitlistStatus" NOT NULL DEFAULT 'WAITING',
    "notes" TEXT,
    "table_id" TEXT,
    "seated_order_id" TEXT,
    "notified_at" TIMESTAMP(3),
    "seated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resto_waitlist_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "resto_waitlist_company_id_status_created_at_idx"
  ON "resto_waitlist"("company_id", "status", "created_at");

DO $$ BEGIN
  ALTER TABLE "resto_waitlist" ADD CONSTRAINT "resto_waitlist_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "resto_menu_86" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resto_menu_86_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resto_menu_86_company_id_product_id_key"
  ON "resto_menu_86"("company_id", "product_id");

CREATE INDEX IF NOT EXISTS "resto_menu_86_company_id_idx" ON "resto_menu_86"("company_id");

DO $$ BEGIN
  ALTER TABLE "resto_menu_86" ADD CONSTRAINT "resto_menu_86_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
