import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette, isLight } from '../lib/theme';
import { useAuthStore, AuthState } from '../store/auth.store';
import { Typography } from '../constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppModal, useAppModal } from '../components/ui/AppModal';
import { ChainLogo } from '../components/ui/ChainLogo';
import * as Clipboard from 'expo-clipboard';

export default function ProfileScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const light = isLight(palette.bg);
  const user = useAuthStore((s: AuthState) => s.user);
  const wallets = useAuthStore((s: AuthState) => s.wallets);
  const pin = useAuthStore((s: AuthState) => s.pin);
  const logout = useAuthStore((s: AuthState) => s.logout);
  const isDark = palette.text === '#FFFFFF';

  const solanaAddress = wallets.find(w => w.chain === 'solana')?.address || 'Solana Address Loading...';
  const monadAddress = wallets.find(w => w.chain.includes('monad'))?.address || 'Monad Address Loading...';

  const userEmail = user?.email || 'authenticated.user@kudi.app';
  const fullName = user?.fullName || '';
  const username = user?.username || (userEmail ? `@${userEmail.split('@')[0]}` : '');
  const userDisplayName = fullName || username || userEmail.split('@')[0] || 'Kudi User';

  const rawTier = user?.kycTier;
  const kycTierNum = rawTier === '2' || rawTier === 'TIER_2' ? 2 : rawTier === '1' || rawTier === 'TIER_1' || user?.kycStatus === 'VERIFIED' ? 1 : 0;
  const kycTierLabel = kycTierNum === 2 ? 'Tier 2 (Pro)' : kycTierNum === 1 ? 'Tier 1 (Basic)' : 'Unverified';

  const dailyLimitFormatted = kycTierNum === 2 ? '₦5,000,000' : kycTierNum === 1 ? '₦500,000' : '₦0';
  const referralCode = user?.id ? user.id.slice(-8).toUpperCase() : 'KUDI2026';

  const modal = useAppModal();

  const initials = userDisplayName
    .replace(/^@/, '')
    .split(/\s+/)
    .map((part: string) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'K';

  const handleCopy = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch (err) {
      console.warn('Clipboard setStringAsync error:', err);
    }
    modal.alert('Copied to Clipboard', `${label} copied:\n${text}`, 'success');
  };

  const handleLogout = () => {
    modal.show({
      title: 'Log Out',
      description: 'Are you sure you want to log out of Kudi?',
      type: 'warning',
      primaryText: 'Log Out',
      onPrimaryPress: () => {
        modal.hide();
        logout();
        router.replace('/(auth)/welcome');
      },
      secondaryText: 'Cancel',
      onSecondaryPress: modal.hide,
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.circularBackBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Profile & Account</Text>
        <TouchableOpacity
          onPress={() => router.push('/settings/edit-profile' as any)}
          style={[styles.circularBackBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="create-outline" size={20} color={palette.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Identity Hero Card */}
        <View style={[styles.identityCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TouchableOpacity onPress={() => router.push('/settings/edit-profile' as any)} style={styles.avatarWrapper} activeOpacity={0.8}>
            <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', borderColor: palette.primary }]}>
              {user?.avatarUrl ? (
                <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
              ) : (
                <Text style={[Typography.title1, { color: palette.text, fontSize: 28 }]}>{initials}</Text>
              )}
            </View>
            {kycTierNum > 0 && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark" size={10} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={[Typography.title1, styles.nameText, { color: palette.text }]}>
            {userDisplayName}
          </Text>
          {!!username && (
            <Text style={[Typography.bodyBold, { color: '#3B82F6', fontSize: 13, marginBottom: 2 }]}>
              {username}
            </Text>
          )}
          <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
            {userEmail}
          </Text>

          {/* KYC Tier Pill */}
          <TouchableOpacity
            style={[
              styles.tierPill,
              { backgroundColor: kycTierNum > 0 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' }
            ]}
            onPress={() => router.push('/kyc')}
            activeOpacity={0.7}
          >
            <Ionicons
              name={kycTierNum > 0 ? "shield-checkmark" : "shield-outline"}
              size={14}
              color={kycTierNum > 0 ? "#10B981" : "#F59E0B"}
            />
            <Text style={[
              Typography.caption,
              { color: kycTierNum > 0 ? "#10B981" : "#F59E0B", fontWeight: '700', marginLeft: 4 }
            ]}>
              KYC {kycTierLabel}
            </Text>
            {kycTierNum < 2 && (
              <Ionicons name="chevron-forward" size={12} color={kycTierNum > 0 ? "#10B981" : "#F59E0B"} style={{ marginLeft: 4 }} />
            )}
          </TouchableOpacity>

          {/* Deposit Address Strip: Solana Devnet */}
          <TouchableOpacity
            onPress={() => handleCopy(solanaAddress, 'Solana Devnet Address')}
            style={[styles.addressStrip, { backgroundColor: '#9945FF10', borderColor: '#9945FF40' }]}
            activeOpacity={0.7}
          >
            <ChainLogo chain="solana" size={16} />
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 11, flex: 1 }]} numberOfLines={1} ellipsizeMode="middle">
              SOL: {solanaAddress}
            </Text>
            <Ionicons name="copy-outline" size={14} color="#9945FF" />
          </TouchableOpacity>

          {/* Deposit Address Strip: Monad Testnet EVM */}
          <TouchableOpacity
            onPress={() => handleCopy(monadAddress, 'Monad Testnet Address')}
            style={[styles.addressStrip, { backgroundColor: '#8352FF10', borderColor: '#8352FF40', marginTop: 8 }]}
            activeOpacity={0.7}
          >
            <ChainLogo chain="monad" size={16} />
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 11, flex: 1 }]} numberOfLines={1} ellipsizeMode="middle">
              MONAD: {monadAddress}
            </Text>
            <Ionicons name="copy-outline" size={14} color="#8352FF" />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={[styles.statBox, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.push('/settings/limits')}
            activeOpacity={0.7}
          >
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>DAILY LIMIT</Text>
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 15, marginTop: 4, fontWeight: '700' }]}>
              {dailyLimitFormatted}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.statBox, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.push('/settings/security')}
            activeOpacity={0.7}
          >
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>SECURITY</Text>
            <Text style={[
              Typography.bodyBold,
              { color: pin ? '#10B981' : '#F59E0B', marginTop: 4, fontSize: 14 }
            ]}>
              {pin ? 'PIN Protected' : 'Setup PIN'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Referral Card */}
        <View style={[styles.referralCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.refIconBox, { backgroundColor: '#8B5CF620' }]}>
            <Ionicons name="gift-outline" size={22} color="#8B5CF6" />
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>REFERRAL CODE</Text>
            <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 16, marginTop: 2, letterSpacing: 1 }]}>
              {referralCode}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.copyCodeBtn, { backgroundColor: palette.primary }]}
            onPress={() => handleCopy(referralCode, 'Referral Code')}
            activeOpacity={0.8}
          >
            <Ionicons name="copy" size={14} color={light ? '#FFFFFF' : '#0F172A'} />
            <Text style={[Typography.caption, { color: light ? '#FFFFFF' : '#0F172A', fontWeight: '700', marginLeft: 4 }]}>
              Copy
            </Text>
          </TouchableOpacity>
        </View>

        {/* Account Menu Items */}
        <View style={[styles.menuCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings/edit-profile' as any)}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#10B98118' }]}>
                <Ionicons name="person-outline" size={18} color="#10B981" />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Edit Profile</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>Update photo, full name & username</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/kyc')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#3B82F618' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color="#3B82F6" />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>KYC Verification</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>Upgrade limits & virtual bank account</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings/security')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#EF444418' }]}>
                <Ionicons name="lock-closed-outline" size={18} color="#EF4444" />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Security & PIN</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>PIN code, biometrics & app lock</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings/support')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#06B6D418' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color="#06B6D4" />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Help & Support</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>WhatsApp & email customer service</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#8B5CF618' }]}>
                <Ionicons name="settings-outline" size={18} color="#8B5CF6" />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>All Settings</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>Appearance, notifications & preferences</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Log Out Button */}
        <TouchableOpacity
          onPress={handleLogout}
          style={styles.logoutBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={19} color="#EF4444" />
          <Text style={[Typography.bodyBold, { color: '#EF4444' }]}>Log Out</Text>
        </TouchableOpacity>
        <AppModal config={modal.config} onClose={modal.hide} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  circularBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 16
  },
  identityCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12
  },
  avatarCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  avatarImg: {
    width: 84,
    height: 84,
    borderRadius: 42
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  nameText: {
    marginBottom: 2
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    marginTop: 10
  },
  addressStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12
  },
  statBox: {
    flex: 1,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center'
  },
  referralCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1
  },
  refIconBox: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center'
  },
  copyCodeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12
  },
  menuCard: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden'
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    marginTop: 8
  }
});
