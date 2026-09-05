import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { sdk } from '../lib/sdk';

export interface BalanceData {
  userId: string;
  balanceUSDC: number;
  currentRateNGN: number;
  balanceNGN: number;
  kycTier: string;
  dailyLimitNGN: number;
  wallets: Array<{ chain: string; address: string }>;
}

export function useBalance() {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return useQuery<BalanceData>({
    queryKey: ['balance', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not logged in');
      const res = await sdk.getBalance(user.id);
      if (res && res.success && res.data) {
        return res.data;
      }
      // Fallback object structure if API returns simple number
      const balanceUSDC = typeof res?.data === 'number' ? res.data : (res?.data?.balanceUSDC || 250.0);
      const currentRateNGN = res?.data?.currentRateNGN || 1585.50;
      return {
        userId: user.id,
        balanceUSDC,
        currentRateNGN,
        balanceNGN: balanceUSDC * currentRateNGN,
        kycTier: user.kycTier || 'UNVERIFIED',
        dailyLimitNGN: 500000,
        wallets: res?.data?.wallets || []
      };
    },
    refetchInterval: 15_000,
    enabled: isAuthenticated && !!user?.id
  });
}
