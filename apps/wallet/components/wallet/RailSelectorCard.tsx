import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { ChainLogo } from '../ui/ChainLogo';

interface RailSelectorCardProps {
  onSelectOffchain: () => void;
  onSelectOnchain: () => void;
}

export const RailSelectorCard: React.FC<RailSelectorCardProps> = ({
  onSelectOffchain,
  onSelectOnchain,
}) => {
  const palette = useAppPalette();

  return (
    <View style={styles.sectionGap}>
      <View style={styles.headerCopy}>
        <Text style={[styles.eyebrow, { color: palette.primary }]}>TRANSFER FLOW</Text>
        <Text style={[styles.titleText, { color: palette.text }]}>Select payment rails</Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onSelectOffchain}
        style={[styles.rootCard, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(10,132,255,0.12)' }]}>
          <Ionicons name="business-outline" size={24} color={palette.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>Off-Chain Transfer</Text>
          <Text style={[styles.cardSubtitle, { color: palette.textSecondary }]}>
            Send instantly to NGN Bank accounts (Paystack/NUBAN) or inter-app handles
          </Text>
          <View style={styles.pillRow}>
            <View style={[styles.miniPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Text style={[styles.miniPillText, { color: palette.text }]}>NUBAN Bank</Text>
            </View>
            <View style={[styles.miniPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Text style={[styles.miniPillText, { color: palette.text }]}>Inter-App</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onSelectOnchain}
        style={[styles.rootCard, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        <View style={[styles.cardIconWrap, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
          <Ionicons name="paper-plane-outline" size={24} color="#8B5CF6" />
        </View>
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: palette.text }]}>On-Chain Transfer</Text>
          <Text style={[styles.cardSubtitle, { color: palette.textSecondary }]}>
            Send USDC or AUSD to external crypto wallet addresses
          </Text>
          <View style={styles.pillRow}>
            <View style={[styles.miniPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <ChainLogo chain="solana" size={14} />
              <Text style={[styles.miniPillText, { color: palette.text }]}>Solana</Text>
            </View>
            <View style={[styles.miniPill, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <ChainLogo chain="monad" size={14} />
              <Text style={[styles.miniPillText, { color: palette.text }]}>Monad</Text>
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  sectionGap: { gap: Spacing.lg },
  headerCopy: { gap: 4 },
  eyebrow: {
    fontSize: Typography.xs,
    fontFamily: Typography.family.bold,
    letterSpacing: 1,
  },
  titleText: {
    fontSize: Typography.xxl,
    fontFamily: Typography.family.bold,
  },
  rootCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  cardIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardContent: { flex: 1, gap: 4 },
  cardTitle: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  cardSubtitle: { fontSize: Typography.xs, lineHeight: 18 },
  pillRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  miniPillText: { fontSize: 10, fontFamily: Typography.family.semibold },
});
