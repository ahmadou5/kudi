-- Add provider column to Transfer table
-- Tracks which provider sponsored the transfer (privy, alchemy, solana, stellar)

ALTER TABLE "Transfer" ADD COLUMN "provider" VARCHAR(255) NOT NULL DEFAULT 'privy';