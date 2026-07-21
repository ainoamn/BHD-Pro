-- AlterTable
ALTER TABLE "invoices" ADD COLUMN "is_cash" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "invoices_is_cash_idx" ON "invoices"("is_cash");
