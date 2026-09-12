import React from 'react';
import { StyleSheet, Text, View, ScrollView, RefreshControl } from 'react-native';
import { Receipt } from 'lucide-react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { TransactionCard, TransactionData } from '../../components/TransactionCard';
import { useTransactions } from '../../src/hooks/useTransactions';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';

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

    let formattedDate = 'Recently';
    if (tx.timestamp) {
      const d = new Date(tx.timestamp);
      formattedDate = d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    return {
      id: tx.reference || `tx_${idx}`,
      ref: tx.reference,
      txHash: tx.metadata?.txHash || tx.reference,
      title: tx.metadata?.title || (isDeposit ? `${tokenSymbol} Deposit` : 'Bank Payout'),
      subtitle: tx.metadata?.subtitle || (isDeposit ? `${isMonad ? 'Monad Testnet' : 'Solana Network'}` : `${tx.currency || 'NGN'} Transfer`),
      amount: `${isDeposit ? '+' : '-'}$${amountNum.toFixed(2)} ${tokenSymbol}`,
      secondaryAmount: `≈ ₦${amountNGN.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN`,
      status: tx.metadata?.status || 'SUCCESS',
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
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }}
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

      <View style={{ gap: 12, marginTop: 16 }}>
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
          <View style={[styles.emptyBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Receipt size={32} color={palette.textSecondary} />
            <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 6 }]}>No Activities Yet</Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, textAlign: 'center' }]}>
              All your deposits, transfers, and payouts will appear here in real-time.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyBox: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20
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

