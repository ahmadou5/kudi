-- Add sweptAmountUSDC column to Deposit table
-- Stores the actual on-chain amount swept (may differ from amountUSDC on partial sweeps)

ALTER TABLE "Deposit" ADD COLUMN "sweptAmountUSDC" DOUBLE PRECISION;