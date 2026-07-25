-- Async dual-control approval requests (online manager approve, 15 min TTL).
CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload_json" JSONB NOT NULL,
    "summary" TEXT,
    "requested_by_id" TEXT NOT NULL,
    "decided_by_id" TEXT,
    "decision_note" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "approval_requests_company_id_status_idx"
  ON "approval_requests"("company_id", "status");

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_requested_by_id_fkey"
  FOREIGN KEY ("requested_by_id") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "approval_requests"
  ADD CONSTRAINT "approval_requests_decided_by_id_fkey"
  FOREIGN KEY ("decided_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
