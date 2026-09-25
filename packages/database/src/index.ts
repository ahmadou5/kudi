import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

function getDatabaseUrl(): string | undefined {
  const current = process.env.DATABASE_URL;
  if (current && !current.includes('host:5432') && current !== 'postgresql://user:pass@host:5432/dbname') {
    return current;
  }
  try {
    const candidates = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), '../../.env'),
      path.resolve(process.cwd(), '../../../.env'),
      '/home/ahmadou/metropolis/.env'
    ];
    for (const envPath of candidates) {
      if (fs.existsSync(envPath)) {
        const lines = fs.readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
          const match = line.match(/^DATABASE_URL=["']?(.*?)["']?$/);
          if (match && match[1] && !match[1].includes('host:5432')) {
            process.env.DATABASE_URL = match[1];
            return match[1];
          }
        }
      }
    }
  } catch {}
  return current;
}

const resolvedUrl = getDatabaseUrl();

export * from '@prisma/client';

export * from './drips';

export const prisma = new PrismaClient(
  resolvedUrl ? { datasources: { db: { url: resolvedUrl } } } : undefined
);

