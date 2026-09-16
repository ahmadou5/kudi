import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, Image } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';

interface RailSelectorCardProps {
  onSelectOffchain: () => void;
  onSelectOnchain: () => void;
}

export const RailSelectorCard: React.FC<RailSelectorCardProps> = ({
  onSelectOffchain,
  onSelectOnchain,
}) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';

  const renderBgPattern = (color: string) => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.ring1, { borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)' }]} />
      <View style={[styles.ring2, { borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)' }]} />
      <View style={[styles.glow, { backgroundColor: color, opacity: isDark ? 0.1 : 0.06 }]} />
    </View>
  );

  return (
    <View style={styles.stack}>
      {/* Off-Chain Bank & Inter-App Transfer Card */}
      <TouchableOpacity
        onPress={onSelectOffchain}
        activeOpacity={0.85}
        style={[styles.choiceCard, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        {renderBgPattern('#34D399')}
        <View style={styles.choiceTop}>
          <View style={styles.choiceBadgesRow}>
            {['₦', '$', '€'].map((sym) => (
              <View key={sym} style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 13 }]}>{sym}</Text>
              </View>
            ))}
          </View>
          <ChevronRight size={20} color={palette.textSecondary} />
        </View>
        <Text style={[Typography.title2, { color: palette.text, marginTop: 14 }]}>Bank Transfer</Text>
        <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          Send NGN directly to any Nigerian bank account (NUBAN) or transfer instantly to Kudi users via handle.
        </Text>
      </TouchableOpacity>

      {/* On-Chain Transfer Card */}
      <TouchableOpacity
        onPress={onSelectOnchain}
        activeOpacity={0.85}
        style={[styles.choiceCard, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        {renderBgPattern('#9945FF')}
        <View style={styles.choiceTop}>
          <View style={styles.choiceBadgesRow}>
            <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
              <Image source={require('../../assets/logos/usdc.png')} style={styles.miniLogo} />
              <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>USDC</Text>
            </View>
            <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
              <Image source={require('../../assets/logos/ausd.png')} style={styles.miniLogo} />
              <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>AUSD</Text>
            </View>
            <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
              <Image source={require('../../assets/logos/ngnc.png')} style={styles.miniLogo} />
              <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>NGNC</Text>
            </View>
          </View>
          <ChevronRight size={20} color={palette.textSecondary} />
        </View>
        <Text style={[Typography.title2, { color: palette.text, marginTop: 14 }]}>On-Chain Transfer</Text>
        <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          Send USDC, AUSD, or NGNC directly to external crypto wallet addresses on Solana or Monad networks.
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: 14 },
  choiceCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  ring1: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
  },
  ring2: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
  },
  glow: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  choiceTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  choiceBadgesRow: {
    flexDirection: 'row',
    gap: 8,
  },
  assetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 6,
  },
  miniLogo: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
});
