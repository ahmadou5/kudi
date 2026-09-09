import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

// Sanitize DATABASE_URL for Prisma SQLite provider
if (!process.env.DATABASE_URL || (!process.env.DATABASE_URL.startsWith('file:') && !process.env.DATABASE_URL.startsWith('postgresql:') && !process.env.DATABASE_URL.startsWith('postgres:'))) {
  const dbPath = process.env.DATABASE_URL || './dev.db';
  process.env.DATABASE_URL = `file:${dbPath}`;
}

export const prisma = new PrismaClient();
