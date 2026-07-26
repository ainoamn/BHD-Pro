-- Guest notify audit on waitlist + reservation confirm tokens
ALTER TABLE "resto_waitlist" ADD COLUMN IF NOT EXISTS "notify_channel" TEXT;
ALTER TABLE "resto_waitlist" ADD COLUMN IF NOT EXISTS "notify_result" TEXT;
ALTER TABLE "resto_waitlist" ADD COLUMN IF NOT EXISTS "notify_attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "resto_reservations" ADD COLUMN IF NOT EXISTS "confirm_token" TEXT;
ALTER TABLE "resto_reservations" ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP(3);
ALTER TABLE "resto_reservations" ADD COLUMN IF NOT EXISTS "reminder_sent_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "resto_reservations_confirm_token_key"
  ON "resto_reservations"("confirm_token");
