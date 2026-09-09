import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { TabType } from '../components/TabBar';
import { useAuthStore } from '../../store/auth.store';
import { sdk } from '../lib/sdk';

export type CryptoWithdrawalStatus = 'PENDING' | 'BROADCAST' | 'CONFIRMED' | 'FAILED' | 'CANCELLED';

export interface CryptoSendResult {
  reference: string;
  status: CryptoWithdrawalStatus;
  txHash?: string;
  chain: string;
  toAddress: string;
  amountUSDC: string;
  newBalanceUSDC: string;
}

export function useKudiWallet() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const user = useAuthStore((s) => s.user);
  const userId = user?.id || '';

  const [spendSuccess, setSpendSuccess] = useState<string | null>(null);
  const [cryptoSendResult, setCryptoSendResult] = useState<CryptoSendResult | null>(null);
  const cryptoPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  /**
   * Send USDC on-chain to any external address.
   * Immediately debits balance + returns PENDING — then polls for CONFIRMED/FAILED.
   */
  const sendCrypto = async (params: {
    amountUSDC: number;
    toAddress: string;
    chain: 'solana' | 'monad';
    pin: string;
  }): Promise<CryptoSendResult> => {
    const res = await sdk.sendCrypto({
      userId,
      pin: params.pin,
      amountUSDC: params.amountUSDC,
      toAddress: params.toAddress,
      chain: params.chain
    });

    if (!res || !res.success) {
      throw new Error(res?.error?.message || res?.message || 'Crypto send failed');
    }

    const result: CryptoSendResult = {
      reference: res.data.reference,
      status: res.data.status,
      chain: res.data.chain,
      toAddress: res.data.toAddress,
      amountUSDC: res.data.amountUSDC,
      newBalanceUSDC: res.data.newBalanceUSDC
    };

    setCryptoSendResult(result);

    // Invalidate balance immediately (optimistic debit already happened on server)
    queryClient.invalidateQueries({ queryKey: ['balance'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });

    // Start polling for status updates every 3 seconds
    if (cryptoPollRef.current) clearInterval(cryptoPollRef.current);
    cryptoPollRef.current = setInterval(async () => {
      try {
        const statusRes = await sdk.getCryptoWithdrawalStatus(result.reference);
        if (statusRes?.success && statusRes.data) {
          const updated: CryptoSendResult = {
            ...result,
            status: statusRes.data.status,
            txHash: statusRes.data.txHash
          };
          setCryptoSendResult(updated);

          // Stop polling once terminal state reached
          if (
            statusRes.data.status === 'CONFIRMED' ||
            statusRes.data.status === 'FAILED' ||
            statusRes.data.status === 'CANCELLED'
          ) {
            clearInterval(cryptoPollRef.current!);
            cryptoPollRef.current = null;
            queryClient.invalidateQueries({ queryKey: ['balance'] });
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
          }
        }
      } catch {
        // Silently ignore transient polling errors
      }
    }, 3000);

    return result;
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
    spendToBank,
    sendCrypto,
    cryptoSendResult,
    setCryptoSendResult
  };
}
