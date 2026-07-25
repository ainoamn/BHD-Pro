-- Dual-control / maker-checker company settings (JSONB).
-- Phase 2 (not in this MVP): ApprovalRequest model for async online approvals; WhatsApp OTP / NFC methods.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "security_config" JSONB;
