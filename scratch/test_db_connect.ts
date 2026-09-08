import { PrismaClient } from '@prisma/client';

async function test() {
  const urls = [
    "postgresql://neondb_owner:npg_cr1RACW0hUYy@ep-proud-term-axluek2g.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "postgresql://neondb_owner:npg_cr1RACW0hUYy@ep-proud-term-axluek2g-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "postgresql://neondb_owner:npg_cr1RACW0hUYy@ep-proud-term-axluek2g.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require",
    "postgresql://neondb_owner:npg_cr1RACW0hUYy@ep-proud-term-axluek2g-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require"
  ];

  for (const url of urls) {
    console.log('\n--- Testing URL:', url);
    const client = new PrismaClient({
      datasources: { db: { url } }
    });
    try {
      await client.$connect();
      console.log('SUCCESS connecting to:', url);
      const count = await client.user.count();
      console.log('User count:', count);
      await client.$disconnect();
      return;
    } catch (e: any) {
      console.error('FAILED:', e.message);
      await client.$disconnect();
    }
  }
}

test();
