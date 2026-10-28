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
import { mapApiTransactions } from '../../src/utils/transactionMapper';

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

  const historyItems: TransactionData[] = mapApiTransactions(apiTxs, userId, rateNGN);

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
          colors={[palette.primary]}
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

