-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "from_currency" TEXT NOT NULL,
    "to_currency" TEXT NOT NULL,
    "rate" DECIMAL(65,30) NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exchange_rates_company_id_idx" ON "exchange_rates"("company_id");
CREATE INDEX "exchange_rates_date_idx" ON "exchange_rates"("date");
CREATE UNIQUE INDEX "exchange_rates_company_id_from_currency_to_currency_date_key" ON "exchange_rates"("company_id", "from_currency", "to_currency", "date");

-- AddForeignKey
ALTER TABLE "exchange_rates" ADD CONSTRAINT "exchange_rates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
