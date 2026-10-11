// Backward compatibility re-exports for @kudi/chains
// All logic has been moved to granular provider packages:
// - @kudi/provider-crypto: address validation, decimal normalization
// - @kudi/provider-solana: Solana SPL transfer logic
// - @kudi/provider-alchemy: EVM gas manager
// - @kudi/provider-privy: Privy SDK integration
// - @kudi/provider-stellar: Stellar transfer logic

export * from '@kudi/provider-crypto';
export * from '@kudi/provider-solana';
export * from '@kudi/provider-alchemy';
export * from '@kudi/provider-privy';
export * from '@kudi/provider-stellar';

// Legacy types from @kudi/types (re-exported for convenience)
export { CustodyProvider, CustodyTrack, DepositWallet } from '@kudi/types';

// Legacy custody provider implementations
// SelfCustodyProvider and PartnerCustodyProvider logic moved to @kudi/provider-privy
// These are re-exported for backward compatibility
export { SelfCustodyProvider } from '@kudi/provider-privy';
export { PartnerCustodyProvider } from '@kudi/provider-privy';

// Chain listeners - moved to provider packages
export { SolanaListener } from '@kudi/provider-solana';
export { EVMListener } from '@kudi/provider-alchemy';
export { parseDepositAmount } from '@kudi/provider-crypto';

// Chain config types
export { ChainType, EVMChainConfig, SolanaChainConfig, ChainConfig } from '@kudi/types';

// Address validation
export { validateSolanaAddress, validateEVMAddress, validateCryptoAddress } from '@kudi/provider-crypto';

// Legacy sweep helpers - moved to @kudi/provider-crypto
export {
  USDC_FEE,
  MAX_DEPOSIT_USDC,
  SWEEP_RETRY_POLICY,
  computeSweepRetryDelay,
  UNBACKED_SWEEP_STATUSES,
  resolveSweepAmount,
  DripTuning,
  getDripTuning,
  classifySweepFailure,
  GasDripReceipt,
  SWEEP_RESERVE_USDC,
  parseDepositAmount
} from '@kudi/provider-crypto';

// Transaction service - moved to @kudi/service-transaction
export { TransactionService } from '@kudi/service-transaction';

// Wallet service - moved to @kudi/service-wallet
export { WalletService } from '@kudi/service-wallet';

// Transfer types - moved to @kudi/service-transaction
export type { TransferMetadata, PerformTransferResult, UpdateTransferResultInput, UpdateTransferResultOutput } from '@kudi/service-transaction';