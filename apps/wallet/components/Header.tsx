import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { usePreferencesStore, PreferencesState } from '../store/preferences.store';
import { Typography } from '../constants/typography';

export interface HeaderProps {
  onOpenScanner?: () => void;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenScanner, onOpenProfile }) => {
  const palette = useAppPalette();
  const themeMode = usePreferencesStore((s: PreferencesState) => s.themeMode);
  const setThemeMode = usePreferencesStore((s: PreferencesState) => s.setThemeMode);

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

  return (
    <View style={[styles.header, { backgroundColor: palette.bg, borderColor: palette.border }]}>
      {/* Top Left: Avatar / Person Button -> Profile */}
      <TouchableOpacity
        onPress={handleProfile}
        style={[styles.iconBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
        activeOpacity={0.7}
      >
        <Ionicons name="person" size={19} color={palette.text} />
      </TouchableOpacity>

      {/* Top Right Actions */}
      <View style={styles.rightActions}>
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
  }
});
