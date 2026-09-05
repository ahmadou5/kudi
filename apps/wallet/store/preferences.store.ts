import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light' | 'system';

export interface PreferencesState {
  themeMode: ThemeMode;
  appLockEnabled: boolean;
  isLoading: boolean;
  hydrate: () => Promise<void>;
  setThemeMode: (mode: ThemeMode) => void;
  setAppLockEnabled: (enabled: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()((set) => ({
  themeMode: 'dark',
  appLockEnabled: true,
  isLoading: false,

  hydrate: async () => {
    set({ isLoading: false });
  },

  setThemeMode: (themeMode: ThemeMode) => {
    set({ themeMode });
  },

  setAppLockEnabled: (appLockEnabled: boolean) => {
    set({ appLockEnabled });
  }
}));
