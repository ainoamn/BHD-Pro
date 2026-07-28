-- Persist last guest-notify outcome on reservations (parity with waitlist)
ALTER TABLE "resto_reservations" ADD COLUMN IF NOT EXISTS "notify_channel" TEXT;
ALTER TABLE "resto_reservations" ADD COLUMN IF NOT EXISTS "notify_result" TEXT;
ALTER TABLE "resto_reservations" ADD COLUMN IF NOT EXISTS "notify_attempts" INTEGER NOT NULL DEFAULT 0;
