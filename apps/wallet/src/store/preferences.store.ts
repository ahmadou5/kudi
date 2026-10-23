import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface PreferencesState {
  themeMode: ThemeMode;
  appLockEnabled: boolean;
  biometricsEnabled: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  setAppLockEnabled: (enabled: boolean) => void;
  setBiometricsEnabled: (enabled: boolean) => void;
}

const KEYS = {
  appLock: 'kudi_pref_app_lock',
  biometrics: 'kudi_pref_biometrics'
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

export const usePreferencesStore = create<PreferencesState>()((set) => ({
  themeMode: 'dark',
  appLockEnabled: true,
  biometricsEnabled: false,
  isLoading: true,

  hydrate: async () => {
    try {
      const [storedAppLock, storedBiometrics] = await Promise.all([
        getSecureItem(KEYS.appLock),
        getSecureItem(KEYS.biometrics)
      ]);
      set({
        appLockEnabled: storedAppLock === null ? true : storedAppLock === 'true',
        biometricsEnabled: storedBiometrics === 'true',
        isLoading: false
      });
    } catch (err) {
      console.warn('Preferences hydration failed:', err);
      set({ isLoading: false });
    }
  },

  setThemeMode: (themeMode: ThemeMode) => {
    set({ themeMode });
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
