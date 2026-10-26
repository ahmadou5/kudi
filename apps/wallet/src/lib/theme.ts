import { useMemo } from 'react';
import { useColorScheme as useDeviceColorScheme } from 'react-native';
import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';
import { Colors, ACCENTS, SURFACES, CARD_TINTS } from '../constants/palette';
import { usePreferencesStore, PreferencesState } from '../store/preferences.store';

export type AppPalette = typeof Colors.dark;

const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));

function parseHex(hex: string): [number, number, number] {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((char) => char + char).join('');
  const num = parseInt(c, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

/** Blends hex `a` toward hex `b` by `t` (0 = a, 1 = b). */
export function mixColors(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  const ratio = Math.max(0, Math.min(1, t));
  const toHex = (v: number) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r1 + (r2 - r1) * ratio)}${toHex(g1 + (g2 - g1) * ratio)}${toHex(b1 + (b2 - b1) * ratio)}`.toUpperCase();
}

/** `amount` > 0 lightens toward white, < 0 darkens toward black. */
export function shade(hex: string, amount: number): string {
  return amount >= 0 ? mixColors(hex, '#FFFFFF', amount) : mixColors(hex, '#000000', Math.abs(amount));
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((channel) => {
    const s = channel / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ink that stays readable when placed on top of `hex`. */
export function readableInk(hex: string): string {
  return relativeLuminance(hex) > 0.42 ? '#0F172A' : '#FFFFFF';
}

export function isLight(hex: string) {
  return relativeLuminance(hex) > 0.5;
}

export function hexToRgba(hex: string, opacity: number): string {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((char) => char + char).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${opacity})`;
}

export function getThemeLabel(mode: string, deviceScheme: 'light' | 'dark') {
  if (mode === 'system') return `System (${deviceScheme === 'dark' ? 'Dark' : 'Light'})`;
  if (mode === 'light') return 'Light';
  if (mode === 'dark') return 'Dark';
  return 'Custom';
}

export function useAppPalette(): AppPalette {
  const deviceScheme = useDeviceColorScheme() || 'dark';
  const themeMode = usePreferencesStore((state: PreferencesState) => state.themeMode);
  const accentId = usePreferencesStore((state: PreferencesState) => state.accentId);
  const surfaceId = usePreferencesStore((state: PreferencesState) => state.surfaceId);
  const cardTintId = usePreferencesStore((state: PreferencesState) => state.cardTint);

  return useMemo(() => {
    const scheme = (themeMode === 'system' ? deviceScheme : themeMode) as 'dark' | 'light';
    const base = Colors[scheme] || Colors.dark;
    const accentOption = ACCENTS.find((option) => option.id === accentId) || ACCENTS[0];
    const surfaceOption = SURFACES.find((option) => option.id === surfaceId) || SURFACES[0];
    const tintOption = CARD_TINTS.find((option) => option.id === cardTintId) || CARD_TINTS[0];

    const accent = accentOption[scheme] || base.primary;
    const bg = surfaceOption[scheme].bg || base.bg;
    const tint = tintOption[scheme];
    const contrast = scheme === 'dark' ? '#FFFFFF' : '#0F172A';

    return {
      ...base,
      scheme,
      bg,
      card: mixColors(bg, contrast, tint),
      border: mixColors(bg, contrast, 0.11),
      primary: accent,
      primaryDark: shade(accent, -0.18),
      accent
    };
  }, [deviceScheme, themeMode, accentId, surfaceId, cardTintId]);
}

export function buildNavigationTheme(palette: AppPalette): NavigationTheme {
  const dark = palette.scheme === 'dark';
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
