-- Guest vs staff reservation source + public online booking support
ALTER TABLE "resto_reservations" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'STAFF';
