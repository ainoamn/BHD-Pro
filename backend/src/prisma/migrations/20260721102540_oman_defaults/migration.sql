/*
  Warnings:

  - You are about to drop the column `fta_config` on the `companies` table. All the data in the column will be lost.
  - You are about to drop the column `zatca_config` on the `companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "companies" DROP COLUMN "fta_config",
DROP COLUMN "zatca_config",
ADD COLUMN     "ota_config" JSONB,
ADD COLUMN     "tax_config" JSONB,
ALTER COLUMN "country" SET DEFAULT 'OM',
ALTER COLUMN "timezone" SET DEFAULT 'Asia/Muscat',
ALTER COLUMN "currency" SET DEFAULT 'OMR';

-- AlterTable
ALTER TABLE "contacts" ALTER COLUMN "country" SET DEFAULT 'OM';

-- AlterTable
ALTER TABLE "invoice_items" ALTER COLUMN "tax_rate" SET DEFAULT 5;

-- AlterTable
ALTER TABLE "invoices" ALTER COLUMN "tax_rate" SET DEFAULT 5;
