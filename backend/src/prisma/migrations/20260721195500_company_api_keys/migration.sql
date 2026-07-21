-- CreateTable
CREATE TABLE "company_api_keys" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "company_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "company_api_keys_key_hash_key" ON "company_api_keys"("key_hash");
CREATE INDEX "company_api_keys_company_id_idx" ON "company_api_keys"("company_id");
CREATE INDEX "company_api_keys_key_prefix_idx" ON "company_api_keys"("key_prefix");

-- AddForeignKey
ALTER TABLE "company_api_keys" ADD CONSTRAINT "company_api_keys_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "company_api_keys" ADD CONSTRAINT "company_api_keys_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
