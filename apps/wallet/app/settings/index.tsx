import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Modal,
  Pressable
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAppPalette, isLight } from '../../lib/theme';
import { useAuthStore, AuthState } from '../../store/auth.store';
import { Typography } from '../../constants/typography';

type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  iconName: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  badge?: string;
};

export default function SettingsScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const light = isLight(palette.bg);
  const user = useAuthStore((s: AuthState) => s.user);
  const logout = useAuthStore((s: AuthState) => s.logout);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const rawTier = user?.kycTier;
  const kycTier = rawTier === '2' || rawTier === 'TIER_2' ? 2 : rawTier === '1' || rawTier === 'TIER_1' || user?.kycStatus === 'VERIFIED' ? 1 : 0;
  const kycBadge = kycTier === 2 ? 'Tier 2 Pro' : kycTier === 1 ? 'Tier 1' : 'Unverified';

  const PREFERENCE_ITEMS: MenuItem[] = [
    {
      id: 'appearance',
      title: 'Appearance',
      subtitle: 'Light, dark, or system theme',
      href: '/settings/appearance',
      iconName: 'color-palette-outline',
      iconColor: '#8B5CF6',
      iconBg: '#8B5CF618'
    },
    {
      id: 'notifications',
      title: 'Notification Preferences',
      subtitle: 'Push alerts and deposit triggers',
      href: '/settings/notifications',
      iconName: 'notifications-outline',
      iconColor: '#EC4899',
      iconBg: '#EC489918'
    },
  ];

  const ACCOUNT_ITEMS: MenuItem[] = [
    {
      id: 'profile',
      title: 'Profile Details',
      subtitle: 'Name, email & account identity',
      href: '/profile',
      iconName: 'person-outline',
      iconColor: '#10B981',
      iconBg: '#10B98118'
    },
    {
      id: 'kyc',
      title: 'KYC Verification',
      subtitle: 'Tier level & identity limits',
      href: '/kyc',
      iconName: 'shield-checkmark-outline',
      iconColor: '#3B82F6',
      iconBg: '#3B82F618',
      badge: kycBadge
    },
    {
      id: 'virtual-accounts',
      title: 'Virtual Accounts',
      subtitle: 'Wema & Moniepoint NGN details',
      href: '/(tabs)/deposit',
      iconName: 'wallet-outline',
      iconColor: '#F59E0B',
      iconBg: '#F59E0B18'
    },
  ];

  const ACTIVITY_ITEMS: MenuItem[] = [
    {
      id: 'transactions',
      title: 'Transaction History',
      subtitle: 'USDC deposit & spend ledger',
      href: '/(tabs)/history',
      iconName: 'receipt-outline',
      iconColor: '#6366F1',
      iconBg: '#6366F118'
    },
    {
      id: 'limits',
      title: 'Spending Limits',
      subtitle: 'Daily & per-tx off-ramp caps',
      href: '/settings/limits',
      iconName: 'speedometer-outline',
      iconColor: '#14B8A6',
      iconBg: '#14B8A618'
    },
  ];

  const SECURITY_ITEMS: MenuItem[] = [
    {
      id: 'security',
      title: 'Security & PIN',
      subtitle: 'PIN code, biometrics & app lock',
      href: '/settings/security',
      iconName: 'lock-closed-outline',
      iconColor: '#EF4444',
      iconBg: '#EF444418'
    },
    {
      id: 'support',
      title: 'Help & Support',
      subtitle: 'WhatsApp & email customer service',
      href: '/settings/support',
      iconName: 'chatbubble-ellipses-outline',
      iconColor: '#06B6D4',
      iconBg: '#06B6D418'
    },
  ];

  const handlePressItem = (item: MenuItem) => {
    router.push(item.href as any);
  };

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    logout();
    router.replace('/(auth)/welcome');
  };

  const userName = user?.fullName || user?.username || 'Kudi User';
  const initials = userName
    ? userName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'KD';

  const appVersion = Constants.expoConfig?.version || '1.0.0';

  const renderSectionGroup = (label: string, items: MenuItem[]) => (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: palette.textSecondary }]}>{label}</Text>
      <View style={styles.groupList}>
        {items.map((item) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handlePressItem(item)}
            style={[styles.menuRow, { backgroundColor: palette.card, borderColor: palette.border }]}
            activeOpacity={0.75}
          >
            <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
              <Ionicons name={item.iconName} size={20} color={item.iconColor} />
            </View>

            <View style={styles.menuCopy}>
              <View style={styles.menuTitleRow}>
                <Text style={[styles.menuTitle, { color: palette.text }]}>{item.title}</Text>
                {item.badge && (
                  <View style={[
                    styles.badgePill,
                    { backgroundColor: kycTier > 0 ? '#10B98120' : '#F59E0B20' }
                  ]}>
                    <Text style={[
                      styles.badgeText,
                      { color: kycTier > 0 ? '#10B981' : '#F59E0B' }
                    ]}>
                      {item.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.menuSubtitle, { color: palette.textSecondary }]}>{item.subtitle}</Text>
            </View>

            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.headerRow, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Summary Banner */}
        <TouchableOpacity
          style={[styles.userProfileCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => router.push('/profile')}
          activeOpacity={0.8}
        >
          <View style={[styles.avatarCircle, { backgroundColor: palette.primary }]}>
            <Text style={[styles.avatarInitials, { color: light ? '#FFFFFF' : '#0F172A' }]}>{initials}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>
              {userName}
            </Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
              {user?.email || user?.phoneNumber || 'Account Identity'}
            </Text>
          </View>
          <View style={[styles.tierTag, { backgroundColor: kycTier > 0 ? '#10B98120' : '#F59E0B20' }]}>
            <Text style={[styles.tierTagText, { color: kycTier > 0 ? '#10B981' : '#F59E0B' }]}>
              {kycBadge}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
        </TouchableOpacity>

        {/* Settings Sections */}
        <View style={[styles.sectionCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {renderSectionGroup('Preferences', PREFERENCE_ITEMS)}
          <View style={styles.groupSpacer} />
          {renderSectionGroup('Account & Identity', ACCOUNT_ITEMS)}
          <View style={styles.groupSpacer} />
          {renderSectionGroup('Activity & Ledger', ACTIVITY_ITEMS)}
          <View style={styles.groupSpacer} />
          {renderSectionGroup('Security & Support', SECURITY_ITEMS)}
        </View>

        {/* Standalone Logout Button */}
        <TouchableOpacity
          onPress={() => setLogoutModalVisible(true)}
          style={[styles.logoutButton, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        {/* Footer Version */}
        <View style={styles.versionFooter}>
          <Text style={[styles.versionText, { color: palette.textSecondary }]}>
            Kudi Wallet • v{appVersion}
          </Text>
        </View>
      </ScrollView>

      {/* Logout Confirmation Bottom Sheet Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLogoutModalVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.sheetHeaderIcon}>
              <Ionicons name="log-out-outline" size={24} color="#EF4444" />
            </View>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Log Out of Kudi?</Text>
            <Text style={[styles.sheetText, { color: palette.textSecondary }]}>
              You will need to verify your session again to sign back in.
            </Text>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                onPress={() => setLogoutModalVisible(false)}
                style={[styles.sheetButton, { backgroundColor: palette.bg, borderColor: palette.border }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetButtonText, { color: palette.text }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={confirmLogout}
                style={[styles.sheetButton, { backgroundColor: '#EF4444', borderColor: '#EF4444' }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.sheetButtonText, { color: '#FFFFFF' }]}>Log out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700'
  },
  headerSpacer: {
    width: 42
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 16
  },
  userProfileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 20,
    borderWidth: 1
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarInitials: {
    fontSize: 18,
    fontWeight: '800'
  },
  userInfo: {
    flex: 1,
    marginLeft: 12
  },
  tierTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginRight: 6
  },
  tierTagText: {
    fontSize: 11,
    fontWeight: '700'
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16
  },
  group: {
    gap: 10
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    paddingLeft: 2
  },
  groupList: {
    gap: 8
  },
  groupSpacer: {
    height: 18
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuCopy: {
    flex: 1,
    gap: 2
  },
  menuTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '700'
  },
  menuSubtitle: {
    fontSize: 13
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800'
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    height: 56
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '700'
  },
  versionFooter: {
    alignItems: 'center',
    marginBottom: 20
  },
  versionText: {
    fontSize: 12,
    fontWeight: '600'
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end'
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 24,
    gap: 12,
    alignItems: 'center'
  },
  sheetHeaderIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(239,68,68,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center'
  },
  sheetText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    width: '100%'
  },
  sheetButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetButtonText: {
    fontSize: 15,
    fontWeight: '700'
  }
});
