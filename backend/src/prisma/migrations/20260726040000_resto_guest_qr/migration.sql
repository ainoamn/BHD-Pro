-- Guest QR ordering tokens + call-waiter on tables
ALTER TABLE "resto_tables" ADD COLUMN IF NOT EXISTS "guest_token" TEXT;
ALTER TABLE "resto_tables" ADD COLUMN IF NOT EXISTS "guest_call_at" TIMESTAMP(3);
ALTER TABLE "resto_tables" ADD COLUMN IF NOT EXISTS "guest_call_type" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "resto_tables_guest_token_key" ON "resto_tables"("guest_token");
