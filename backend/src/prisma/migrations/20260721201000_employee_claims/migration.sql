-- CreateEnum
CREATE TYPE "EmployeeClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PAID', 'REJECTED');

-- CreateTable
CREATE TABLE "employee_claims" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" "EmployeeClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "total" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "reject_reason" TEXT,
    "submitted_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_claim_lines" (
    "id" TEXT NOT NULL,
    "claim_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "category" TEXT,
    "receipt_ref" TEXT,

    CONSTRAINT "employee_claim_lines_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_claims_company_id_idx" ON "employee_claims"("company_id");
CREATE INDEX "employee_claims_employee_id_idx" ON "employee_claims"("employee_id");
CREATE INDEX "employee_claims_date_idx" ON "employee_claims"("date");
CREATE INDEX "employee_claims_status_idx" ON "employee_claims"("status");
CREATE UNIQUE INDEX "employee_claims_company_id_number_key" ON "employee_claims"("company_id", "number");
CREATE INDEX "employee_claim_lines_claim_id_idx" ON "employee_claim_lines"("claim_id");

-- AddForeignKey
ALTER TABLE "employee_claims" ADD CONSTRAINT "employee_claims_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_claims" ADD CONSTRAINT "employee_claims_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_claims" ADD CONSTRAINT "employee_claims_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "employee_claim_lines" ADD CONSTRAINT "employee_claim_lines_claim_id_fkey" FOREIGN KEY ("claim_id") REFERENCES "employee_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;
