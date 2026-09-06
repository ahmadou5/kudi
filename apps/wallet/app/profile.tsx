import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { useAuthStore, AuthState } from '../store/auth.store';
import { Typography } from '../constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProfileScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s: AuthState) => s.user);
  const wallets = useAuthStore((s: AuthState) => s.wallets);
  const logout = useAuthStore((s: AuthState) => s.logout);
  const isDark = palette.text === '#FFFFFF';

  const solanaAddress = wallets.find(w => w.chain === 'solana')?.address || 'Solana Address Loading...';
  const monadAddress = wallets.find(w => w.chain.includes('monad'))?.address || 'Monad Address Loading...';

  const userEmail = user?.email || 'authenticated.user@kudi.app';
  const userDisplayName = userEmail.split('@')[0] || 'Kudi User';
  const kycTierLabel = user?.kycTier || 'UNVERIFIED';

  const handleCopyAddress = (address: string, chainName: string) => {
    Alert.alert('Copied', `${chainName} address copied:\n${address}`);
  };

  const handleLogout = () => {
    Alert.alert(
      'Log Out',
      'Are you sure you want to log out of Kudi?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/(auth)/welcome');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Header with Circular Back Button */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.circularBackBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User Identity Hero Card */}
        <View style={[styles.identityCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarCircle, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', borderColor: '#34D399' }]}>
              <Ionicons name="person" size={40} color={palette.text} />
            </View>
            <View style={styles.verifiedBadge}>
              <Ionicons name="checkmark" size={10} color="#FFFFFF" />
            </View>
          </View>

          <Text style={[Typography.title1, styles.nameText, { color: palette.text }]}>
            {userDisplayName}
          </Text>
          <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
            {userEmail}
          </Text>
          {!!user?.id && (
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
              ID: {user.id}
            </Text>
          )}

          {/* KYC Tier Verified Pill */}
          <View style={styles.tierPill}>
            <Ionicons name="sparkles" size={13} color="#34D399" />
            <Text style={[Typography.caption, { color: '#34D399', fontWeight: '700', marginLeft: 4 }]}>
              KYC {kycTierLabel}
            </Text>
          </View>

          {/* Deposit Address Strip: Solana */}
          <TouchableOpacity
            onPress={() => handleCopyAddress(solanaAddress, 'Solana')}
            style={[styles.addressStrip, { backgroundColor: palette.bg, borderColor: palette.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="logo-bitcoin" size={16} color="#9945FF" />
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 11, flex: 1 }]} numberOfLines={1} ellipsizeMode="middle">
              SOL: {solanaAddress}
            </Text>
            <Ionicons name="copy-outline" size={14} color={palette.textSecondary} />
          </TouchableOpacity>

          {/* Deposit Address Strip: Monad EVM */}
          <TouchableOpacity
            onPress={() => handleCopyAddress(monadAddress, 'Monad EVM')}
            style={[styles.addressStrip, { backgroundColor: palette.bg, borderColor: palette.border, marginTop: 8 }]}
            activeOpacity={0.7}
          >
            <Ionicons name="cube-outline" size={16} color="#60A5FA" />
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 11, flex: 1 }]} numberOfLines={1} ellipsizeMode="middle">
              EVM: {monadAddress}
            </Text>
            <Ionicons name="copy-outline" size={14} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>DAILY LIMIT</Text>
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 16, marginTop: 4 }]}>
              $50,000
            </Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>SECURITY</Text>
            <Text style={[Typography.bodyBold, { color: palette.success, marginTop: 4 }]}>
              2FA Active
            </Text>
          </View>
        </View>

        {/* Account Menu Items */}
        <View style={[styles.menuCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Ionicons name="settings-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Full Settings</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>Account preferences & controls</Text>
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
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Security & Passcode</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>PIN, Biometrics & 2FA</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuRow, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings/appearance')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Ionicons name="color-palette-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Appearance & Theme</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>Dark / Light mode settings</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuRow}
            onPress={() => router.push('/settings/notifications')}
            activeOpacity={0.7}
          >
            <View style={styles.menuLeft}>
              <View style={[styles.iconBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Ionicons name="notifications-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Notifications</Text>
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>Push & transaction alerts</Text>
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
    justifyContent: 'center'
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#34D399',
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
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
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
