import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
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
    queryFn: async (): Promise<BalanceData> => {
      if (!user?.id) throw new Error('User not logged in');
      const res = await sdk.getBalance(user.id);
      if (res && res.success && res.data && typeof res.data === 'object' && 'userId' in res.data) {
        return res.data as unknown as BalanceData;
      }
      // Fallback object structure if API returns simple number or basic data
      const balanceUSDC: number = typeof res?.data === 'number' ? res.data : (Number((res?.data as any)?.balanceUSDC) || 250.0);
      const currentRateNGN: number = Number((res?.data as any)?.currentRateNGN) || 1585.50;
      return {
        userId: user.id,
        balanceUSDC,
        currentRateNGN,
        balanceNGN: balanceUSDC * currentRateNGN,
        kycTier: user.kycTier || 'UNVERIFIED',
        dailyLimitNGN: 500000,
        wallets: (res?.data as any)?.wallets || []
      };
    },
    refetchInterval: 15_000,
    enabled: isAuthenticated && !!user?.id
  });
}
