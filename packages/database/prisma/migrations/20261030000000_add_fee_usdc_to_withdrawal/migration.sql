-- Record the platform fee charged on each crypto withdrawal.
-- The fee is deducted on-chain (sender -> treasury) alongside the send amount,
-- so the internal ledger debit must include it to stay consistent.

ALTER TABLE "Withdrawal" ADD COLUMN "feeUSDC" DOUBLE PRECISION NOT NULL DEFAULT 0.01;
