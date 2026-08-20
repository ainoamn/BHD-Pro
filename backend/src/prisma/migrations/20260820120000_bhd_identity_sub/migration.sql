-- BHD Identity SSO: link product users to id.bhd-om.com subject
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bhd_sub" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_bhd_sub_key" ON "users"("bhd_sub");
CREATE INDEX IF NOT EXISTS "users_bhd_sub_idx" ON "users"("bhd_sub");
