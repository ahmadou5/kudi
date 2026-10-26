import React from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useAppPalette } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { ActivityEmptyState } from '../../src/components/ActivityEmptyState';
import { useDepositRequestStore } from '../../src/store/deposit-request.store';
import { TransactionCard, TransactionData } from '../../src/components/TransactionCard';
import { useTransactions } from '../../src/hooks/useTransactions';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { formatIntelligentTimestamp } from '../../src/utils/timeUtils';

function ActivitySkeleton({ palette }: { palette: any }) {
  return (
    <View style={[styles.skeletonCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.skeletonRow}>
        <View style={[styles.skeletonCircle, { backgroundColor: palette.border }]} />
        <View style={styles.skeletonTextStack}>
          <View style={[styles.skeletonBar, { width: 120, backgroundColor: palette.border }]} />
          <View style={[styles.skeletonBar, { width: 80, height: 10, backgroundColor: palette.border }]} />
        </View>
        <View style={[styles.skeletonBar, { width: 60, height: 16, backgroundColor: palette.border }]} />
      </View>
    </View>
  );
}

export default function HistoryTab() {
  const requestDeposit = useDepositRequestStore((s) => s.requestDeposit);
  const palette = useAppPalette();
  const { data: apiTxs, isLoading, refetch, isRefetching } = useTransactions(50);
  const { userId, rateNGN } = useKudiWallet();

  const historyItems: TransactionData[] = (apiTxs || []).map((tx: any, idx: number) => {
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

    const formattedDate = formatIntelligentTimestamp(tx.timestamp);

    return {
      id: tx.reference || `tx_${idx}`,
      ref: tx.reference,
      txHash: tx.metadata?.txHash || tx.reference,
      title: tx.metadata?.title || (isDeposit ? `${tokenSymbol} Deposit` : 'Bank Payout'),
      subtitle: tx.metadata?.subtitle || (isDeposit ? `${isMonad ? 'Monad Testnet' : 'Solana Network'}` : `${tx.currency || 'NGN'} Transfer`),
      amount: `${isDeposit ? '+' : '-'}$${amountNum.toFixed(2)} ${tokenSymbol}`,
      secondaryAmount: `≈ ₦${amountNGN.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN`,
      status: (tx.metadata?.status && ['SUCCESS', 'COMPLETED'].includes(tx.metadata.status.toUpperCase())) ? 'CONFIRMED' : (tx.metadata?.status || (isDeposit ? 'CONFIRMED' : 'PENDING')),
      date: formattedDate,
      isDeposit,
      chain: chainName,
      tokenSymbol,
      metadata: tx.metadata
    };
  });

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={palette.text}
          colors={['#3B82F6']}
        />
      }
    >
      <Text style={[Typography.title1, { color: palette.text }]}>Activities</Text>

      <View style={[{ gap: 12, marginTop: 16 }, historyItems.length === 0 && { flex: 1 }]}>
        {isLoading && historyItems.length === 0 ? (
          <>
            <ActivitySkeleton palette={palette} />
            <ActivitySkeleton palette={palette} />
            <ActivitySkeleton palette={palette} />
          </>
        ) : historyItems.length > 0 ? (
          historyItems.map((item) => (
            <TransactionCard key={item.id || item.ref} item={item} />
          ))
        ) : (
          <ActivityEmptyState
            title="Nothing here yet"
            body="Every deposit, transfer and payout shows up here as soon as it settles."
            primaryLabel="Deposit"
            onPrimary={() => {
              router.push('/(tabs)');
              requestDeposit();
            }}
            secondaryLabel="Refresh"
            onSecondary={() => refetch()}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skeletonCard: {
    padding: 16,
    borderRadius: 18,
    borderWidth: 1
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  skeletonCircle: {
    width: 40,
    height: 40,
    borderRadius: 20
  },
  skeletonTextStack: {
    flex: 1,
    gap: 8
  },
  skeletonBar: {
    height: 14,
    borderRadius: 6
  }
});

