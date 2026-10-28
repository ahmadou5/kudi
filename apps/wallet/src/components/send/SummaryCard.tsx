import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';

interface SummaryRow {
  label: string;
  value: React.ReactNode;
  /** Emphasised row (used for "Total debit"). */
  total?: boolean;
}

interface SummaryCardProps {
  rows: SummaryRow[];
  style?: StyleProp<ViewStyle>;
}

/** Neutral rate/fee/total card: hairline row dividers, mono money, no competing accent. */
export const SummaryCard: React.FC<SummaryCardProps> = ({ rows, style }) => {
  const palette = useAppPalette();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: palette.card, borderColor: palette.border },
        style,
      ]}
    >
      {rows.map((row, idx) => {
        const isTotal = !!row.total;
        return (
          <View
            key={`${row.label}-${idx}`}
            style={[
              styles.row,
              idx > 0 && [styles.divider, { borderTopColor: palette.border }],
              isTotal && styles.totalRow,
            ]}
          >
            <Text
              style={[
                isTotal ? styles.totalLabel : styles.label,
                { color: isTotal ? palette.text : palette.textSecondary },
              ]}
            >
              {row.label}
            </Text>
            {typeof row.value === 'string' || typeof row.value === 'number' ? (
              <Text
                style={[isTotal ? styles.totalValue : styles.value, { color: palette.text }]}
                numberOfLines={1}
              >
                {row.value}
              </Text>
            ) : (
              row.value
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 0,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 7,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
  },
  totalRow: {
    paddingTop: 14,
  },
  label: {
    fontFamily: Typography.family.mono,
    fontSize: 13,
    flexShrink: 1,
  },
  value: {
    fontFamily: Typography.family.mono,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  totalLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 15,

  },
  totalValue: {
    fontFamily: Typography.family.mono,
    fontSize: 15,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
