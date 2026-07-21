-- CreateEnum
CREATE TYPE "CustomFieldEntity" AS ENUM ('CONTACT', 'PRODUCT', 'INVOICE');
CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'SELECT');

-- CreateTable
CREATE TABLE "custom_field_definitions" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "entity_type" "CustomFieldEntity" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "label_en" TEXT,
    "field_type" "CustomFieldType" NOT NULL,
    "options_json" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_definitions_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "contacts" ADD COLUMN "custom_fields_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "products" ADD COLUMN "custom_fields_json" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "invoices" ADD COLUMN "custom_fields_json" JSONB NOT NULL DEFAULT '{}';

-- CreateIndex
CREATE INDEX "custom_field_definitions_company_id_entity_type_idx" ON "custom_field_definitions"("company_id", "entity_type");
CREATE UNIQUE INDEX "custom_field_definitions_company_id_entity_type_key_key" ON "custom_field_definitions"("company_id", "entity_type", "key");

-- AddForeignKey
ALTER TABLE "custom_field_definitions" ADD CONSTRAINT "custom_field_definitions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
