import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  RefreshControl
} from 'react-native';
import { router } from 'expo-router';
import { useAppPalette } from '../../src/lib/theme';
import { BalanceCarousel } from '../../src/components/BalanceCarousel';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { Typography } from '../../src/constants/typography';
import { Header } from '../../src/components/Header';
import { TransactionCard, TransactionData } from '../../src/components/TransactionCard';
import { formatIntelligentTimestamp } from '../../src/utils/timeUtils';
import { ActivityRowSkeleton } from '../../src/components/ui/AnimatedSkeleton';
import { ActivityEmptyState } from '../../src/components/ActivityEmptyState';
import { useDepositRequestStore } from '../../src/store/deposit-request.store';
import { SecurityPromptCards } from '../../src/components/SecurityPromptCards';
import { useLoader } from '../../src/store/loader.store';
import { EnterSection } from '../../src/lib/animations';

export default function HomeTab() {
  const palette = useAppPalette();
  const { showLoader, hideLoader } = useLoader();
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);
  const requestDeposit = useDepositRequestStore((s) => s.requestDeposit);
  const {
    balanceUSDC,
    rateNGN,
    transactions,
    userId,
    isBalanceLoading,
    isTransactionsLoading,
    refetchBalance,
    refetchTransactions,
    depositNotification
  } = useKudiWallet();

  const isRefreshing = isBalanceLoading || isTransactionsLoading;

  // Map live API transactions to TransactionData interface
  const formattedTransactions: TransactionData[] = (transactions || []).map((tx: any, idx: number) => {
    const isDeposit =
      tx.toUserId === userId ||
      tx.fromUserId === 'CHAIN_DEPOSIT' ||
      tx.metadata?.type === 'DEPOSIT' ||
      tx.metadata?.type === 'DEPOSIT_CREDIT' ||
      tx.metadata?.type === 'DEPOSIT_ONCHAIN';

    const rawChain = (tx.metadata?.chain || tx.chain || '').toLowerCase();
    const isMonad = rawChain.includes('monad') || tx.currency === 'AUSD' || tx.metadata?.tokenSymbol === 'AUSD' || tx.metadata?.title?.includes('AUSD');
    const isSolana = rawChain.includes('solana') || tx.currency === 'USDC' || (!isMonad && isDeposit);

    const tokenSymbol = isMonad ? 'AUSD' : (tx.currency || 'USDC');
    const chainName = isMonad ? 'monad' : (isSolana ? 'solana' : '');

    const rawAmount = typeof tx.amount === 'number' ? tx.amount.toFixed(2) : String(tx.amount || '0.00');
    const amountNum = parseFloat(rawAmount) || 0;
    const amountNGN = amountNum * rateNGN;
    const amountStr = `${isDeposit ? '+' : '-'}$${amountNum.toFixed(2)} ${tokenSymbol}`;

    const formattedDate = formatIntelligentTimestamp(tx.timestamp);

    return {
      id: tx.reference || String(idx),
      ref: tx.reference,
      txHash: tx.metadata?.txHash || tx.reference,
      title: isDeposit ? 'Deposit' : 'Spend',
      subtitle: tx.metadata?.subtitle || (isDeposit ? `${isMonad ? 'Monad Testnet' : 'Solana Network'}` : `${tx.currency || 'NGN'} Transfer`),
      date: formattedDate,
      amount: amountStr,
      secondaryAmount: `≈ ₦${amountNGN.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      status: (tx.metadata?.status && ['SUCCESS', 'COMPLETED'].includes(tx.metadata.status.toUpperCase())) ? 'CONFIRMED' : (tx.metadata?.status || 'CONFIRMED'),
      isDeposit,
      chain: chainName,
      tokenSymbol,
      icon: isDeposit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline',
      metadata: tx.metadata
    };
  });

  const onRefresh = async () => {
    showLoader({ message: 'Refreshing wallet balances & activity...', title: 'KUDI' });
    try {
      await Promise.all([refetchBalance(), refetchTransactions()]);
    } finally {
      setTimeout(() => {
        hideLoader();
      }, 700);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Fixed Top Section: Header + Balance Carousel + Activity Header */}
      <View style={styles.fixedHeaderSection}>
        <Header onOpenScanner={() => router.push('/qr-scanner')} />
        <EnterSection index={0}>
          <BalanceCarousel balanceUSDC={balanceUSDC} rateNGN={rateNGN} depositNotification={depositNotification} isLoading={isBalanceLoading && parseFloat(balanceUSDC) === 0} />
        </EnterSection>
        <EnterSection index={1}>
          <View style={{ paddingHorizontal: 14 }}>
            <SecurityPromptCards />
          </View>
        </EnterSection>
        <EnterSection index={2}>
          <View style={[styles.activityHeaderRow, { paddingHorizontal: 14 }]}>
            <Text style={[Typography.title2, { color: palette.text }]}>
              Recent Activity
            </Text>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/history')}
              style={styles.viewAllBtn}
              activeOpacity={0.7}
            >
              <Text style={[Typography.bodyBold, { color: palette.textSecondary }]}>
                View All
              </Text>
            </TouchableOpacity>
          </View>
        </EnterSection>
      </View>

      {/* Scrollable Transaction Cards List Only */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 110, paddingHorizontal: 14, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.text}
            colors={[palette.primary]}
          />
        }
      >
        <View style={[styles.activityList, formattedTransactions.length === 0 && { flex: 1 }]}>
          {isTransactionsLoading && formattedTransactions.length === 0 ? (
            <>
              <ActivityRowSkeleton />
              <ActivityRowSkeleton />
              <ActivityRowSkeleton />
            </>
          ) : formattedTransactions.length > 0 ? (
            formattedTransactions.slice(0, 7).map((tx) => (
              <TransactionCard
                key={tx.id}
                item={tx}
                compact
                expandedId={expandedTxId}
                onToggle={setExpandedTxId}
              />
            ))
          ) : (
            <ActivityEmptyState
              title="No activity yet"
              body="Deposits and payouts land here the moment they settle on-chain."
              primaryLabel="Deposit"
              onPrimary={requestDeposit}
              secondaryLabel="View all"
              onSecondary={() => router.push('/(tabs)/history')}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fixedHeaderSection: {
    zIndex: 10
  },
  activityHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 12
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  activityList: { gap: 10 }
});
