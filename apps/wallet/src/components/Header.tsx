import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Bell, Sun, Moon, Scan, Settings } from 'lucide-react-native';
import { useAppPalette, hexToRgba, readableInk } from '../lib/theme';
import { usePreferencesStore, PreferencesState } from '../store/preferences.store';
import { Typography } from '../constants/typography';

import { Image, Text } from 'react-native';
import { useAuthStore } from '../store/auth.store';
import { useNotifications } from '../hooks/useNotifications';
import { ChainLogo } from './ui/ChainLogo';
import { Blobatar } from './Blobatar';
import { Avatar, userAvatarSeed } from './Avatar';

export interface HeaderProps {
  onOpenScanner?: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenScanner, onOpenProfile }) => {
  const palette = useAppPalette();
  const themeMode = usePreferencesStore((s: PreferencesState) => s.themeMode);
  const setThemeMode = usePreferencesStore((s: PreferencesState) => s.setThemeMode);
  const user = useAuthStore((s) => s.user);
  const { unreadCount } = useNotifications();

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
        <View style={[styles.avatarBtn, { backgroundColor: hexToRgba(palette.text, 0.06), borderColor: palette.border }]}>
          <Avatar avatarUrl={user?.avatarUrl} seed={userAvatarSeed(user)} size={38} />
        </View>

      </TouchableOpacity>

      {/* Top Right Actions */}
      <View style={styles.rightActions}>



        {/* Theme Toggle Button */}
        <TouchableOpacity
          onPress={toggleTheme}
          style={[styles.iconBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          {isDark ? (
            <Sun size={18} color={palette.text} />
          ) : (
            <Moon size={18} color={palette.text} />
          )}
        </TouchableOpacity>

       
        <TouchableOpacity
          onPress={handleScanner}
          style={[styles.iconBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Scan size={18} color={palette.text} />
        </TouchableOpacity>
        {/* Notifications Bell Button — badge count comes from the shared
            notifications cache, so it clears as soon as the feed marks read */}
        <TouchableOpacity
          onPress={() => router.push('/notifications')}
          style={[styles.iconBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Bell size={18} color={palette.text} />
          {unreadCount > 0 && (
            <View style={[styles.badge, { backgroundColor: palette.success, borderColor: palette.card }]}>
              <Text style={[styles.badgeText, { color: readableInk(palette.success) }]}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </Text>
            </View>
          )}
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
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2
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
