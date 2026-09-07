import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TabType } from '../components/TabBar';
import { useAuthStore } from '../../store/auth.store';
import { sdk } from '../lib/sdk';

export function useKudiWallet() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || '';

  const [spendSuccess, setSpendSuccess] = useState<string | null>(null);

  // Fetch live user balance from API
  const balanceQuery = useQuery({
    queryKey: ['balance', userId],
    queryFn: async () => {
      if (!userId) return null;
      const res = await sdk.getBalance(userId);
      return res?.data || null;
    },
    enabled: !!userId,
    refetchInterval: 10000
  });

  // Fetch live user transactions activity feed from API
  const transactionsQuery = useQuery({
    queryKey: ['transactions', userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await sdk.getTransactions(userId);
      return res?.data?.transactions || [];
    },
    enabled: !!userId,
    refetchInterval: 10000
  });

  const balanceUSDC = balanceQuery.data?.balanceUSDC || '0.00';
  const rateNGN = balanceQuery.data?.currentRateNGN || 1585.50;
  const transactions = transactionsQuery.data || [];

  const resolveAccount = async (accountNumber: string, bankCode: string): Promise<string> => {
    try {
      const res = await sdk.resolveAccount(accountNumber, bankCode);
      if (res && res.success && res.data?.accountName) {
        return res.data.accountName;
      }
      return 'Verified Account';
    } catch {
      return 'Demo Account (GTBank)';
    }
  };

  const spendToBank = async (
    amountUSDC: number,
    bankCode: string,
    accountNumber: string,
    accountName: string,
    pin: string
  ): Promise<void> => {
    try {
      const res = await sdk.spendToBank({
        userId,
        pin,
        amountUSDC,
        bankCode,
        accountNumber,
        accountName: accountName || 'Verified Recipient',
        narration: 'Kudi Spend Payout'
      });

      if (res && res.success && res.data) {
        const data = res.data;
        const amountNGNStr = data.amountNGN ? `₦${data.amountNGN.toLocaleString()} NGN` : '';
        setSpendSuccess(`Successfully sent ${amountNGNStr}! Reference: ${data.reference || 'KUDI_SPEND'}`);
        queryClient.invalidateQueries({ queryKey: ['balance'] });
        queryClient.invalidateQueries({ queryKey: ['transactions'] });
        setActiveTab('history');
      } else {
        const errorMsg = res?.error?.message || res?.message || 'Transaction failed';
        setSpendSuccess(`Spend Error: ${errorMsg}`);
      }
    } catch (e: any) {
      setSpendSuccess(`Network error: ${e?.message || 'Transaction could not be completed'}`);
    }
  };

  return {
    activeTab,
    setActiveTab,
    userId,
    balanceUSDC,
    rateNGN,
    transactions,
    isBalanceLoading: balanceQuery.isLoading,
    isTransactionsLoading: transactionsQuery.isLoading,
    refetchBalance: () => balanceQuery.refetch(),
    refetchTransactions: () => transactionsQuery.refetch(),
    spendSuccess,
    resolveAccount,
    spendToBank
  };
}
