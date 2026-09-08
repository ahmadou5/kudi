const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const connectionString = "postgresql://neondb_owner:npg_cr1RACW0hUYy@ep-proud-term-axluek2g-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require";

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Testing Neon connection with pg driver...');
  const users = await prisma.user.findMany();
  console.log('✅ Connected via PG driver! User count:', users.length);
  await prisma.$disconnect();
  await pool.end();
}

main().catch(err => console.error('PG driver test error:', err));
