import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Gauge,
  Lock,
  LogOut,
  LucideIcon,
  MessageSquare,
  Palette,
  Receipt,
  ShieldCheck,
  User
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { useAuthStore, AuthState } from '../../src/store/auth.store';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { Avatar, userAvatarSeed } from '../../src/components/Avatar';
import { AppVersionFooter } from '../../src/components/AppVersionFooter';

type MenuItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  Icon: LucideIcon;
  badge?: string;
  badgeTone?: 'success' | 'warning';
};

export default function SettingsScreen() {
  const palette = useAppPalette();
  const user = useAuthStore((s: AuthState) => s.user);
  const logout = useAuthStore((s: AuthState) => s.logout);

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const rawTier = user?.kycTier;
  const kycTier =
    rawTier === '2' || rawTier === 'TIER_2'
      ? 2
      : rawTier === '1' || rawTier === 'TIER_1' || user?.kycStatus === 'VERIFIED'
        ? 1
        : 0;
  const kycBadge = kycTier === 2 ? 'Tier 2 Pro' : kycTier === 1 ? 'Tier 1' : 'Unverified';

  const ACCOUNT_ITEMS: MenuItem[] = [
    {
      id: 'profile',
      title: 'Profile',
      subtitle: 'Name, photo & personal identity',
      href: '/profile',
      Icon: User
    },
    {
      id: 'kyc',
      title: 'Identity & KYC',
      subtitle: 'Verification level and limits',
      href: '/kyc',
      Icon: ShieldCheck,
      badge: kycBadge,
      badgeTone: kycTier > 0 ? 'success' : 'warning'
    },
    {
      id: 'limits',
      title: 'Spending limits',
      subtitle: 'Daily and per-transaction caps',
      href: '/settings/limits',
      Icon: Gauge
    }
  ];

  const PREFERENCE_ITEMS: MenuItem[] = [
    {
      id: 'appearance',
      title: 'Appearance',
      subtitle: 'Light, dark or system theme',
      href: '/settings/appearance',
      Icon: Palette
    },
    {
      id: 'notifications',
      title: 'Notifications',
      subtitle: 'Push alerts and deposit triggers',
      href: '/settings/notifications',
      Icon: Bell
    }
  ];

  const ACTIVITY_ITEMS: MenuItem[] = [
    {
      id: 'transactions',
      title: 'Activities',
      subtitle: 'USDC deposit & spend ledger',
      href: '/(tabs)/history',
      Icon: Receipt
    }
  ];

  const SECURITY_ITEMS: MenuItem[] = [
    {
      id: 'security',
      title: 'Security',
      subtitle: 'PIN, biometrics & app lock',
      href: '/settings/security',
      Icon: Lock
    },
    {
      id: 'support',
      title: 'Support',
      subtitle: 'Chat with the Kudi team',
      href: '/settings/support',
      Icon: MessageSquare
    }
  ];

  const confirmLogout = () => {
    setLogoutModalVisible(false);
    logout();
    router.replace('/(auth)/welcome');
  };

  const userName = user?.fullName || user?.username || 'Kudi User';
  const userHandle =
    user?.username ? `@${user.username}` : user?.email || 'Authenticated session';

  const tileTint = hexToRgba(palette.text, 0.07);

  const renderGroup = (label: string, items: MenuItem[]) => (
    <View style={styles.group}>
      <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>{label}</Text>
      <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {items.map((item, index) => {
          const ItemIcon = item.Icon;
          const badgeColor =
            item.badgeTone === 'success' ? palette.success : palette.warning;
          return (
            <React.Fragment key={item.id}>
              {index > 0 && <View style={[styles.divider, { backgroundColor: palette.border }]} />}
              <Pressable
                onPress={() => router.push(item.href as any)}
                accessibilityRole="button"
                accessibilityLabel={`${item.title}. ${item.subtitle}`}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { backgroundColor: hexToRgba(palette.text, 0.05) }
                ]}
              >
                <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                  <ItemIcon size={19} color={palette.textSecondary} strokeWidth={1.9} />
                </View>

                <View style={styles.rowCopy}>
                  <Text
                    style={[styles.rowTitle, { color: palette.text }]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.rowSubtitle, { color: hexToRgba(palette.text, 0.5) }]}
                    numberOfLines={1}
                  >
                    {item.subtitle}
                  </Text>
                </View>

                {item.badge && (
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: hexToRgba(badgeColor, 0.14) }
                    ]}
                  >
                    <Text style={[styles.badgeText, { color: badgeColor }]}>{item.badge}</Text>
                  </View>
                )}

                <ChevronRight size={17} color={hexToRgba(palette.text, 0.35)} />
              </Pressable>
            </React.Fragment>
          );
        })}
      </View>
    </View>
  );

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
        <Text style={[Typography.title1, { color: palette.text }]}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity */}
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.identityCard,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.75 }
          ]}
        >
          <Avatar avatarUrl={user?.avatarUrl} seed={userAvatarSeed(user)} size={52} />
          <View style={styles.identityCopy}>
            <Text style={[styles.identityName, { color: palette.text }]} numberOfLines={1}>
              {userName}
            </Text>
            <Text
              style={[styles.identityHandle, { color: hexToRgba(palette.text, 0.5) }]}
              numberOfLines={1}
            >
              {userHandle}
            </Text>
          </View>
          <ChevronRight size={17} color={hexToRgba(palette.text, 0.35)} />
        </Pressable>

        {renderGroup('Account', ACCOUNT_ITEMS)}
        {renderGroup('Preferences', PREFERENCE_ITEMS)}
        {renderGroup('Activity', ACTIVITY_ITEMS)}
        {renderGroup('Security & support', SECURITY_ITEMS)}

        {/* Destructive */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            setLogoutModalVisible(true);
          }}
          accessibilityRole="button"
          accessibility-label="Log out"
          style={({ pressed }) => [
            styles.logoutRow,
            {
              backgroundColor: hexToRgba(palette.error, 0.08),
              borderColor: hexToRgba(palette.error, 0.28)
            },
            pressed && { opacity: 0.7 }
          ]}
        >
          <LogOut size={19} color={palette.error} />
          <Text style={[styles.logoutText, { color: palette.error }]}>Log out</Text>
        </Pressable>

        <AppVersionFooter />
      </ScrollView>

      {/* Logout confirmation sheet */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setLogoutModalVisible(false)} />
          <View style={[styles.sheet, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={[styles.grabber, { backgroundColor: hexToRgba(palette.text, 0.18) }]} />
            <View style={[styles.sheetIcon, { backgroundColor: hexToRgba(palette.error, 0.14) }]}>
              <LogOut size={22} color={palette.error} />
            </View>
            <Text style={[styles.sheetTitle, { color: palette.text }]}>Log out of Kudi?</Text>
            <Text style={[styles.sheetText, { color: hexToRgba(palette.text, 0.55) }]}>
              You will need to verify your session again to sign back in.
            </Text>

            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setLogoutModalVisible(false)}
                style={({ pressed }) => [
                  styles.sheetButton,
                  { backgroundColor: palette.bg, borderColor: palette.border },
                  pressed && { opacity: 0.7 }
                ]}
              >
                <Text style={[styles.sheetButtonText, { color: palette.text }]}>Stay signed in</Text>
              </Pressable>

              <Pressable
                onPress={confirmLogout}
                style={({ pressed }) => [
                  styles.sheetButton,
                  { backgroundColor: palette.error, borderColor: palette.error },
                  pressed && { opacity: 0.8 }
                ]}
              >
                <Text style={[styles.sheetButtonText, { color: '#FFFFFF' }]}>Log out</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14
  },
  identityCopy: { flex: 1 },
  identityName: {
    fontFamily: Typography.family.sans,
    fontSize: 17,
    lineHeight: 22
  },
  identityHandle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2
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
  row: {
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
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowCopy: { flex: 1 },
  rowTitle: {
    fontFamily: Typography.family.sans,
    fontSize: 15,
    lineHeight: 20
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 1
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    height: 54
  },
  logoutText: {
    fontFamily: Typography.family.sans,
    fontSize: 15
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
    paddingHorizontal: 24,
    paddingTop: 10,
    paddingBottom: 34,
    gap: 10,
    alignItems: 'center'
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10
  },
  sheetIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2
  },
  sheetTitle: {
    fontFamily: Typography.family.sans,
    fontSize: 19,
    lineHeight: 24,
    textAlign: 'center'
  },
  sheetText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 8
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    width: '100%'
  },
  sheetButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sheetButtonText: {
    fontFamily: Typography.family.sans,
    fontSize: 14
  }
});
