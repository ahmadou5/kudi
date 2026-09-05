import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/auth.store';
import { sdk } from '../lib/sdk';

export interface TransactionItem {
  reference: string;
  fromUserId: string;
  toUserId: string;
  amount: string | number;
  currency: string;
  timestamp: string;
  metadata?: {
    title?: string;
    subtitle?: string;
    type?: string;
  };
}

export function useTransactions(limit = 20) {
  const user = useAuthStore(s => s.user);
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);

  return useQuery<TransactionItem[]>({
    queryKey: ['transactions', user?.id, limit],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await sdk.getTransactions(user.id, { limit });
      if (res && res.success && res.data) {
        return res.data.transactions || [];
      }
      return [];
    },
    enabled: isAuthenticated && !!user?.id
  });
}
