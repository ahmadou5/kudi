/**
 * provider-crypto - Chain-specific crypto helpers
 *
 * Pure validation and normalization helpers that run without network calls.
 * Framework-agnostic, no blockchain dependencies — usable by any chain provider.
 */

export function validateSolanaAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  return base58Regex.test(address.trim());
}

export function validateEVMAddress(address: string): boolean {
  if (!address || typeof address !== 'string') return false;
  return /^0x[0-9a-fA-F]{40}$/.test(address.trim());
}

export function validateCryptoAddress(address: string, chain: string): boolean {
  if (chain === 'solana') return validateSolanaAddress(address);
  if (chain === 'monad' || chain === 'ethereum' || chain.startsWith('evm')) {
    return validateEVMAddress(address);
  }
  return false;
}

export function normalizeDecimalAmount(amount: string | number, decimals: number): string {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 0) return '0';
  const formatted = numericAmount.toFixed(decimals);
  return formatted;
}

export function formatUSDC(amount: string | number): string {
  return normalizeDecimalAmount(amount, 6);
}