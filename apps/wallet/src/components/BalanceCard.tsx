import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Wallet, PlusCircle, Send } from 'lucide-react-native';
import { Typography } from '../../constants/typography';

interface BalanceCardProps {
  balanceUSDC: string;
  rateNGN: number;
  mode?: 'light' | 'dark';
  onNavigateDeposit?: () => void;
  onNavigateSpend?: () => void;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balanceUSDC,
  rateNGN,
  mode = 'dark',
  onNavigateDeposit,
  onNavigateSpend
}) => {
  const isLight = mode === 'light';
  const ngnEquivalent = (parseFloat(balanceUSDC) || 0) * rateNGN;

  return (
    <View
      style={[
        styles.balanceCard,
        {
          backgroundColor: isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(255, 255, 255, 0.05)',
          borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.12)'
        }
      ]}
    >
      <View style={styles.cardHeaderRow}>
        <Text style={[Typography.caption, { color: isLight ? '#64748B' : '#CBD5E1' }]}>
          Spendable Balance (USDC Float)
        </Text>
        <Wallet size={16} color={isLight ? '#64748B' : '#CBD5E1'} />
      </View>

      <Text style={[Typography.currencyDisplay, styles.balanceValue, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
        ${balanceUSDC} <Text style={[Typography.title2, { color: isLight ? '#64748B' : '#94A3B8' }]}>USDC</Text>
      </Text>

      <Text style={[Typography.bodyBold, styles.ngnEquivalent, { color: isLight ? '#10B981' : '#34D399' }]}>
        ≈ ₦{ngnEquivalent.toLocaleString()} NGN{' '}
        <Text style={[Typography.footnote, { color: isLight ? '#94A3B8' : '#94A3B8' }]}>
          (1 USDC = ₦{rateNGN})
        </Text>
      </Text>

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={onNavigateDeposit}
          style={[
            styles.actionBtn,
            {
              backgroundColor: isLight ? '#0F172A' : 'rgba(255, 255, 255, 0.9)',
              borderColor: isLight ? '#0F172A' : '#FFFFFF'
            }
          ]}
          activeOpacity={0.8}
        >
          <PlusCircle size={18} color={isLight ? '#FFFFFF' : '#0F172A'} />
          <Text style={[Typography.bodyBold, { color: isLight ? '#FFFFFF' : '#0F172A' }]}>
            Deposit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onNavigateSpend}
          style={[
            styles.actionBtn,
            {
              backgroundColor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
              borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
            }
          ]}
          activeOpacity={0.8}
        >
          <Send size={16} color={isLight ? '#0F172A' : '#FFFFFF'} />
          <Text style={[Typography.bodyBold, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
            Transfer
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  balanceCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 22,
    marginBottom: 20
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  balanceValue: {
    marginVertical: 6
  },
  ngnEquivalent: {
    marginBottom: 18
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
