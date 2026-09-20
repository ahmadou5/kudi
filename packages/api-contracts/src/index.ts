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
    cryptoStatus: (reference = ':reference') => `/api/v1/payout/crypto-status/${reference}`,
    receipt: (reference = ':reference') => `/api/v1/payout/receipt/${reference}`
  },
  rates: {
    current: '/api/v1/rates/current'
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
  }
} as const;

export const apiResponseSchema = z.object({
  success: z.boolean().optional(),
  message: z.string().optional(),
  data: z.unknown().optional(),
  error: z.unknown().optional()
}).passthrough();

export type ApiResponse<T = unknown> = Omit<z.infer<typeof apiResponseSchema>, 'data'> & { data?: T };

export const authenticatePrivyRequestSchema = z.object({
  privyToken: z.string().optional(),
  privyUserId: z.string().optional(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  name: z.string().optional()
}).refine((value) => Boolean(value.privyUserId || value.email || value.phoneNumber), {
  message: 'privyUserId, email, or phoneNumber is required'
});

export const loginRequestSchema = z.object({
  email: z.string().email().optional(),
  identifier: z.string().optional(),
  password: z.string().min(1)
}).refine((val) => Boolean(val.email || val.identifier), {
  message: 'Email or identifier is required'
});

export const updateUserRoleRequestSchema = z.object({
  role: z.enum(['ADMIN', 'OPERATOR', 'USER'])
});

export const sendPrivyOtpRequestSchema = z.object({ email: z.string().email() });
export const verifyPrivyOtpRequestSchema = z.object({ email: z.string().email(), code: z.string().min(4) });
export const refreshTokenRequestSchema = z.object({ refreshToken: z.string().min(1) });
export const registerUserRequestSchema = z.object({ phoneNumber: z.string().optional(), email: z.string().email().optional() });
export const updateUserProfileRequestSchema = z.object({ fullName: z.string().optional(), username: z.string().optional(), avatarUrl: z.string().url().optional() });
export const setPinRequestSchema = z.object({ userId: z.string().min(1), pin: z.string().min(4) });
export const verifyPinRequestSchema = setPinRequestSchema;
export const verifyKycIdRequestSchema = z.object({
  userId: z.string().min(1),
  idNumber: z.string().min(1),
  idType: z.enum(['BVN', 'NIN']),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().min(1)
});
export const resolveAccountRequestSchema = z.object({ accountNumber: z.string().min(1), bankCode: z.string().min(1) });
export const spendToBankRequestSchema = z.object({
  userId: z.string().min(1),
  pin: z.string().optional(),
  amountUSDC: z.number().positive(),
  bankCode: z.string().min(1),
  accountNumber: z.string().min(1),
  accountName: z.string().min(1),
  narration: z.string().optional()
});
export const spendToUserRequestSchema = z.object({ fromUserId: z.string().min(1), toHandle: z.string().min(1), amountUSDC: z.number().positive(), pin: z.string().optional() });
export const spendOnChainRequestSchema = z.object({ userId: z.string().min(1), pin: z.string().optional(), amountUSDC: z.number().positive(), toAddress: z.string().min(1), chain: z.enum(['solana', 'monad']) });
export const overrideRateRequestSchema = z.object({ newRateNGN: z.number().positive() });
export const payBillRequestSchema = z.object({ userId: z.string().min(1), billType: z.enum(['AIRTIME', 'ELECTRICITY', 'DATA']), billerName: z.string().min(1), recipientIdentifier: z.string().min(1), amountNGN: z.number().positive() });
export const setActivePaymentProviderRequestSchema = z.object({ providerId: z.nativeEnum(PaymentProviderId) });
export const maintenanceConfigSchema = z.object({
  enabled: z.boolean(),
  message: z.string().default(''),
  estimatedMinutes: z.number().nullable().optional(),
  updatedAt: z.string().optional()
});
export const setMaintenanceConfigRequestSchema = z.object({
  enabled: z.boolean(),
  message: z.string().optional(),
  estimatedMinutes: z.number().nullable().optional()
});

export type AuthenticatePrivyRequest = z.infer<typeof authenticatePrivyRequestSchema>;
export type SendPrivyOtpRequest = z.infer<typeof sendPrivyOtpRequestSchema>;
export type VerifyPrivyOtpRequest = z.infer<typeof verifyPrivyOtpRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof refreshTokenRequestSchema>;
export type RegisterUserRequest = z.infer<typeof registerUserRequestSchema>;
export type UpdateUserProfileRequest = z.infer<typeof updateUserProfileRequestSchema>;
export type SetPinRequest = z.infer<typeof setPinRequestSchema>;
export type VerifyPinRequest = z.infer<typeof verifyPinRequestSchema>;
export type VerifyKycIdRequest = z.infer<typeof verifyKycIdRequestSchema>;
export type ResolveAccountRequest = z.infer<typeof resolveAccountRequestSchema>;
export type SpendToBankRequest = z.infer<typeof spendToBankRequestSchema>;
export type SpendToUserRequest = z.infer<typeof spendToUserRequestSchema>;
export type SpendOnChainRequest = z.infer<typeof spendOnChainRequestSchema>;
export type OverrideRateRequest = z.infer<typeof overrideRateRequestSchema>;
export type PayBillRequest = z.infer<typeof payBillRequestSchema>;
export type SetActivePaymentProviderRequest = z.infer<typeof setActivePaymentProviderRequestSchema>;
export type MaintenanceConfig = z.infer<typeof maintenanceConfigSchema>;
export type SetMaintenanceConfigRequest = z.infer<typeof setMaintenanceConfigRequestSchema>;
export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type UpdateUserRoleRequest = z.infer<typeof updateUserRoleRequestSchema>;

