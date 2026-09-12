import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import { router } from 'expo-router';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';

interface BalanceCardProps {
  balanceUSDC: string;
  rateNGN: number;
  depositNotification?: { amountUSDC: number; chain: string } | null;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  balanceUSDC,
  rateNGN,
  depositNotification
}) => {
  const palette = useAppPalette();
  const numericBalance = parseFloat(balanceUSDC) || 0;
  const ngnEquivalent = numericBalance * rateNGN;
  const isDark = palette.text === '#FFFFFF';

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const badgeYAnim = useRef(new Animated.Value(20)).current;
  const badgeOpacityAnim = useRef(new Animated.Value(0)).current;

  const prevBalanceRef = useRef<number>(numericBalance);
  const [depositDelta, setDepositDelta] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    if (numericBalance > prev && prev !== 0) {
      const diff = numericBalance - prev;
      setDepositDelta(diff);

      // Trigger Apple-style spring pulse & green glow aura
      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, {
            toValue: 1.04,
            friction: 5,
            tension: 140,
            useNativeDriver: true
          }),
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 6,
            tension: 100,
            useNativeDriver: true
          })
        ]),
        Animated.sequence([
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true
          }),
          Animated.timing(glowAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true
          })
        ]),
        Animated.sequence([
          Animated.parallel([
            Animated.spring(badgeYAnim, {
              toValue: 0,
              friction: 6,
              tension: 120,
              useNativeDriver: true
            }),
            Animated.timing(badgeOpacityAnim, {
              toValue: 1,
              duration: 250,
              useNativeDriver: true
            })
          ]),
          Animated.delay(4000),
          Animated.parallel([
            Animated.timing(badgeYAnim, {
              toValue: -15,
              duration: 300,
              useNativeDriver: true
            }),
            Animated.timing(badgeOpacityAnim, {
              toValue: 0,
              duration: 300,
              useNativeDriver: true
            })
          ])
        ])
      ]).start(() => {
        badgeYAnim.setValue(20);
      });
    }

    prevBalanceRef.current = numericBalance;
  }, [numericBalance]);

  return (
    <Animated.View
      style={[
        styles.balanceCard,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      {/* Animated Green Deposit Glow Overlay */}
      <Animated.View
        style={[
          styles.glowOverlay,
          {
            backgroundColor: palette.success,
            opacity: glowAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.18]
            })
          }
        ]}
        pointerEvents="none"
      />

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
      </View>

      <View style={styles.cardHeaderRow}>
        <Text style={[Typography.caption, { color: palette.textSecondary }]}>
          Available Balance
        </Text>

        {/* Animated Floating Deposit Badge */}
        {depositDelta !== null && (
          <Animated.View
            style={[
              styles.depositBadge,
              {
                backgroundColor: 'rgba(16, 185, 129, 0.15)',
                borderColor: palette.success,
                opacity: badgeOpacityAnim,
                transform: [{ translateY: badgeYAnim }]
              }
            ]}
          >
            <Text style={[Typography.caption, { color: palette.success, fontWeight: '700' }]}>
              +${depositDelta.toFixed(2)} USDC 💰
            </Text>
          </Animated.View>
        )}
      </View>

      <Text style={[Typography.currencyDisplay, styles.balanceValue, { color: palette.text }]}>
        ${balanceUSDC} <Text style={[Typography.title2, { color: palette.textSecondary }]}>USDC</Text>
      </Text>

      <Text style={[Typography.bodyBold, styles.ngnEquivalent, { color: palette.success }]}>
        ₦{ngnEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN{' '}
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
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  balanceCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative'
  },
  glowOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24
  },
  patternContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden'
  },
  patternRingOuter: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1
  },
  patternRingInner: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1
  },
  patternGlow: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 80,
    height: 80,
    borderRadius: 40
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6
  },
  depositBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  balanceValue: {
    marginVertical: 4
  },
  ngnEquivalent: {
    marginBottom: 16
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4
  },
  actionBtn: {
    flex: 1,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  }
});
