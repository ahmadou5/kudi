import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../../lib/theme';
import { BalanceCard } from '../../components/BalanceCard';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { Typography } from '../../constants/typography';
import { Header } from '../../components/Header';
import { TransactionCard, TransactionData } from '../../components/TransactionCard';

export default function HomeTab() {
  const palette = useAppPalette();
  const { balanceUSDC, rateNGN } = useKudiWallet();

  const quickActions: Array<{
    label: string;
    iconName: keyof typeof Ionicons.glyphMap;
    route: string;
  }> = [
      { label: 'Airtime', iconName: 'phone-portrait-outline', route: '/(tabs)/spend' },
      { label: 'Data', iconName: 'cellular-outline', route: '/(tabs)/spend' },
      { label: 'Electricity', iconName: 'flash-outline', route: '/(tabs)/spend' },
      { label: 'Virtual Card', iconName: 'card-outline', route: '/(tabs)/card' }
    ];

  const recentTransactions: TransactionData[] = [
    {
      id: '1',
      title: 'MTN Airtime Top-Up',
      subtitle: 'Airtime Purchase',
      date: '10:32 AM',
      amount: '-₦5,000.00',
      secondaryAmount: '3.15 USDC',
      status: 'SUCCESS',
      icon: 'phone-portrait-outline',
      isDeposit: false
    },
    {
      id: '2',
      title: 'Deposit Solana USDC',
      subtitle: 'Solana Network',
      date: 'Today',
      amount: '+$100.00',
      secondaryAmount: '158,550 NGN',
      status: 'COMPLETED',
      icon: 'arrow-down-circle-outline',
      isDeposit: true
    },
    {
      id: '3',
      title: 'Electricity Payment',
      subtitle: 'IKEDC Prepaid Token',
      date: 'Yesterday',
      amount: '-₦12,500.00',
      secondaryAmount: '7.88 USDC',
      status: 'SUCCESS',
      icon: 'flash-outline',
      isDeposit: false
    }
  ];

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Fixed Sticky Top Header */}
      <Header onOpenScanner={() => router.push('/qr-scanner')} />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110, paddingHorizontal: 14, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Balance Card Component */}
        <BalanceCard balanceUSDC={balanceUSDC} rateNGN={rateNGN} />

        {/* Quick Actions Circle Row */}
        <Text style={[Typography.title2, styles.sectionTitle, { color: palette.text }]}>
          Quick Services
        </Text>

        <View style={styles.quickGrid}>
          {quickActions.map((act) => (
            <TouchableOpacity
              key={act.label}
              style={styles.quickItem}
              onPress={() => router.push(act.route as any)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickCircle, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <Ionicons name={act.iconName} size={22} color={palette.text} />
              </View>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                {act.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity Feed */}
        <View style={styles.activityHeaderRow}>
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

        <View style={styles.activityList}>
          {recentTransactions.map((tx) => (
            <TransactionCard key={tx.id} item={tx} compact />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  metallicCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    marginVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardChipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 },
  cardChip: {
    width: 40,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#94A3B8',
    padding: 4,
    justifyContent: 'center'
  },
  chipInner: {
    height: 12,
    borderWidth: 1,
    borderColor: '#64748B',
    borderRadius: 3
  },
  activeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  activeTagText: { color: '#FFFFFF', fontSize: 10 },
  cardFooter: { marginTop: 4 },
  cardNumber: { color: '#0F172A', letterSpacing: 2 },
  cardLabel: { color: '#475569', marginTop: 4 },
  activityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, marginBottom: 12 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityList: { gap: 10 },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1
  },
  txLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  txIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  txDetails: { gap: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 4 }
});
