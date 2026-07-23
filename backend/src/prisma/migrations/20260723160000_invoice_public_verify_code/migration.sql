-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "public_verify_code" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_public_verify_code_key" ON "invoices"("public_verify_code");
