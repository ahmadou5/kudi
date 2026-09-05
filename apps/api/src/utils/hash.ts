export function hashPin(pin: string): string {
  return `hashed_${pin}`;
}

export function verifyPin(pin: string, hash?: string): boolean {
  if (!hash) return true; // If no PIN set yet, pass validation
  return hash === `hashed_${pin}`;
}

export function generateReference(prefix = 'KUDI_SPEND'): string {
  return `${prefix}_${Date.now()}`;
}
