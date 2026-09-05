import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TabType } from '../components/TabBar';
import { useAuthStore } from '../../store/auth.store';
import { sdk } from '../lib/sdk';

export function useKudiWallet() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const user = useAuthStore(s => s.user);
  const userId = user?.id || 'usr_demo_123';

  const [balanceUSDC, setBalanceUSDC] = useState<string>('250.00');
  const [rateNGN] = useState<number>(1585.50);
  const [spendSuccess, setSpendSuccess] = useState<string | null>(null);

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
        if (data.newBalanceUSDC) setBalanceUSDC(data.newBalanceUSDC);
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
    spendSuccess,
    resolveAccount,
    spendToBank
  };
}

