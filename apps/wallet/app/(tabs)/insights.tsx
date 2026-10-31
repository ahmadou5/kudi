import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDot,
  Landmark,
  Rocket,
  TrendingDown,
  TrendingUp,
  Wallet
} from 'lucide-react-native';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { useTransactions } from '../../src/hooks/useTransactions';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { mapApiTransactions } from '../../src/utils/transactionMapper';
import {
  computeActivityStats,
  formatNgnApprox,
  formatUsd,
  formatUsdCompact,
  RANGES,
  RangeId
} from '../../src/utils/activityStats';
import { StatCard } from '../../src/components/insights/StatCard';
import { BreakdownRow } from '../../src/components/insights/BreakdownRow';
import { InOutBarChart } from '../../src/components/insights/InOutBarChart';
import { AnimatedSkeleton } from '../../src/components/ui/AnimatedSkeleton';
import { ActivityEmptyState } from '../../src/components/ActivityEmptyState';
import { EnterSection } from '../../src/lib/animations';
import { haptics } from '../../src/lib/haptics';

const CATEGORY_ICONS = {
  deposit: Wallet,
  send: Rocket,
  payout: Landmark
} as const;

const CHAIN_ICONS: Record<string, typeof CircleDot> = {
  solana: CircleDot,
  monad: Rocket,
  other: CircleDot
};

function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const palette = useAppPalette();
  return (
    <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      {!!title && (
        <Text style={[Typography.title3, { color: palette.text, marginBottom: 2 }]}>{title}</Text>
      )}
      {children}
    </View>
  );
}

