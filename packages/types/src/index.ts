/**
 * Kudi Core Domain & Abstraction Types
 */

// ==========================================
// 1. Custody Abstraction Types
// ==========================================

export enum CustodyTrack {
  TRACK_A_SELF_CUSTODY = 'TRACK_A_SELF_CUSTODY', // Privy / KMS self-managed keys (Hackathon Scope)
  TRACK_B_PARTNER = 'TRACK_B_PARTNER'            // Busha / Quidax VASP partner issued (Production)
}

export interface DepositWallet {
  address: string;
  chain: string; // 'solana' | 'monad-testnet' | EVM chain slug
  derivationPath?: string;
  publicKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CustodyProvider {
  track: CustodyTrack;
  name: string;
  generateWallet(userId: string, chain: string): Promise<DepositWallet>;
  getWalletBalance(address: string, chain: string, tokenAddress?: string): Promise<string>;
  verifyDepositTransaction(txHash: string, chain: string): Promise<{
    confirmed: boolean;
    amount: string;
    sender: string;
    tokenAddress: string;
    blockNumber?: number;
  }>;
}

// ==========================================
// 2. Payment Provider (Payout Rail) Abstraction Types
// ==========================================

export enum PaymentProviderId {
  PAYSTACK = 'paystack',
  MONNIFY = 'monnify',
  SQUAD = 'squad'
}

export interface BankAccountResolution {
  accountNumber: string;
  bankCode: string;
  accountName: string;
  provider: PaymentProviderId;
}

export interface TransferRequest {
  reference: string;
  amountNGN: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  narration?: string;
}

export interface TransferResponse {
  reference: string;
  transferCode?: string;
  status: 'pending' | 'success' | 'failed';
  provider: PaymentProviderId;
  providerReference?: string;
  message?: string;
}

export interface PaymentProvider {
  id: PaymentProviderId;
  name: string;
  resolveAccount(accountNumber: string, bankCode: string): Promise<BankAccountResolution>;
  initiateTransfer(request: TransferRequest): Promise<TransferResponse>;
  checkTransferStatus(reference: string): Promise<TransferResponse>;
  listSupportedBanks(): Promise<Array<{ code: string; name: string }>>;
}

// ==========================================
// 3. Chain & Network Config Types
// ==========================================

export enum ChainType {
  SOLANA = 'solana',
  EVM = 'evm'
}

export interface EVMChainConfig {
  id: string;
  name: string;
  chainId: number;
  type: ChainType.EVM;
  rpcUrl: string;
  tokenContractAddress: string; // USDC/AUSD contract address
  tokenSymbol: string;
  tokenDecimals: number;
  confirmationThreshold: number;
  enabled: boolean;
}

export interface SolanaChainConfig {
  id: string;
  name: string;
  type: ChainType.SOLANA;
  rpcUrl: string;
  usdcMintAddress: string;
  confirmationThreshold: number;
  enabled: boolean;
}

export type ChainConfig = EVMChainConfig | SolanaChainConfig;

// ==========================================
// 4. Ledger & Transaction Types
// ==========================================

export enum LedgerEntryType {
  DEPOSIT_CREDIT = 'DEPOSIT_CREDIT',
  SPEND_DEBIT = 'SPEND_DEBIT',
  SPEND_REVERSAL = 'SPEND_REVERSAL',
  FEE_DEBIT = 'FEE_DEBIT'
}

export interface LedgerEntry {
  id: string;
  userId: string;
  type: LedgerEntryType;
  amountUSDC: string; // Stored in USDC float model
  resultingBalanceUSDC: string;
  referenceId: string; // Tx hash or spend reference
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export enum SpendStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  REVERSED = 'REVERSED'
}

export interface SpendTransaction {
  id: string;
  userId: string;
  reference: string;
  amountUSDC: string;
  exchangeRateNGN: number;
  amountNGN: number;
  feeNGN: number;
  recipientBankCode: string;
  recipientAccountNumber: string;
  recipientAccountName: string;
  payoutProvider: PaymentProviderId;
  status: SpendStatus;
  createdAt: string;
  updatedAt: string;
}

// ==========================================
// 5. Rate Engine Types
// ==========================================

export interface RateSourceData {
  source: 'binance_p2p' | 'bybit_p2p';
  bidRate: number;
  askRate: number;
  timestamp: number;
}

export interface RateEngineState {
  currentRateNGN: number;       // Adjusted live rate (crypto -> NGN)
  rawP2PRateNGN: number;        // Raw average from Binance/Bybit
  spreadPercentage: number;     // e.g. 1.5% buffer
  sources: RateSourceData[];
  lastUpdated: string;
  isStale: boolean;
  manualOverrideRate?: number;
}

// ==========================================
// 6. User & KYC Types
// ==========================================

export enum KYCTier {
  UNVERIFIED = 'UNVERIFIED',
  TIER_1 = 'TIER_1', // BVN/NIN verified
  TIER_2 = 'TIER_2'  // Full selfie + liveness
}

export enum KYCStatus {
  NOT_STARTED = 'NOT_STARTED',
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

export interface UserProfile {
  id: string;
  phoneNumber: string;
  email: string;
  kycTier: KYCTier;
  kycStatus: KYCStatus;
  hasPin: boolean;
  createdAt: string;
}
