#!/usr/bin/env npx tsx
/**
 * Backfill script: populate sweptAmountUSDC for existing SWEPT deposits
 * 
 * Run AFTER applying the migration that adds the sweptAmountUSDC column.
 * For existing SWEPT rows, sweptAmountUSDC = amountUSDC (since full amount was swept).
 * 
 * Usage: npx tsx packages/database/scripts/backfill-swept-amount.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Backfill] Starting sweptAmountUSDC backfill for SWEPT deposits...');

  // Find all SWEPT deposits where sweptAmountUSDC is null
  const sweptDeposits = await prisma.$queryRaw<Array<{ id: string; amountUSDC: number }>>`
    SELECT id, "amountUSDC"
    FROM "Deposit"
    WHERE "sweepStatus" = 'SWEPT'
      AND "sweptAmountUSDC" IS NULL
  `;

  console.log(`[Backfill] Found ${sweptDeposits.length} SWEPT deposits needing backfill`);

  if (sweptDeposits.length === 0) {
    console.log('[Backfill] Nothing to backfill. Exiting.');
    return;
  }

  // Batch update in chunks of 100
  const batchSize = 100;
  let updated = 0;

  for (let i = 0; i < sweptDeposits.length; i += batchSize) {
    const batch = sweptDeposits.slice(i, i + batchSize);
    
    const ids = batch.map(d => d.id);
    const amounts = batch.map(d => d.amountUSDC);

    // Build a CASE statement for batch update
    const caseStatements = batch.map((d, idx) => 
      `WHEN '${d.id}' THEN ${d.amountUSDC}`
    ).join(' ');

    const inClause = ids.map(id => `'${id}'`).join(', ');

    await prisma.$executeRawUnsafe(`
      UPDATE "Deposit"
      SET "sweptAmountUSDC" = CASE id ${caseStatements} END
      WHERE id IN (${inClause})
    `);

    updated += batch.length;
    console.log(`[Backfill] Updated ${updated}/${sweptDeposits.length} deposits...`);
  }

  console.log(`[Backfill] ✅ Complete! Updated ${updated} deposits.`);
}

main()
  .catch((err) => {
    console.error('[Backfill] ❌ Failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });