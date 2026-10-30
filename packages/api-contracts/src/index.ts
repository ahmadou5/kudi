import { z } from 'zod';
import { PaymentProviderId } from '@kudi/types';

export const apiRoutes = {
  health: '/api/v1/health',
  healthConfig: '/api/v1/health/config',
  auth: {
    login: '/api/v1/auth/login',
    privyAuthenticate: '/api/v1/auth/privy-authenticate',
    privySendOtp: '/api/v1/auth/privy-send-otp',
    privyVerifyOtp: '/api/v1/auth/privy-verify-otp',
    refresh: '/api/v1/auth/refresh',
    verifyPin: '/api/v1/auth/pin/verify',
    pushToken: '/api/v1/auth/push-token',
    testNotification: '/api/v1/auth/test-notification'
  },
  users: {
    register: '/api/v1/users/register',
    setPin: '/api/v1/users/set-pin',
    byId: (userId = ':userId') => `/api/v1/users/${userId}`,
    profile: (userId = ':userId') => `/api/v1/users/${userId}/profile`,
    balance: (userId = ':userId') => `/api/v1/users/${userId}/balance`,
    transactions: (userId = ':userId') => `/api/v1/users/${userId}/transactions`,
    virtualAccounts: (userId = ':userId') => `/api/v1/users/${userId}/virtual-accounts`,
    notifications: (userId = ':userId') => `/api/v1/users/${userId}/notifications`,
    markNotificationsRead: (userId = ':userId') => `/api/v1/users/${userId}/notifications/read-all`,
    markNotificationRead: (userId = ':userId', notificationId = ':notificationId') => `/api/v1/users/${userId}/notifications/${notificationId}/read`,
    deleteAccount: (userId = ':userId') => `/api/v1/users/${userId}`,
    pushToken: '/api/v1/users/push-token'
  },
  kyc: {
    verifyId: '/api/v1/kyc/verify-id'
  },
  payout: {
    resolveAccount: '/api/v1/payout/resolve-account',
    banks: '/api/v1/payout/banks',
    spend: '/api/v1/payout/spend',
    spendUser: '/api/v1/payout/spend-user',
    spendOnChain: '/api/v1/payout/spend-onchain',
    sponsorOnChainTransfer: '/api/v1/payout/sponsor-onchain-transfer',
    cashout: '/api/v1/payout/cashout',
    cryptoStatus: (reference = ':reference') => `/api/v1/payout/crypto-status/${reference}`,
    receipt: (reference = ':reference') => `/api/v1/payout/receipt/${reference}`
  },
  rates: {
    current: '/api/v1/rates/current',
    fx: '/api/v1/rates/fx'
  },
  admin: {
    users: '/api/v1/admin/users',
    userRole: (userId = ':userId') => `/api/v1/admin/users/${userId}/role`,
    rateOverride: '/api/v1/admin/rate-override',
    config: '/api/v1/admin/config',
    maintenance: '/api/v1/admin/config/maintenance',
    setActiveProvider: '/api/v1/admin/set-active-provider',
    exportReconciliationCsv: '/api/v1/admin/reconciliation/export-csv'
  },
  bills: {
    pay: '/api/v1/bills/pay'
  },
  referral: {
    overview: '/api/v1/referral/overview'
  }
} as const;

export const apiResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
  error: z.unknown().optional()
}).passthrough();

export type ApiResponse<T = any> = Omit<z.infer<typeof apiResponseSchema>, 'data' | 'error'> & {
  data?: T;
  error?: any;
};

// ==========================================
// Transfer Types (pila pattern - moved from SDK to api-contracts)
// ==========================================

export const transferMetadataSchema = z.object({
  signingProvider: z.string().default('privy'),
  walletId: z.string(),
  asset: z.string(),
  toAddress: z.string(),
  chain: z.string(),
  duration: z.number().optional(),
  type: z.string().optional(),
  fee: z.string().optional()
});

export type TransferMetadata = z.infer<typeof transferMetadataSchema>;

export const performTransferResultSchema = z.object({
  success: z.boolean(),
  txHash: z.string().optional(),
  status: z.enum(['completed', 'failed']),
  duration: z.number(),
  metadata: transferMetadataSchema
});

export type PerformTransferResult = z.infer<typeof performTransferResultSchema>;

export const updateTransferResultInputSchema = z.object({
  txID: z.string(),
  status: z.enum(['completed', 'failed']),
  txHash: z.string().optional(),
  createdAt: z.date().optional(),
  failureReason: z.string().optional()
});

export type UpdateTransferResultInput = z.infer<typeof updateTransferResultInputSchema>;

export const updateTransferResultOutputSchema = z.object({
  success: z.boolean(),
  metadata: transferMetadataSchema,
  duration: z.number()
});

export type UpdateTransferResultOutput = z.infer<typeof updateTransferResultOutputSchema>;

// ==========================================
// Crypto Address Validation Schemas
// ==========================================