function InsightsSkeleton() {
  const palette = useAppPalette();
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.statsRow}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[styles.statSkeleton, { backgroundColor: palette.card, borderColor: palette.border }]}
          >
            <AnimatedSkeleton width={28} height={28} borderRadius={10} />
            <AnimatedSkeleton width={54} height={9} borderRadius={4} />
            <AnimatedSkeleton width={72} height={13} borderRadius={4} />
          </View>
        ))}
      </View>
      <View style={[styles.chartSkeleton, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <AnimatedSkeleton width="40%" height={12} borderRadius={4} />
        <AnimatedSkeleton width="100%" height={140} borderRadius={14} />
      </View>
      <View style={[styles.breakSkeleton, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ gap: 8 }}>
            <AnimatedSkeleton width="55%" height={12} borderRadius={4} />
            <AnimatedSkeleton width="100%" height={6} borderRadius={3} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function InsightsTab() {
  const palette = useAppPalette();
  const [range, setRange] = useState<RangeId>('30d');
  const { data: apiTxs, isLoading, refetch, isRefetching } = useTransactions(200);
  const { userId, rateNGN } = useKudiWallet();

  const mapped = useMemo(
    () => mapApiTransactions(apiTxs, userId, rateNGN),
    [apiTxs, userId, rateNGN]
  );

  const stats = useMemo(() => computeActivityStats(mapped, range), [mapped, range]);

  const selectRange = (id: RangeId) => {
    if (id === range) return;
    haptics.tap();
    setRange(id);
  };

  const net = stats.summary.net;
  const netColor = net > 0 ? palette.success : net < 0 ? palette.error : palette.text;
  const NetIcon = net >= 0 ? TrendingUp : TrendingDown;
  const rangeLabel = RANGES.find((r) => r.id === range)?.label || '';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingTop: 12, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => refetch()}
          tintColor={palette.text}
          colors={[palette.primary]}
        />
      }
    >
      <EnterSection index={0}>
        <Text style={[Typography.title1, { color: palette.text }]}>Insights</Text>
        <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.5), marginTop: 2, fontSize: 10 }]}>
          Your money flow, over time
        </Text>
      </EnterSection>

      {/* Range chips */}
      <EnterSection index={1} style={styles.rangeWrap}>
        <View style={styles.rangeRow}>
          {RANGES.map((r) => {
            const selected = range === r.id;
            return (
              <Pressable
                key={r.id}
                onPress={() => selectRange(r.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Range: ${r.label}`}
                style={({ pressed }) => [
                  styles.rangeChip,
                  selected
                    ? { backgroundColor: palette.text, borderColor: palette.text }
                    : { backgroundColor: palette.card, borderColor: palette.border },
                  pressed && { opacity: 0.75 }
                ]}
              >
                <Text
                  style={[
                    Typography.currencySub,
                    { fontSize: 12, color: selected ? palette.bg : palette.text }
                  ]}
                >
                  {r.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </EnterSection>

      {isLoading && mapped.length === 0 ? (
        <EnterSection index={2} style={{ marginTop: 16 }}>
          <InsightsSkeleton />
        </EnterSection>
      ) : mapped.length === 0 ? (
        <EnterSection index={2} style={{ marginTop: 24 }}>
          <ActivityEmptyState
            title="No activity yet"
            body="Once your first deposit, send or payout settles, your money-flow breakdown shows up here."
            primaryLabel="Go to Home"
            onPrimary={() => router.push('/(tabs)')}
            secondaryLabel="Refresh"
            onSecondary={() => refetch()}
          />
        </EnterSection>
      ) : (
        <>
          {/* Stat cards */}
          <EnterSection index={2} style={{ marginTop: 16 }}>
            <View style={styles.statsRow}>
              <StatCard
                label="In"
                value={formatUsdCompact(stats.summary.totalIn)}
                caption={formatNgnApprox(stats.summary.totalIn, rateNGN)}
                color={palette.success}
                icon={ArrowDownLeft}
              />
              <StatCard
                label="Out"
                value={formatUsdCompact(stats.summary.totalOut)}
                caption={formatNgnApprox(stats.summary.totalOut, rateNGN)}
                color={palette.error}
                icon={ArrowUpRight}
              />
              <StatCard
                label="Net"
                value={`${net < 0 ? '-' : net > 0 ? '+' : ''}${formatUsdCompact(net)}`}
                caption={`${stats.summary.count} tx${stats.summary.count === 1 ? '' : 's'}`}
                color={netColor}
                icon={NetIcon}
                flex={1.15}
              />
            </View>
          </EnterSection>

          {/* Flow chart */}
          <EnterSection index={3} style={{ marginTop: 12 }}>
            <SectionCard title="Money flow">
              <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.45), fontSize: 12, marginBottom: 10 }]}>
                {stats.emptyInRange
                  ? `No transactions in the last ${rangeLabel}`
                  : `Deposits vs withdrawals · last ${rangeLabel}`}
              </Text>
              <InOutBarChart data={stats.buckets} />
            </SectionCard>
          </EnterSection>

          {/* Category split */}
          {stats.byCategory.length > 0 && (
            <EnterSection index={4} style={{ marginTop: 12 }}>
              <SectionCard title="By category">
                <View style={styles.breakdownList}>
                  {stats.byCategory.map((row) => (
                    <BreakdownRow
                      key={row.key}
                      label={row.label}
                      subLabel={`${row.count} tx${row.count === 1 ? '' : 's'} · ${row.subLabel}`}
                      amountLabel={formatUsd(row.volume)}
                      pct={row.pct}
                      color={
                        row.key === 'deposit'
                          ? palette.success
                          : row.key === 'send'
                            ? palette.primary
                            : palette.error
                      }
                      icon={CATEGORY_ICONS[row.key as keyof typeof CATEGORY_ICONS] || Wallet}
                    />
                  ))}
                </View>
              </SectionCard>
            </EnterSection>
          )}

          {/* Chain split */}
          {stats.byChain.length > 0 && (
            <EnterSection index={5} style={{ marginTop: 12 }}>
              <SectionCard title="By network">
                <View style={styles.breakdownList}>
                  {stats.byChain.map((row) => (
                    <BreakdownRow
                      key={row.key}
                      label={row.label}
                      subLabel={`${row.count} tx${row.count === 1 ? '' : 's'}${row.subLabel ? ` · ${row.subLabel}` : ''}`}
                      amountLabel={formatUsd(row.volume)}
                      pct={row.pct}
                      color={row.key === 'monad' ? palette.primary : palette.accent}
                      icon={CHAIN_ICONS[row.key] || CircleDot}
                    />
                  ))}
                </View>
              </SectionCard>
            </EnterSection>
          )}

          {/* Top days */}
          {stats.topDays.length > 0 && (
            <EnterSection index={6} style={{ marginTop: 12 }}>
              <SectionCard title="Busiest days">
                <View style={styles.topDaysList}>
                  {stats.topDays.map((day, i) => (
                    <View
                      key={day.key}
                      style={[
                        styles.topDayRow,
                        i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: hexToRgba(palette.text, 0.1) }
                      ]}
                    >
                      <View style={[styles.rankChip, { backgroundColor: hexToRgba(palette.text, 0.07) }]}>
                        <CalendarDays size={13} color={hexToRgba(palette.text, 0.6)} />
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 13 }]} numberOfLines={1}>
                          {day.label}
                        </Text>
                        <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.45), fontSize: 11 }]}>
                          {day.count} tx{day.count === 1 ? '' : 's'}
                          {day.deposits > 0 ? ` · +${formatUsdCompact(day.deposits)}` : ''}
                          {day.withdrawals > 0 ? ` · -${formatUsdCompact(day.withdrawals)}` : ''}
                        </Text>
                      </View>
                      <Text style={[Typography.currencySub, { color: palette.text, fontSize: 13 }]}>
                        {formatUsdCompact(day.volume)}
                      </Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            </EnterSection>
          )}

          {/* Summary footer */}
          <EnterSection index={7} style={{ marginTop: 12 }}>
            <View style={[styles.summaryPill, { borderColor: palette.border, backgroundColor: hexToRgba(palette.text, 0.04) }]}>
              {net >= 0 ? (
                <TrendingUp size={13} color={palette.success} />
              ) : (
                <TrendingDown size={13} color={palette.error} />
              )}
              <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.55), flex: 1, fontSize: 12 }]}>
                {stats.emptyInRange
                  ? 'No settled activity in this window.'
                  : `Avg ${formatUsd(stats.summary.avgPerTx)} per tx · Net ${net >= 0 ? '+' : '-'}${formatUsd(net)} over ${rangeLabel}`}
              </Text>
            </View>
          </EnterSection>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  rangeWrap: { marginTop: 14 },
  rangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  rangeChip: {
    flex: 1,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8
  },
  statSkeleton: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    gap: 8
  },
  chartSkeleton: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 12
  },
  breakSkeleton: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 16
  },
  sectionCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10
  },
  breakdownList: {
    gap: 14,
    marginTop: 4
  },
  topDaysList: {
    gap: 0,
    marginTop: 2
  },
  topDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11
  },
  rankChip: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 11
  }
});
