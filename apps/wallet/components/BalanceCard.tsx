import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';

interface BalanceCardProps {
  balanceUSDC: string;
  rateNGN: number;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ balanceUSDC, rateNGN }) => {
  const palette = useAppPalette();
  const ngnEquivalent = (parseFloat(balanceUSDC) || 0) * rateNGN;
  const isDark = palette.text === '#FFFFFF';

  return (
    <View
      style={[
        styles.balanceCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border
        }
      ]}
    >
      {/* Subtle Background Pattern Layer */}
      <View style={styles.patternContainer} pointerEvents="none">
        <View
          style={[
            styles.patternRingOuter,
            { borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)' }
          ]}
        />
        <View
          style={[
            styles.patternRingInner,
            { borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)' }
          ]}
        />
        <View
          style={[
            styles.patternGlow,
            { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.05)' : 'rgba(16, 185, 129, 0.04)' }
          ]}
        />
        <View style={styles.dotGrid}>
          {[...Array(6)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.patternDot,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(15, 23, 42, 0.12)' }
              ]}
            />
          ))}
        </View>
      </View>

      <View style={styles.cardHeaderRow}>
        <Text style={[Typography.caption, { color: palette.textSecondary }]}>
          Balance
        </Text>
      </View>

      <Text style={[Typography.currencyDisplay, styles.balanceValue, { color: palette.text }]}>
        ${balanceUSDC} <Text style={[Typography.title2, { color: palette.textSecondary }]}>USDC</Text>
      </Text>

      <Text style={[Typography.bodyBold, styles.ngnEquivalent, { color: palette.success }]}>
        ₦{ngnEquivalent.toLocaleString()} NGN{' '}
        <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
          (1 USDC = ₦{rateNGN})
        </Text>
      </Text>

      {/* Action Buttons Row */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/deposit')}
          style={[
            styles.actionBtn,
            {
              backgroundColor: palette.text,
              borderColor: palette.border
            }
          ]}
          activeOpacity={0.8}
        >
          <Text style={[Typography.bodyBold, { color: palette.bg }]}>
            Deposit
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/spend')}
          style={[
            styles.actionBtn,
            {
              backgroundColor: palette.card,
              borderColor: palette.border
            }
          ]}
          activeOpacity={0.8}
        >
          <Text style={[Typography.bodyBold, { color: palette.text }]}>
            Spend
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  balanceCard: {
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 0.7,
    borderRadius: Typography.xxl,
    padding: Typography.xl,
    marginTop: Typography.xs,
    marginBottom: 20
  },
  patternContainer: {
    ...(StyleSheet.absoluteFill as any)
  },
  patternRingOuter: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5
  },
  patternRingInner: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1
  },
  patternGlow: {
    position: 'absolute',
    top: -30,
    right: 10,
    width: 150,
    height: 150,
    borderRadius: 75
  },
  dotGrid: {
    position: 'absolute',
    top: 18,
    right: 20,
    flexDirection: 'row',
    gap: 6
  },
  patternDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5
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
