import React from 'react';
import { StyleSheet, Text, View, ViewStyle, StyleProp } from 'react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';

export interface SummaryRow {
  label: string;
  value: React.ReactNode;
  /** Emphasised row (used for "Total debit"). */
  total?: boolean;
}

interface SummaryCardProps {
  rows: SummaryRow[];
  style?: StyleProp<ViewStyle>;
}

/** Light-blue info card with a heavy bottom edge, used for rates / fees / totals. */
export const SummaryCard: React.FC<SummaryCardProps> = ({ rows, style }) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? 'rgba(59,130,246,0.10)' : '#EAF2FE',
          borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#D3E3FA',
          borderBottomColor: isDark ? '#3B82F6' : '#1E3A5F',
        },
        style,
      ]}
    >
      {rows.map((row, idx) => {
        const isTotal = !!row.total;
        const showDivider = isTotal && idx > 0;
        return (
          <View
            key={`${row.label}-${idx}`}
            style={[
              styles.row,
              showDivider && [styles.totalRow, { borderTopColor: palette.border }],
            ]}
          >
            <Text
              style={[
                isTotal ? styles.totalLabel : Typography.body,
                { color: isTotal ? palette.text : palette.textSecondary },
              ]}
            >
              {row.label}
            </Text>
            {typeof row.value === 'string' || typeof row.value === 'number' ? (
              <Text
                style={[
                  isTotal ? styles.totalValue : styles.value,
                  { color: palette.text },
                ]}
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
    borderRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 3,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  totalRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  value: {
    fontFamily: Typography.family.sans,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  totalLabel: {
    fontFamily: Typography.family.sans,
    fontSize: 16,
    fontWeight: '700',
  },
  totalValue: {
    fontFamily: Typography.family.sans,
    fontSize: 16,
    fontWeight: '700',
  },
});
