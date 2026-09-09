/**
 * addressValidator.ts
 *
 * Validates cryptocurrency addresses by format ONLY — no network calls.
 * This runs synchronously before any balance debit to prevent sending
 * funds to a garbage address.
 */

/**
 * Validates a Solana address (base58, 32–44 chars, valid base58 charset).
 */
export function validateSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  // Solana addresses are base58-encoded 32-byte public keys (32–44 chars)
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address.trim());
}

/**
 * Validates an EVM address (0x-prefixed, 40 hex chars = 20 bytes).
 */
export function validateEVMAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

/**
 * Validates a crypto address for the given chain slug.
 * Returns true if the address is structurally valid for that chain.
 */
export function validateCryptoAddress(address: string, chain: string): boolean {
  if (chain === 'solana') return validateSolanaAddress(address);
  if (chain === 'monad' || chain === 'ethereum' || chain.startsWith('evm')) {
    return validateEVMAddress(address);
  }
  // Unknown chain — reject to be safe
  return false;
}
