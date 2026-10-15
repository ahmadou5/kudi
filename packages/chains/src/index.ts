// Backward compatibility re-exports for @kudi/chains.
// Granular provider packages (real implementations):
// - @kudi/provider-crypto: address validation, decimal normalization
// - @kudi/provider-solana: Solana SPL transfer building/sending
// - @kudi/provider-alchemy: EVM gas manager
// - @kudi/provider-privy: Privy SDK integration
// - @kudi/provider-stellar: Stellar transfer logic

export * from '@kudi/provider-crypto';
export * from '@kudi/provider-solana';
export * from '@kudi/provider-alchemy';
export * from '@kudi/provider-privy';
export * from '@kudi/provider-stellar';

// Legacy types from @kudi/types (re-exported for convenience).
// CustodyTrack is an enum (runtime value); the rest are interfaces (type-only).
export { CustodyTrack } from '@kudi/types';
export type { CustodyProvider, DepositWallet } from '@kudi/types';

// Legacy custody provider implementations (live in this package)
export { SelfCustodyProvider } from './selfCustody';
export { PartnerCustodyProvider } from './partnerCustody';
export { CustodyManager } from './custodyManager';
export type { CustodyManagerConfig } from './custodyManager';

// Chain listeners (live in this package)
export { SolanaListener } from './solanaListener';
export type { SolanaDepositEvent } from './solanaListener';
export { GeneralizedEVMListener, EVMListener } from './evmListener';
export type { EVMDepositEvent } from './evmListener';

// Chain config types (type-only: erased at build, no runtime dependency)
export type { ChainType, EVMChainConfig, SolanaChainConfig, ChainConfig } from '@kudi/types';

// Address validation from the pure helpers package (architectural home:
// @kudi/chains-core carries no RPC/runtime SDKs — see smoke-architecture check)
export { validateSolanaAddress, validateEVMAddress, validateCryptoAddress } from '@kudi/chains-core';

// Legacy sweep helpers (live in this package's selfCustody module)
export {
  USDC_FEE,
  MAX_DEPOSIT_USDC,
  SWEEP_RETRY_POLICY,
  computeSweepRetryDelay,
  UNBACKED_SWEEP_STATUSES,
  computeUnbackedExposure,
  resolveSweepAmount,
  resolveGasPaymentMode,
  isGasPaymentMode,
  type GasPaymentMode,
  DripTuning,
  getDripTuning,
  classifySweepFailure,
  GasDripReceipt,
  SWEEP_RESERVE_USDC,
  parseDepositAmount
} from './selfCustody';

// Transaction service - lives in @kudi/service-transaction
export { TransactionService } from '@kudi/service-transaction';

// Wallet service - lives in @kudi/service-wallet
export { WalletService } from '@kudi/service-wallet';

// Transfer types - live in @kudi/service-transaction
export type { TransferMetadata, PerformTransferResult, UpdateTransferResultInput, UpdateTransferResultOutput } from '@kudi/service-transaction';
