-- Optional notes on parked POS carts
ALTER TABLE "pos_drafts" ADD COLUMN IF NOT EXISTS "notes" TEXT;