export const evmAddressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Invalid EVM address');
export type EvmAddress = z.infer<typeof evmAddressSchema>;

export const solanaAddressSchema = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, 'Invalid Solana address');
export type SolanaAddress = z.infer<typeof solanaAddressSchema>;

// ==========================================
// API Response Data Interfaces
// ==========================================

export interface AuthResponseData {
  user: {
    id: string;
    privyUserId?: string;
    email?: string;
    phoneNumber?: string;
    fullName?: string;
    username?: string;
    avatarUrl?: string;
    kycTier?: string;
    kycStatus?: string;
    hasPin?: boolean;
    wallets?: Array<{ chain: string; address: string }>;
  };
  wallets?: Array<{ chain: string; address: string }>;
  accessToken: string;
  refreshToken?: string;
}

export interface BalanceResponseData {
  balanceUSDC: string;
  currentRateNGN: number;
  wallets?: Array<{ chain: string; address: string }>;
}

export interface TransactionsResponseData {
  transactions: any[];
}

export interface VirtualAccountsResponseData {
  accounts: any[];
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, any>;
}

export interface NotificationsResponseData {
  data: NotificationItem[];
  unreadCount: number;
}

export interface ResolveAccountRequest {
  accountNumber: string;
  bankCode: string;
}

export interface ResolveAccountResponseData {
  accountName: string;
  accountNumber: string;
  bankCode: string;
}

export interface SendCryptoResponseData {
  reference: string;
  status: string;
  chain: string;
  toAddress: string;
  amountUSDC: number;
  feeUSDC?: number;
  totalDebitUSDC?: string;
  newBalanceUSDC: string;
}

export interface CashoutResponseData {
  reference: string;
  status: string;
  cashOutTxHash?: string;
  payoutTxId?: string;
  newBalanceUSDC: string;
  amountUSDC: number;
}

export interface CryptoStatusResponseData {
  reference: string;
  status: string;
  txHash?: string;
}

// ==========================================
// Import/Export Types
// ==========================================

export type AuthenticatePrivyRequest = {
  privyToken?: string;
  privyUserId: string;
  email?: string;
  phoneNumber?: string;
  name?: string;
  referralCode?: string;
};

export type SendPrivyOtpRequest = {
  email: string;
};

export type VerifyPrivyOtpRequest = {
  email: string;
  code: string;
  referralCode?: string;
};

export type RefreshTokenRequest = {
  refreshToken: string;
};

export type RegisterUserRequest = {
  phoneNumber?: string;
  email?: string;
  referralCode?: string;
};

export type UpdateUserProfileRequest = {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  dob?: string;
  avatarUrl?: string;
  profileCompleted?: boolean;
};

export type SetPinRequest = {
  userId: string;
  pin: string;
};

export type VerifyPinRequest = SetPinRequest;

export type VerifyKycIdRequest = {
  userId: string;
  idNumber: string;
  idType: 'BVN' | 'NIN';
  firstName: string;
  lastName: string;
  dob: string;
  accountNumber?: string;
  bankCode?: string;
  address?: string;
  /** NIBSS Consent Hub retrieval token proving customer consent for the BVN lookup */
  retrievalToken?: string;
};

export type SpendToBankRequest = {
  userId: string;
  pin?: string;
  amountUSDC: number;
  bankCode: string;
  accountNumber: string;
  accountName?: string;
  narration?: string;
};

export type SpendToUserRequest = {
  fromUserId: string;
  toHandle: string;
  amountUSDC: number;
  pin?: string;
};

export type SpendOnChainRequest = {
  userId: string;
  pin?: string;
  amountUSDC: number;
  toAddress: string;
  chain: 'solana' | 'monad';
  feeUSDC?: number;
};

export type CashoutRequest = {
  userId: string;
  pin?: string;
  amountUSDC: number;
  walletAddress: string;
  type: 'CRYPTO' | 'NGN_PAYOUT';
  bankCode?: string;
  accountNumber?: string;
  accountName?: string;
  payoutProvider?: 'monnify' | 'squad' | 'bachs';
};

export type OverrideRateRequest = {
  newRateNGN: number;
};

export type PayBillRequest = {
  userId: string;
  billType: 'AIRTIME' | 'ELECTRICITY' | 'DATA';
  billerName: string;
  recipientIdentifier: string;
  amountNGN: number;
};

export type SetActivePaymentProviderRequest = {
  providerId: PaymentProviderId;
};

export type MaintenanceConfig = {
  enabled: boolean;
  message?: string;
  estimatedMinutes?: number | null;
  updatedAt?: string;
};

export type SetMaintenanceConfigRequest = {
  enabled: boolean;
  message?: string;
  estimatedMinutes?: number | null;
};

// ==========================================
// Referral Types
// ==========================================

export interface ReferralInvitedUser {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
  joinedAt: string;
}

export interface ReferralOverviewData {
  code: string;
  invitedCount: number;
  invited: ReferralInvitedUser[];
}

