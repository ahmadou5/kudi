export interface PerformTransferJob {
  userID: string;
  walletID: string;
  asset: string;
  toAddress: string;
  amount: number;
  chain: 'solana' | 'monad' | 'stellar';
  signingProvider?: string;
}

export interface TransferMetadata {
  signingProvider: string;
  walletID: string;
  asset: string;
  toAddress: string;
  chain: string;
  duration: number;
  type?: string;
  fee?: number;
  txHash?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerformTransferResult {
  success: boolean;
  txHash?: string;
  status: 'completed' | 'failed';
  duration: number;
  metadata: TransferMetadata;
}