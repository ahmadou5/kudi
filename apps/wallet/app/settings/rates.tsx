import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, RefreshCw, TriangleAlert } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { AnimatedSkeleton } from '../../src/components/ui/AnimatedSkeleton';
import { useMajorFxRates, CurrencyRate } from '../../src/hooks/useMajorFxRates';
import { MAJOR_CURRENCIES } from '../../src/constants/currencies';
import { EnterSection } from '../../src/lib/animations';

/** ₦ per unit, grouped, always 2 decimals — e.g. ₦1,585.50 */
const formatNaira = (value: number) =>
  `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Inverse rate — ₦1 buys e.g. 0.000631 USD */
const formatPerNaira = (rate: number) => {
  const inverse = 1 / rate;
  const text = inverse >= 0.01 ? inverse.toFixed(4) : Number(inverse.toPrecision(3)).toString();
  return text;
};

const formatAge = (date: Date) => {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
};

function RateRow({
  rate,
  palette,
  showDivider
}: {
  rate: CurrencyRate;
  palette: any;
  showDivider: boolean;
}) {
  return (
    <>
      {showDivider && <View style={[styles.divider, { backgroundColor: palette.border }]} />}
      <View style={styles.rateRow}>
        <View style={[styles.flagTile, { backgroundColor: hexToRgba(palette.text, 0.07) }]}>
          <Text style={styles.flag}>{rate.flag}</Text>
        </View>

        <View style={styles.rateCopy}>
          <Text style={[Typography.currencySub, { color: palette.text }]} numberOfLines={1}>
            {rate.code}
          </Text>
          <Text
            style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.5), fontSize: 10 }]}
            numberOfLines={1}
          >
            {rate.name}
          </Text>
        </View>

        <View style={styles.rateValues}>
          <Text style={[Typography.currencySub, { color: palette.text }]} numberOfLines={1}>
            {formatNaira(rate.rate)}
          </Text>
          <Text
            style={[
              Typography.footnote,
              { color: hexToRgba(palette.text, 0.45), fontSize: 10, textAlign: 'right' }
            ]}
            numberOfLines={1}
          >
            ₦1 = {formatPerNaira(rate.rate)} {rate.code}
          </Text>
        </View>
      </View>
    </>
  );
}

export default function SettingsRatesScreen() {
  const palette = useAppPalette();
  const { data, isLoading, isError, refetch, isRefetching } = useMajorFxRates();

  const usd = data?.find((rate) => rate.code === 'USD');
  const stale = !!usd?.isStale;
  const liveColor = stale ? palette.warning : palette.success;
  const labelColor = hexToRgba(palette.text, 0.45);
  const tileTint = hexToRgba(palette.text, 0.07);

  const renderHero = () => {
    if (!usd) {
      return (
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <AnimatedSkeleton width={90} height={11} borderRadius={4} />
          <AnimatedSkeleton width={170} height={30} borderRadius={6} style={{ marginTop: 14 }} />
          <AnimatedSkeleton width={120} height={12} borderRadius={4} style={{ marginTop: 12 }} />
        </View>
      );
    }

    return (
      <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.heroTop}>
          <Text style={[Typography.caption, { color: labelColor }]}>USD / NGN</Text>
          <View style={[styles.livePill, { backgroundColor: hexToRgba(liveColor, 0.14) }]}>
            <View style={[styles.liveDot, { backgroundColor: liveColor }]} />
            <Text style={[Typography.caption, { color: liveColor, letterSpacing: 1.1 }]}>
              {stale ? 'Stale' : 'Live'}
            </Text>
          </View>
        </View>

        <Text style={[Typography.currencyDisplay, { color: palette.text, marginTop: 10 }]}>
          {formatNaira(usd.rate)}
        </Text>

        <View style={styles.heroBottom}>
          <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
            ₦1 = {formatPerNaira(usd.rate)} USD
          </Text>
          <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.35) }]}>
            Updated {formatAge(new Date(usd.updatedAt))}
          </Text>
        </View>
      </View>
    );
  };

  const renderList = () => {
    if (isLoading && !data) {
      return (
        <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {MAJOR_CURRENCIES.map((currency, index) => (
            <View
              key={currency.code}
              style={[styles.rateRow, index > 0 && { borderTopWidth: 1, borderTopColor: palette.border }]}
            >
              <AnimatedSkeleton width={40} height={40} borderRadius={12} />
              <View style={styles.rateCopy}>
                <AnimatedSkeleton width={46} height={14} borderRadius={4} />
                <AnimatedSkeleton width={86} height={10} borderRadius={4} />
              </View>
              <View style={styles.rateValues}>
                <AnimatedSkeleton width={78} height={14} borderRadius={4} />
                <AnimatedSkeleton width={96} height={10} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      );
    }

    if (isError && !data) {
      return (
        <View style={[styles.errorCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.errorIcon, { backgroundColor: tileTint }]}>
            <TriangleAlert size={22} color={palette.warning} strokeWidth={1.9} />
          </View>
          <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 4 }]}>
            Rates unavailable
          </Text>
          <Text
            style={[
              Typography.footnote,
              { color: hexToRgba(palette.text, 0.5), textAlign: 'center', maxWidth: 260 }
            ]}
          >
            We couldn't reach the FX engine. Check your connection and try again.
          </Text>
          <Pressable
            onPress={() => refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              { backgroundColor: palette.text, borderColor: palette.text },
              pressed && { opacity: 0.8 }
            ]}
          >
            <RefreshCw size={14} color={palette.bg} strokeWidth={2.2} />
            <Text style={[Typography.currencySub, { color: palette.bg, fontSize: 12 }]}>
              {isRefetching ? 'Refreshing…' : 'Retry'}
            </Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {(data || []).map((rate, index) => (
          <RateRow
            key={rate.code}
            rate={rate}
            palette={palette}
            showDivider={index > 0}
          />
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibility-label="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.6 }
          ]}
        >
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[Typography.title1, { color: palette.text }]}>Exchange rates</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => refetch()}
            tintColor={palette.text}
            colors={[palette.text]}
          />
        }
      >
        <EnterSection index={0}>{renderHero()}</EnterSection>

        <EnterSection index={1} style={styles.group}>
          <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>
            Naira to major currencies
          </Text>
          {renderList()}
        </EnterSection>

        <EnterSection index={2}>
          <Text style={[styles.footnote, { color: hexToRgba(palette.text, 0.4) }]}>
            Indicative mid-market rates, refreshed every minute. Conversions inside the app settle at
            the live engine rate.
          </Text>
        </EnterSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 20
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10
  },
  group: { gap: 8 },
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  divider: {
    height: 1,
    marginLeft: 66
  },
  flagTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  flag: {
    fontSize: 19,
    lineHeight: 22
  },
  rateCopy: { flex: 1, gap: 2 },
  rateValues: { gap: 2, alignItems: 'flex-end' },
  errorCard: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingHorizontal: 20,
    height: 42,
    borderRadius: 14,
    borderWidth: 1
  },
  footnote: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4
  }
});
