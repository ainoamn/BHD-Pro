-- Convert plan columns from enum to text so custom plan codes can be stored.
ALTER TABLE "companies" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "companies" ALTER COLUMN "plan" TYPE TEXT USING ("plan"::text);
ALTER TABLE "companies" ALTER COLUMN "plan" SET DEFAULT 'STARTER';

ALTER TABLE "plan_offers" ALTER COLUMN "plan" TYPE TEXT USING ("plan"::text);

CREATE TABLE IF NOT EXISTS "plan_definitions" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_ar" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "monthly_price" DECIMAL(12,3) NOT NULL,
    "yearly_price" DECIMAL(12,3) NOT NULL,
    "invoices_limit" INTEGER NOT NULL,
    "users_limit" INTEGER NOT NULL,
    "support" TEXT NOT NULL DEFAULT 'email',
    "features" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_definitions_code_key" ON "plan_definitions"("code");
CREATE INDEX IF NOT EXISTS "plan_definitions_is_active_idx" ON "plan_definitions"("is_active");
CREATE INDEX IF NOT EXISTS "plan_definitions_sort_order_idx" ON "plan_definitions"("sort_order");
