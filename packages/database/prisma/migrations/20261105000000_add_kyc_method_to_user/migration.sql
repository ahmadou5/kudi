-- Track how a user's KYC was completed so Tier 1 (document check) vs
-- Tier 2 (hosted selfie/liveness) can be distinguished for backfills.

ALTER TABLE "User" ADD COLUMN "kycMethod" TEXT;
