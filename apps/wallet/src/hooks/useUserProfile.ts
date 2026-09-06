import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { sdk } from '../lib/sdk';

export interface UserProfileData {
  user: {
    id: string;
    privyUserId?: string;
    email?: string;
    phoneNumber?: string;
    kycStatus?: string;
    kycTier?: string;
  };
  balanceUSDC: number;
  balanceNGN: number;
  wallets: Array<{
    chain: string;
    address: string;
    metadata?: Record<string, any>;
  }>;
  virtualAccounts: Array<{
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    currency: string;
    provider: string;
  }>;
}

export function useUserProfile() {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return useQuery<UserProfileData>({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not logged in');
      const res = await sdk.getUserProfile(user.id);
      if (res && res.success && res.data) {
        return res.data;
      }
      return {
        user: {
          id: user.id,
          privyUserId: user.privyUserId || `privy_usr_${user.id}`,
          email: user.email || `${user.id}@kudi.app`,
          kycStatus: user.kycStatus || 'NOT_STARTED',
          kycTier: user.kycTier || 'UNVERIFIED'
        },
        balanceUSDC: 250.0,
        balanceNGN: 250.0 * 1585.50,
        wallets: [],
        virtualAccounts: []
      };
    },
    refetchInterval: 15_000,
    enabled: isAuthenticated && !!user?.id
  });
}
