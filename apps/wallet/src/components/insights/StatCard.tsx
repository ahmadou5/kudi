import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useAppPalette, hexToRgba } from '../../lib/theme';
import { Typography } from '../../constants/typography';

interface StatCardProps {
  label: string;
  value: string;
  caption?: string;
  /** Accent for the icon chip + value text. Defaults to palette.text. */
  color?: string;
  icon: LucideIcon;
  /** Flex weight in the stats row — lets the Net card grow wider. */
  flex?: number;
}

export function StatCard({ label, value, caption, color, icon: Icon, flex = 1 }: StatCardProps) {
  const palette = useAppPalette();
  const accent = color || palette.text;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border, flex }
      ]}
    >
      <View style={[styles.iconChip, { backgroundColor: hexToRgba(accent, palette.scheme === 'dark' ? 0.16 : 0.12) }]}>
        <Icon size={14} color={accent} strokeWidth={2.2} />
      </View>
      <Text style={[Typography.caption, { color: hexToRgba(palette.text, 0.5) }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[Typography.currencySub, { color: accent, fontSize: 15 }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {!!caption && (
        <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.4), fontSize: 10 }]} numberOfLines={1}>
          {caption}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 5,
    alignItems: 'flex-start'
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  }
});
