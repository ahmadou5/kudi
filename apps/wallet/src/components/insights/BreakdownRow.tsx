import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LucideIcon } from 'lucide-react-native';
import { useAppPalette, hexToRgba } from '../../lib/theme';
import { Typography } from '../../constants/typography';

interface BreakdownRowProps {
  label: string;
  subLabel?: string;
  amountLabel: string;
  /** Share of total volume, 0–100. */
  pct: number;
  /** Progress-bar fill color. */
  color: string;
  icon?: LucideIcon;
}

export function BreakdownRow({ label, subLabel, amountLabel, pct, color, icon: Icon }: BreakdownRowProps) {
  const palette = useAppPalette();
  const clamped = Math.max(0, Math.min(100, pct));

  return (
    <View style={styles.row}>
      <View style={styles.topRow}>
        <View style={styles.leftGroup}>
          {Icon && (
            <View style={[styles.iconChip, { backgroundColor: hexToRgba(color, palette.scheme === 'dark' ? 0.16 : 0.12) }]}>
              <Icon size={13} color={color} strokeWidth={2.2} />
            </View>
          )}
          <View style={styles.labelStack}>
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 13 }]} numberOfLines={1}>
              {label}
            </Text>
            {!!subLabel && (
              <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.45), fontSize: 10 }]} numberOfLines={1}>
                {subLabel}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.rightGroup}>
          <Text style={[Typography.currencySub, { color: palette.text, fontSize: 13 }]} numberOfLines={1}>
            {amountLabel}
          </Text>
          <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.45), fontSize: 10 }]}>
            {pct >= 1 && pct < 100 ? `${Math.round(pct)}%` : pct >= 100 ? '100%' : '0%'}
          </Text>
        </View>
      </View>

      <View style={[styles.track, { backgroundColor: hexToRgba(palette.text, 0.08) }]}>
        <View
          style={[
            styles.fill,
            {
              backgroundColor: color,
              width: `${clamped}%`
            }
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: 8
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 6
  },
  iconChip: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  labelStack: {
    flex: 1,
    gap: 1
  },
  rightGroup: {
    alignItems: 'flex-end',
    gap: 1
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden'
  },
  fill: {
    height: '100%',
    borderRadius: 3
  }
});
