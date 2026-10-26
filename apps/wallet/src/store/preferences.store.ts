import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AccentId, SurfaceId, CardTintId, ACCENTS, SURFACES, CARD_TINTS } from '../constants/palette';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface PreferencesState {
  themeMode: ThemeMode;
  accentId: AccentId;
  surfaceId: SurfaceId;
  cardTint: CardTintId;
  appLockEnabled: boolean;
  biometricsEnabled: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (id: AccentId) => void;
  setSurface: (id: SurfaceId) => void;
  setCardTint: (id: CardTintId) => void;
  setAppLockEnabled: (enabled: boolean) => void;
  setBiometricsEnabled: (enabled: boolean) => void;
}

const KEYS = {
  appLock: 'kudi_pref_app_lock',
  biometrics: 'kudi_pref_biometrics',
  theme: 'kudi_pref_theme_mode',
  accent: 'kudi_pref_accent',
  surface: 'kudi_pref_surface',
  cardTint: 'kudi_pref_card_tint'
} as const;

const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`Preferences read error for ${key}:`, err);
    return null;
  }
};

const setSecureItem = async (key: string, value: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn(`Preferences write error for ${key}:`, err);
  }
};

const isThemeMode = (value: string | null): value is ThemeMode =>
  value === 'dark' || value === 'light' || value === 'system';

export const usePreferencesStore = create<PreferencesState>()((set) => ({
  themeMode: 'dark',
  accentId: 'slate',
  surfaceId: 'neutral',
  cardTint: 'flat',
  appLockEnabled: true,
  biometricsEnabled: false,
  isLoading: true,

  hydrate: async () => {
    try {
      const [storedAppLock, storedBiometrics, storedTheme, storedAccent, storedSurface, storedTint] =
        await Promise.all([
          getSecureItem(KEYS.appLock),
          getSecureItem(KEYS.biometrics),
          getSecureItem(KEYS.theme),
          getSecureItem(KEYS.accent),
          getSecureItem(KEYS.surface),
          getSecureItem(KEYS.cardTint)
        ]);
      set({
        appLockEnabled: storedAppLock === null ? true : storedAppLock === 'true',
        biometricsEnabled: storedBiometrics === 'true',
        themeMode: isThemeMode(storedTheme) ? (storedTheme as ThemeMode) : 'dark',
        accentId: ACCENTS.some((option) => option.id === storedAccent)
          ? (storedAccent as AccentId)
          : 'slate',
        surfaceId: SURFACES.some((option) => option.id === storedSurface)
          ? (storedSurface as SurfaceId)
          : 'neutral',
        cardTint: CARD_TINTS.some((option) => option.id === storedTint)
          ? (storedTint as CardTintId)
          : 'flat',
        isLoading: false
      });
    } catch (err) {
      console.warn('Preferences hydration failed:', err);
      set({ isLoading: false });
    }
  },

  setThemeMode: (themeMode: ThemeMode) => {
    set({ themeMode });
    void setSecureItem(KEYS.theme, themeMode);
  },

  setAccent: (accentId: AccentId) => {
    set({ accentId });
    void setSecureItem(KEYS.accent, accentId);
  },

  setSurface: (surfaceId: SurfaceId) => {
    set({ surfaceId });
    void setSecureItem(KEYS.surface, surfaceId);
  },

  setCardTint: (cardTint: CardTintId) => {
    set({ cardTint });
    void setSecureItem(KEYS.cardTint, cardTint);
  },

  setAppLockEnabled: (appLockEnabled: boolean) => {
    set({ appLockEnabled });
    void setSecureItem(KEYS.appLock, String(appLockEnabled));
  },

  setBiometricsEnabled: (biometricsEnabled: boolean) => {
    set({ biometricsEnabled });
    void setSecureItem(KEYS.biometrics, String(biometricsEnabled));
  }
}));
