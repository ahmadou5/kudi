import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Smartphone, Wifi, Zap, CreditCard, Receipt, LucideIcon } from 'lucide-react-native';
import { useAppPalette } from '../../src/lib/theme';
import { BalanceCarousel } from '../../src/components/BalanceCarousel';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { Typography } from '../../src/constants/typography';
import { Header } from '../../src/components/Header';
import { TransactionCard, TransactionData } from '../../src/components/TransactionCard';
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

export default function HomeTab() {
  const palette = useAppPalette();
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

  const quickActions: Array<{
    label: string;
    Icon: LucideIcon;
    route: string;
  }> = [
      { label: 'Airtime', Icon: Smartphone, route: '/(tabs)/spend' },
      { label: 'Data', Icon: Wifi, route: '/(tabs)/spend' },
      { label: 'Electricity', Icon: Zap, route: '/(tabs)/spend' },
      { label: 'Virtual Card', Icon: CreditCard, route: '/(tabs)/card' }
    ];

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

  const onRefresh = () => {
    refetchBalance();
    refetchTransactions();
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Fixed Top Section: Header + Balance Carousel + Activity Header */}
      <View style={styles.fixedHeaderSection}>
        <Header onOpenScanner={() => router.push('/qr-scanner')} />
        <BalanceCarousel balanceUSDC={balanceUSDC} rateNGN={rateNGN} depositNotification={depositNotification} />
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
      </View>

      {/* Scrollable Transaction Cards List Only */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 14, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={palette.text}
            colors={['#3B82F6']}
          />
        }
      >
        <View style={styles.activityList}>
          {isTransactionsLoading && formattedTransactions.length === 0 ? (
            <>
              <ActivitySkeleton palette={palette} />
              <ActivitySkeleton palette={palette} />
              <ActivitySkeleton palette={palette} />
            </>
          ) : formattedTransactions.length > 0 ? (
            formattedTransactions.slice(0, 5).map((tx) => (
              <TransactionCard key={tx.id} item={tx} compact />
            ))
          ) : (
            <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Receipt size={28} color={palette.textSecondary} />
              <Text style={[Typography.bodyBold, { color: palette.text }]}>No Activity Yet</Text>
              <Text style={[Typography.caption, { color: palette.textSecondary, textAlign: 'center' }]}>
                Your deposits and payouts will appear here in real-time.
              </Text>
            </View>
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
  balanceCardWrapper: {
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 4
  },
  sectionTitle: { marginTop: 12, marginBottom: 12 },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 8 },
  quickItem: { alignItems: 'center', gap: 8 },
  quickCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4
  },
  activityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityList: { gap: 10 },
  emptyBox: {
    padding: 24,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
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
