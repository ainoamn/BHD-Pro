-- User invites, profile completion, and manager report subscriptions

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_token" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_expires_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invite_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_complete_profile" BOOLEAN NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_key" ON "users"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_invite_token_key" ON "users"("invite_token");
CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users"("username");

DO $$ BEGIN
  CREATE TYPE "ManagerReportFrequency" AS ENUM ('HOURLY', 'EVERY_2_HOURS', 'HALF_DAY', 'END_OF_DAY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "manager_report_subscriptions" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_by_id" TEXT,
  "frequency" "ManagerReportFrequency" NOT NULL,
  "channels_json" JSONB NOT NULL DEFAULT '{}',
  "last_sent_at" TIMESTAMP(3),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "manager_report_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "manager_report_subscriptions_company_id_user_id_is_active_idx"
  ON "manager_report_subscriptions"("company_id", "user_id", "is_active");
CREATE INDEX IF NOT EXISTS "manager_report_subscriptions_frequency_is_active_idx"
  ON "manager_report_subscriptions"("frequency", "is_active");

DO $$ BEGIN
  ALTER TABLE "manager_report_subscriptions"
    ADD CONSTRAINT "manager_report_subscriptions_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "manager_report_subscriptions"
    ADD CONSTRAINT "manager_report_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "manager_report_subscriptions"
    ADD CONSTRAINT "manager_report_subscriptions_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
