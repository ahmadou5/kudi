import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TabType } from '../components/TabBar';
import { Typography } from '../../constants/typography';

interface HomeScreenProps {
  onNavigate: (tab: TabType) => void;
  mode?: 'light' | 'dark';
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, mode = 'dark' }) => {
  const isLight = mode === 'light';

  const quickActions: Array<{
    label: string;
    iconName: keyof typeof Ionicons.glyphMap;
    color: string;
  }> = [
      { label: 'Airtime', iconName: 'phone-portrait-outline', color: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)' },
      { label: 'Data', iconName: 'cellular-outline', color: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)' },
      { label: 'Electricity', iconName: 'flash-outline', color: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)' },
      { label: 'Virtual Card', iconName: 'card-outline', color: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)' }
    ];

  const recentTransactions: Array<{
    title: string;
    time: string;
    amount: string;
    status: string;
    icon: keyof typeof Ionicons.glyphMap;
    iconBg: string;
    iconColor: string;
  }> = [
      {
        title: 'MTN Airtime Top-Up',
        time: '10:32 AM',
        amount: '-₦5,000',
        status: 'SUCCESS',
        icon: 'phone-portrait-outline',
        iconBg: 'rgba(239, 68, 68, 0.1)',
        iconColor: '#EF4444'
      },
      {
        title: 'Deposit Solana USDC',
        time: 'Today',
        amount: '+$100.00',
        status: 'COMPLETED',
        icon: 'arrow-down-circle-outline',
        iconBg: 'rgba(16, 185, 129, 0.1)',
        iconColor: '#10B981'
      },
      {
        title: 'Electricity Payment',
        time: 'Yesterday',
        amount: '-₦12,500',
        status: 'SUCCESS',
        icon: 'flash-outline',
        iconBg: 'rgba(245, 158, 11, 0.1)',
        iconColor: '#F59E0B'
      }
    ];

  return (
    <View style={styles.container}>
      {/* Quick Actions Circle Row */}
      <Text style={[Typography.title2, styles.sectionTitle, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
        Quick Services
      </Text>

      <View style={styles.quickGrid}>
        {quickActions.map((act) => (
          <TouchableOpacity
            key={act.label}
            style={styles.quickItem}
            onPress={() => onNavigate('spend')}
            activeOpacity={0.7}
          >
            <View style={[styles.quickCircle, { backgroundColor: act.color }]}>
              <Ionicons name={act.iconName} size={22} color={isLight ? '#0F172A' : '#FFFFFF'} />
            </View>
            <Text style={[Typography.subhead, { color: isLight ? '#475569' : '#CBD5E1' }]}>
              {act.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>



      {/* Recent Activity */}
      <View style={styles.activityHeaderRow}>
        <Text style={[Typography.title2, styles.sectionTitle, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
          Recent Activity
        </Text>
        <TouchableOpacity onPress={() => onNavigate('history')} activeOpacity={0.7} style={styles.viewAllBtn}>
          <Text style={[Typography.bodyBold, { color: isLight ? '#64748B' : '#94A3B8' }]}>
            View All
          </Text>
          <Ionicons name="arrow-forward" size={14} color={isLight ? '#64748B' : '#94A3B8'} />
        </TouchableOpacity>
      </View>

      <View style={styles.activityList}>
        {recentTransactions.map((tx, idx) => (
          <View
            key={idx}
            style={[
              styles.activityItem,
              {
                backgroundColor: isLight ? '#F8FAFC' : 'rgba(255,255,255,0.03)',
                borderColor: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.06)'
              }
            ]}
          >
            <View style={styles.txLeftGroup}>
              <View style={[styles.txIconContainer, { backgroundColor: tx.iconBg }]}>
                <Ionicons name={tx.icon} size={18} color={tx.iconColor} />
              </View>

              <View style={styles.txDetails}>
                <Text style={[Typography.bodyBold, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
                  {tx.title}
                </Text>
                <Text style={[Typography.subhead, { color: isLight ? '#64748B' : '#94A3B8' }]}>
                  {tx.time}
                </Text>
              </View>
            </View>

            <View style={{ alignItems: 'flex-end' }}>
              <Text
                style={[
                  Typography.currencySub,
                  { color: tx.amount.startsWith('+') ? '#34D399' : isLight ? '#0F172A' : '#FFFFFF' }
                ]}
              >
                {tx.amount}
              </Text>
              <View style={styles.statusBadge}>
                <Text style={[Typography.caption, styles.statusBadgeText]}>{tx.status}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 90 },
  sectionTitle: { marginVertical: 4 },
  quickGrid: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 4 },
  quickItem: { alignItems: 'center', gap: 6 },
  quickCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center'
  },
  metallicCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    marginVertical: 4
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardBrand: { color: '#0F172A' },
  cardVisa: { color: '#0F172A', fontStyle: 'italic' },
  cardChipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 14 },
  cardChip: { width: 36, height: 26, borderRadius: 6, backgroundColor: '#94A3B8' },
  activeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  activeTagText: { color: '#FFFFFF', fontSize: 10 },
  cardFooter: { marginTop: 8 },
  cardNumber: { color: '#0F172A' },
  cardLabel: { color: '#475569', marginTop: 4 },
  activityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  viewAllBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityList: { gap: 10 },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1
  },
  txLeftGroup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  txIconContainer: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  txDetails: { gap: 2 },
  statusBadge: { backgroundColor: 'rgba(52, 211, 153, 0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
  statusBadgeText: { color: '#34D399', fontSize: 9 }
});
