import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

import { PrismaClient } from '../packages/database/dist/index.js';

const prisma = new PrismaClient();

async function main() {
  const docCheckVerified = await prisma.user.findMany({
    where: {
      kycStatus: 'VERIFIED',
      kycTier: 'TIER_2',
      kycMethod: { in: ['BVN', 'NIN'] }
    },
    select: { id: true, email: true, fullName: true, kycMethod: true }
  });

  let downgraded = 0;
  for (const user of docCheckVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { kycTier: 'TIER_1' }
    });
    downgraded += 1;
  }

  console.log(`[KYC Backfill] Downgraded ${downgraded} user(s) from TIER_2 -> TIER_1 (document-check verifications).`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('[KYC Backfill] Error:', err?.message || err);
  process.exit(1);
});
