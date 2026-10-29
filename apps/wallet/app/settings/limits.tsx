import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowUpCircle, Check, Info, ShieldCheck } from 'lucide-react-native';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { useAuthStore } from '../../src/store/auth.store';
import { SafeAreaView } from 'react-native-safe-area-context';
import { EnterSection } from '../../src/lib/animations';
import { haptics } from '../../src/lib/haptics';

export default function SpendingLimitsScreen() {
  const palette = useAppPalette();
  const user = useAuthStore((s) => s.user);

  const rawTier = user?.kycTier;
  const tier =
    rawTier === '2' || rawTier === 'TIER_2'
      ? 2
      : rawTier === '1' || rawTier === 'TIER_1' || user?.kycStatus === 'VERIFIED'
        ? 1
        : 0;

  const tiers = [
    {
      level: 0,
      name: 'Unverified',
      dailyLimit: '₦0',
      singleLimit: '₦0',
      requirements: 'Initial registration'
    },
    {
      level: 1,
      name: 'Tier 1 (Basic)',
      dailyLimit: '₦50,000',
      singleLimit: '₦200,000',
      requirements: 'BVN / NIN Verification'
    },
    {
      level: 2,
      name: 'Tier 2 (Pro)',
      dailyLimit: '₦5,000,000',
      singleLimit: '₦2,000,000',
      requirements: 'ID Document & Address Proof'
    }
  ];

  const currentTierInfo = tiers.find((t) => t.level === tier) || tiers[0];
  const tileTint = hexToRgba(palette.text, 0.07);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Header */}
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
        <Text style={[Typography.title1, { color: palette.text }]}>Spending Limits</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Current tier hero ── */}
        <EnterSection index={0}>
          <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.heroHeader}>
              <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                <ShieldCheck size={22} color={palette.textSecondary} strokeWidth={1.9} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: hexToRgba(palette.text, 0.45) }]}>
                  CURRENT ACCOUNT TIER
                </Text>
                <Text style={[Typography.title2, { color: palette.text, marginTop: 2 }]}>
                  {currentTierInfo.name}
                </Text>
              </View>
              <View style={[styles.activePill, { backgroundColor: hexToRgba(palette.success, 0.14) }]}>
                <Text style={[Typography.footnote, { color: palette.success, fontWeight: '700' }]}>
                  ACTIVE
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={[styles.fieldLabel, { color: hexToRgba(palette.text, 0.45) }]}>
                  NGN DAILY LIMIT
                </Text>
                <Text style={[Typography.title3, { color: palette.text, marginTop: 4 }]}>
                  {currentTierInfo.dailyLimit}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
              <View style={styles.statBox}>
                <Text style={[styles.fieldLabel, { color: hexToRgba(palette.text, 0.45) }]}>
                  MAX PER TX
                </Text>
                <Text style={[Typography.title3, { color: palette.text, marginTop: 4 }]}>
                  {currentTierInfo.singleLimit}
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: palette.border }]} />

            <View style={styles.tierDetailRow}>
              <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                Crypto / On-chain Sends
              </Text>
              <Text style={[Typography.currencySub, { color: palette.success }]}>No daily limit</Text>
            </View>

            {tier < 2 && (
              <Pressable
                onPress={() => {
                  haptics.tap();
                  router.push('/kyc');
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: palette.text },
                  pressed && { opacity: 0.9 }
                ]}
              >
                <ArrowUpCircle size={18} color={palette.bg} />
                <Text style={[Typography.currencySub, { color: palette.bg }]}>
                  Upgrade Tier & Limits
                </Text>
              </Pressable>
            )}
          </View>
        </EnterSection>

        {/* ── Tier breakdown ── */}
        <EnterSection index={1}>
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>
              NGN / FIAT TIER LEVELS
            </Text>
            {tiers.map((t) => {
              const active = t.level === tier;
              return (
                <View
                  key={t.level}
                  style={[
                    styles.tierCard,
                    {
                      backgroundColor: palette.card,
                      borderColor: active ? palette.text : palette.border,
                      borderWidth: active ? 1.5 : 1
                    }
                  ]}
                >
                  <View style={styles.tierHeader}>
                    <Text style={[Typography.currencySub, { color: palette.text }]}>{t.name}</Text>
                    {active ? (
                      <View
                        style={[styles.yourTierPill, { backgroundColor: hexToRgba(palette.success, 0.14) }]}
                      >
                        <Check size={12} color={palette.success} strokeWidth={2.5} />
                        <Text style={[Typography.footnote, { color: palette.success, fontWeight: '700' }]}>
                          Your Tier
                        </Text>
                      </View>
                    ) : (
                      <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.4) }]}>
                        Tier {t.level}
                      </Text>
                    )}
                  </View>

                  <View style={[styles.divider, { backgroundColor: palette.border }]} />

                  <View style={styles.tierDetailRow}>
                    <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                      NGN Daily Limit
                    </Text>
                    <Text style={[Typography.currencySub, { color: palette.text }]}>{t.dailyLimit}</Text>
                  </View>
                  <View style={styles.tierDetailRow}>
                    <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                      Per Tx Limit
                    </Text>
                    <Text style={[Typography.currencySub, { color: palette.text }]}>{t.singleLimit}</Text>
                  </View>
                  <View style={styles.tierDetailRow}>
                    <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                      Requirements
                    </Text>
                    <Text
                      style={[Typography.footnote, { color: hexToRgba(palette.text, 0.7), flexShrink: 1, textAlign: 'right' }]}
                    >
                      {t.requirements}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </EnterSection>

        {/* ── Regulatory note ── */}
        <EnterSection index={2}>
          <View style={[styles.infoRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Info size={17} color={palette.textSecondary} strokeWidth={1.9} />
            <Text
              style={[
                Typography.footnote,
                { color: hexToRgba(palette.text, 0.55), flex: 1, lineHeight: 18 }
              ]}
            >
              NGN spending limits apply to bank transfers, bills, and in-app
              transfers in accordance with CBN regulatory guidelines. Crypto and
              on-chain sends are not subject to daily limits — you can spend your
              crypto balance regardless of verification tier.
            </Text>
          </View>
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
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase'
  },
  activePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  divider: {
    height: 1
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'stretch'
  },
  statBox: {
    flex: 1
  },
  statDivider: {
    width: 1,
    marginHorizontal: 16
  },
  primaryBtn: {
    height: 50,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  group: { gap: 12 },
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
    marginBottom: -4
  },
  tierCard: {
    padding: 16,
    borderRadius: 20,
    gap: 10
  },
  tierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  yourTierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  tierDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12
  },
  infoRow: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    alignItems: 'flex-start'
  }
});
