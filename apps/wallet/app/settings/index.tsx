import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
  SafeAreaView,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette, isLight } from '../../lib/theme';
import { usePreferencesStore, PreferencesState } from '../../store/preferences.store';
import { useAuthStore, AuthState } from '../../store/auth.store';
import { Typography } from '../../constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const light = isLight(palette.bg);
  const themeMode = usePreferencesStore((s: PreferencesState) => s.themeMode);
  const logout = useAuthStore((s: AuthState) => s.logout);

  const [searchPrivacy, setSearchPrivacy] = useState(false);
  const [shareAnalytics, setShareAnalytics] = useState(true);

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

  const handleCloseAccount = () => {
    Alert.alert(
      'Close Account',
      'Closing your account is permanent and cannot be undone. Please contact Kudi support to process account closure.',
      [{ text: 'OK' }]
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >


        {/* Primary Settings Card Group */}
        <View style={[styles.cardGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TouchableOpacity
            style={[styles.rowItem, { borderBottomColor: palette.border }]}
            onPress={() => Alert.alert('Profile', 'KYC & Profile details active')}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="person-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>
                  {light ? 'My profile' : 'Account'}
                </Text>
                {light && <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Edit account info</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rowItem, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings/security')}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="shield-checkmark-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Security</Text>
                {light && <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Password, PIN & App lock</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rowItem, { borderBottomColor: palette.border }]}
            onPress={() => Alert.alert('Statements', 'Account statements & history CSV exported')}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="document-text-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>
                  {light ? 'Spending limits' : 'Statements'}
                </Text>
                {light && <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Daily tier limit ₦5,000,000</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rowItem, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings/notifications')}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="notifications-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Notifications</Text>
                {light && <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Alerts & push preferences</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.rowItem, { borderBottomColor: palette.border }]}
            onPress={() => router.push('/settings/appearance')}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="color-palette-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Appearance</Text>
                {light && <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Theme customization</Text>}
              </View>
            </View>
            <View style={styles.itemRight}>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rowItem}
            onPress={() => Alert.alert('Support', 'Contacting Kudi support: support@kudi.app')}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>
                  {light ? 'Support' : 'Get help'}
                </Text>
                {light && <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Talk to Us</Text>}
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>



        {/* Logout & Account Actions Card */}
        <View style={[styles.cardGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TouchableOpacity
            style={[styles.rowItem, { borderBottomColor: palette.border }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Ionicons name="log-out-outline" size={18} color={palette.text} />
              </View>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Log out</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity style={styles.rowItem} onPress={handleCloseAccount} activeOpacity={0.7}>
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                <Ionicons name="warning-outline" size={18} color={palette.error} />
              </View>
              <Text style={[Typography.bodyBold, { color: palette.error }]}>Close account</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Footer Version */}
        <Text style={[Typography.footnote, styles.versionFooter, { color: palette.textSecondary }]}>
          v1.2.0-54 (Expo SDK 54)
        </Text>
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
    paddingVertical: 12,
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
    gap: 16
  },
  referBanner: {
    backgroundColor: '#E2E8F0',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  referLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  referIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  referTitle: { color: '#0F172A' },
  referSub: { color: '#475569', marginTop: 2 },
  cardGroup: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden'
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  versionFooter: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 24
  }
});
