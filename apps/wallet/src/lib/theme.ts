import { useMemo } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { Colors } from '../constants/palette';
import { usePreferencesStore, PreferencesState } from '../store/preferences.store';

export type AppPalette = typeof Colors.dark;

export function isLight(hex: string) {
  return hex.toUpperCase() === '#FFFFFF' || hex.toUpperCase() === '#F8FAFC';
}

export function useAppPalette(): AppPalette {
  const deviceScheme = useDeviceColorScheme() || 'dark';
  const themeMode = usePreferencesStore((state: PreferencesState) => state.themeMode);

  return useMemo(() => {
    const scheme = themeMode === 'system' ? deviceScheme : themeMode;
    return Colors[scheme as 'dark' | 'light'] || Colors.dark;
  }, [deviceScheme, themeMode]);
}

export function buildNavigationTheme(palette: AppPalette): NavigationTheme {
  const dark = palette.bg === '#090A0F';
  const base = dark ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark,
    colors: {
      ...base.colors,
      primary: palette.primary,
      background: palette.bg,
      card: palette.card,
      text: palette.text,
      border: palette.border,
      notification: palette.primary
    }
  };
}
