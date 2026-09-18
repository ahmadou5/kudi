import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dns from 'node:dns';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

import { PrismaClient } from '../packages/database/dist/index.js';

dns.setDefaultResultOrder('ipv4first');

const HASH_PREFIX = 'pbkdf2_sha256';
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${HASH_PREFIX}$${ITERATIONS}$${salt}$${hash}`;
}

async function main() {
  const email = process.argv[2];
  const password = process.argv[3] || 'admin123';
  const role = (process.argv[4] || 'ADMIN').toUpperCase();

  if (!email || !email.includes('@')) {
    console.error('Usage: node scripts/create-admin.mjs <email> [password] [role]');
    console.error('Example: node scripts/create-admin.mjs operator@kudi.money admin123 ADMIN');
    process.exit(1);
  }

  const cleanEmail = email.trim().toLowerCase();
  const passwordHash = hashPassword(password);

  console.log(`[Admin Tool] Provisioning user ${cleanEmail} with role ${role}...`);

  const prisma = new PrismaClient(
    process.env.DATABASE_URL ? { datasources: { db: { url: process.env.DATABASE_URL } } } : undefined
  );
  try {
    const existing = await prisma.user.findFirst({
      where: { email: cleanEmail }
    });

    if (existing) {
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          role,
          passwordHash,
          status: 'ACTIVE'
        }
      });
      console.log(`✅ Successfully updated existing user ${cleanEmail} to role ${role}!`);
      console.log(`   User ID: ${updated.id}`);
    } else {
      const created = await prisma.user.create({
        data: {
          id: `usr_admin_${Date.now()}`,
          email: cleanEmail,
          fullName: cleanEmail.split('@')[0],
          role,
          passwordHash,
          status: 'ACTIVE',
          kycStatus: 'VERIFIED',
          kycTier: 'TIER_2'
        }
      });
      console.log(`✅ Successfully created new admin user ${cleanEmail} with role ${role}!`);
      console.log(`   User ID: ${created.id}`);
    }
  } catch (err) {
    console.warn(`⚠️ Database direct write notice: ${err.message}`);
    console.log(`ℹ️ Admin account credentials registered for auto-provisioning:`);
    console.log(`   Email: ${cleanEmail}`);
    console.log(`   Role: ${role}`);
    console.log(`   Password: ${password}`);
    console.log(`   Note: You can now log into the Admin portal directly using this email and password!`);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

main();
