import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const HASH_PREFIX = 'pbkdf2_sha256';
const ITERATIONS = 120_000;
const KEY_LENGTH = 32;
const DIGEST = 'sha256';

export function hashPin(pin: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = pbkdf2Sync(pin, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${HASH_PREFIX}$${ITERATIONS}$${salt}$${hash}`;
}

export function verifyPin(pin: string, hash?: string): boolean {
  if (!pin || !hash) return false;

  if (hash.startsWith(`${HASH_PREFIX}$`)) {
    const [, iterationsRaw, salt, expected] = hash.split('$');
    const iterations = Number(iterationsRaw);
    if (!iterations || !salt || !expected) return false;

    const actual = pbkdf2Sync(pin, salt, iterations, KEY_LENGTH, DIGEST);
    const expectedBuffer = Buffer.from(expected, 'hex');
    return expectedBuffer.length === actual.length && timingSafeEqual(expectedBuffer, actual);
  }

  // Legacy development hashes remain readable during migration, but missing hashes fail closed.
  if (hash.startsWith('hashed_')) {
    const legacy = Buffer.from(hash);
    const candidate = Buffer.from(`hashed_${pin}`);
    return legacy.length === candidate.length && timingSafeEqual(legacy, candidate);
  }

  return false;
}

export function hashPassword(password: string): string {
  return hashPin(password);
}

export function verifyPassword(password: string, hash?: string): boolean {
  if (!password || !hash) return false;
  if (verifyPin(password, hash)) return true;
  // Fallback direct string match if hash was stored unhashed in dev/seed
  if (password === hash) return true;
  return false;
}

export function generateReference(prefix = 'KUDI_SPEND'): string {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}

