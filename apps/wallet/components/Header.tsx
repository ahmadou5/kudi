import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { usePreferencesStore, PreferencesState } from '../store/preferences.store';
import { Typography } from '../constants/typography';

import { Image, Text } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { ChainLogo } from './ui/ChainLogo';

export interface HeaderProps {
  onOpenScanner?: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenScanner, onOpenProfile }) => {
  const palette = useAppPalette();
  const themeMode = usePreferencesStore((s: PreferencesState) => s.themeMode);
  const setThemeMode = usePreferencesStore((s: PreferencesState) => s.setThemeMode);
  const user = useAuthStore((s) => s.user);

  const isDark = themeMode === 'dark' || palette.text === '#FFFFFF';

  const toggleTheme = () => {
    setThemeMode(isDark ? 'light' : 'dark');
  };

  const handleProfile = () => {
    if (onOpenProfile) {
      onOpenProfile();
    } else {
      router.push('/profile');
    }
  };

  const handleScanner = () => {
    if (onOpenScanner) {
      onOpenScanner();
    } else {
      router.push('/qr-scanner');
    }
  };

  const handleSettings = () => {
    router.push('/settings');
  };

  const displayName = user?.fullName || user?.username || (user?.email ? user.email.split('@')[0] : 'User');
  const initials = displayName
    .replace(/^@/, '')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'K';

  return (
    <View style={[styles.header, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {/* Top Left: Avatar Photo / Initials + User Greeting */}
      <TouchableOpacity
        onPress={handleProfile}
        style={styles.profileGreetingTouch}
        activeOpacity={0.7}
      >
        <View style={[styles.avatarBtn, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', borderColor: '#34D399' }]}>
          {user?.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 14 }]}>{initials}</Text>
          )}
        </View>
        <View style={styles.greetingTextCol}>
          <Text style={[Typography.caption, { color: palette.textSecondary }]}>Welcome back 👋</Text>
          <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 14 }]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Top Right Actions */}
      <View style={styles.rightActions}>
        {/* Network Badge */}
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/deposit')}
          style={[styles.networkPill, { backgroundColor: isDark ? 'rgba(153, 69, 255, 0.15)' : '#F1F5F9', borderColor: isDark ? 'rgba(153, 69, 255, 0.3)' : '#CBD5E1' }]}
          activeOpacity={0.7}
        >
          <View style={styles.chainLogosOverlap}>
            <ChainLogo chain="solana" size={14} />
            <View style={{ marginLeft: -4 }}>
              <ChainLogo chain="monad" size={14} />
            </View>
          </View>
          <Text style={[Typography.caption, { color: isDark ? '#A78BFA' : '#0F172A', fontSize: 10, fontWeight: '700' }]}>
            Devnet
          </Text>
        </TouchableOpacity>

        {/* Theme Toggle Button */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.iconBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name={isDark ? 'sunny-outline' : 'moon-outline'} size={18} color={palette.text} />
        </TouchableOpacity>

        {/* QR Scanner Button */}
        <TouchableOpacity
          onPress={handleScanner}
          style={[styles.iconBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="scan-outline" size={18} color={palette.text} />
        </TouchableOpacity>

        {/* Settings Button */}
        <TouchableOpacity
          onPress={handleSettings}
          style={[styles.iconBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={18} color={palette.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Typography.lg,
    paddingVertical: Typography.xs,
    borderBottomWidth: 0.2
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1
  },
  chainLogosOverlap: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  profileGreetingTouch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  avatarBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  avatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21
  },
  greetingTextCol: {
    justifyContent: 'center'
  }
});
