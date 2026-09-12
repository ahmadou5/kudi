import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ShieldCheck, ArrowUpCircle, Info } from 'lucide-react-native';
import { useAppPalette, isLight } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { useAuthStore } from '../../store/auth.store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SpendingLimitsScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const light = isLight(palette.bg);
  const user = useAuthStore(s => s.user);

  const rawTier = user?.kycTier;
  const tier = rawTier === '2' || rawTier === 'TIER_2' ? 2 : rawTier === '1' || rawTier === 'TIER_1' || user?.kycStatus === 'VERIFIED' ? 1 : 0;

  const tiers = [
    {
      level: 0,
      name: 'Unverified',
      dailyLimit: '₦0',
      singleLimit: '₦0',
      requirements: 'Initial registration',
      active: tier === 0
    },
    {
      level: 1,
      name: 'Tier 1 (Basic)',
      dailyLimit: '₦500,000',
      singleLimit: '₦200,000',
      requirements: 'BVN / NIN Verification',
      active: tier === 1
    },
    {
      level: 2,
      name: 'Tier 2 (Pro)',
      dailyLimit: '₦5,000,000',
      singleLimit: '₦2,000,000',
      requirements: 'ID Document & Address Proof',
      active: tier === 2
    }
  ];

  const currentTierInfo = tiers.find(t => t.level === tier) || tiers[0];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Spending Limits</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Current Tier Overview Banner */}
        <View style={[styles.bannerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.bannerHeader}>
            <View style={[styles.badgeIcon, { backgroundColor: '#6366F120' }]}>
              <ShieldCheck size={24} color="#6366F1" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>CURRENT ACCOUNT TIER</Text>
              <Text style={[Typography.title2, { color: palette.text, marginTop: 2 }]}>
                {currentTierInfo.name}
              </Text>
            </View>
            <View style={[styles.activeTag, { backgroundColor: '#10B98120' }]}>
              <Text style={[Typography.caption, { color: '#10B981', fontWeight: '700' }]}>ACTIVE</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>Daily Limit</Text>
              <Text style={[Typography.title3, { color: palette.text, marginTop: 4, fontWeight: '700' }]}>
                {currentTierInfo.dailyLimit}
              </Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>Max Per Tx</Text>
              <Text style={[Typography.title3, { color: palette.text, marginTop: 4, fontWeight: '700' }]}>
                {currentTierInfo.singleLimit}
              </Text>
            </View>
          </View>

          {tier < 2 && (
            <TouchableOpacity
              style={[styles.upgradeBtn, { backgroundColor: palette.primary }]}
              onPress={() => router.push('/kyc')}
              activeOpacity={0.85}
            >
              <ArrowUpCircle size={18} color={light ? '#FFFFFF' : '#0F172A'} />
              <Text style={[Typography.bodyBold, { color: light ? '#FFFFFF' : '#0F172A', marginLeft: 8 }]}>
                Upgrade Tier & Limits
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tier Breakdown Table */}
        <Text style={[Typography.title3, { color: palette.text, marginTop: 24, marginBottom: 12 }]}>
          Tier Levels & Thresholds
        </Text>

        {tiers.map((t) => (
          <View
            key={t.level}
            style={[
              styles.tierCard,
              {
                backgroundColor: palette.card,
                borderColor: t.active ? palette.primary : palette.border,
                borderWidth: t.active ? 2 : 1
              }
            ]}
          >
            <View style={styles.tierCardHeader}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>{t.name}</Text>
              {t.active ? (
                <View style={[styles.currentPill, { backgroundColor: 'rgba(99, 102, 241, 0.18)' }]}>
                  <Text style={[Typography.caption, { color: '#6366F1', fontWeight: '700' }]}>Your Tier</Text>
                </View>
              ) : (
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>Tier {t.level}</Text>
              )}
            </View>

            <View style={styles.tierDetailRow}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>Daily Limit</Text>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>{t.dailyLimit}</Text>
            </View>

            <View style={styles.tierDetailRow}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>Per Tx Limit</Text>
              <Text style={[Typography.subhead, { color: palette.text }]}>{t.singleLimit}</Text>
            </View>

            <View style={styles.tierDetailRow}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>Requirements</Text>
              <Text style={[Typography.caption, { color: palette.textSecondary, fontWeight: '500' }]}>
                {t.requirements}
              </Text>
            </View>
          </View>
        ))}

        {/* Informational Footer */}
        <View style={[styles.infoBox, { backgroundColor: light ? '#F3F4F6' : '#1F2937' }]}>
          <Info size={20} color={palette.textSecondary} />
          <Text style={[Typography.caption, { color: palette.textSecondary, flex: 1, marginLeft: 8, lineHeight: 18 }]}>
            Spending limits are enforced in accordance with CBN regulatory guidelines to ensure safety and security on all off-ramp bank transfers.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  bannerCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  badgeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  activeTag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  divider: {
    height: 1,
    marginVertical: 16
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  statBox: {
    flex: 1
  },
  upgradeBtn: {
    marginTop: 18,
    height: 46,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tierCard: {
    padding: 16,
    borderRadius: 14,
    marginBottom: 12
  },
  tierCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  currentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8
  },
  tierDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6
  },
  infoBox: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'flex-start'
  }
});
