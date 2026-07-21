-- CreateEnum
CREATE TYPE "DocumentTemplateType" AS ENUM ('INVOICE', 'QUOTATION', 'CREDIT_NOTE', 'DELIVERY_NOTE', 'RECEIPT');

-- CreateTable
CREATE TABLE "document_templates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "DocumentTemplateType" NOT NULL,
    "name" TEXT NOT NULL,
    "header_text" TEXT,
    "footer_text" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_templates_company_id_idx" ON "document_templates"("company_id");
CREATE INDEX "document_templates_company_id_type_idx" ON "document_templates"("company_id", "type");

-- AddForeignKey
ALTER TABLE "document_templates" ADD CONSTRAINT "document_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
