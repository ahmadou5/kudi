import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { sdk } from '../src/lib/sdk';

export interface User {
  id: string;
  privyUserId?: string;
  email?: string;
  fullName?: string;
  phoneNumber?: string;
  kycTier?: string;
  kycStatus?: string;
}

export interface WalletInfo {
  chain: string;
  address: string;
}

export interface AuthState {
  user: User | null;
  wallets: WalletInfo[];
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  pin: string;

  hydrate: () => Promise<void>;
  loginWithPrivy: (privyPayload: {
    privyToken?: string;
    privyUserId: string;
    email?: string;
    phoneNumber?: string;
    name?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  unlock: () => void;
  lock: () => void;
  verifyPin: (inputPin: string) => boolean;
  setPin: (newPin: string) => Promise<void>;
}

const getSecureItem = async (key: string): Promise<string | null> => {
  try {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    }
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`SecureStore get error for key ${key}:`, err);
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
    console.warn(`SecureStore set error for key ${key}:`, err);
  }
};

const deleteSecureItem = async (key: string): Promise<void> => {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') localStorage.removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn(`SecureStore delete error for key ${key}:`, err);
  }
};

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  wallets: [],
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isUnlocked: false,
  isLoading: true,
  pin: '1234',

  hydrate: async () => {
    try {
      const storedToken = await getSecureItem('kudi_access_token');
      const storedRefreshToken = await getSecureItem('kudi_refresh_token');
      const storedUser = await getSecureItem('kudi_user');
      const storedWallets = await getSecureItem('kudi_wallets');
      const storedPin = await getSecureItem('kudi_user_pin');

      if (storedToken && storedUser) {
        const user = JSON.parse(storedUser);
        const wallets = storedWallets ? JSON.parse(storedWallets) : [];
        sdk.setAuthToken(storedToken);

        set({
          user,
          wallets,
          accessToken: storedToken,
          refreshToken: storedRefreshToken,
          isAuthenticated: true,
          isUnlocked: true,
          isLoading: false,
          pin: storedPin || '1234'
        });
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch (err) {
      console.error('Auth store hydration failed:', err);
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  loginWithPrivy: async (privyPayload) => {
    try {
      set({ isLoading: true });
      console.log('[AuthStore] Calling Privy auth payload:', privyPayload);
      const response = await sdk.authenticatePrivy(privyPayload);
      console.log('[AuthStore] Privy auth response:', response);

      if (response && response.success && response.data) {
        const { user, wallets, accessToken, refreshToken } = response.data;

        await setSecureItem('kudi_access_token', accessToken);
        if (refreshToken) await setSecureItem('kudi_refresh_token', refreshToken);
        await setSecureItem('kudi_user', JSON.stringify(user));
        if (wallets) await setSecureItem('kudi_wallets', JSON.stringify(wallets));

        sdk.setAuthToken(accessToken);

        set({
          user,
          wallets: wallets || [],
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isUnlocked: true,
          isLoading: false
        });

        try {
          const { authStore } = require('../src/store/authStore');
          authStore.login({
            id: user.id,
            email: user.email || `${user.id}@kudi.app`,
            fullName: user.email ? user.email.split('@')[0] : 'Kudi User'
          });
        } catch (e) {}

        return { success: true };
      } else {
        const errorMsg = response?.error?.message || response?.message || 'Privy authentication failed';
        set({ isLoading: false });
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      console.error('Privy auth error details:', err?.message, err?.stack || err);
      set({ isLoading: false });
      return { success: false, error: err?.message || 'Network connection failed' };
    }
  },

  logout: async () => {
    await deleteSecureItem('kudi_access_token');
    await deleteSecureItem('kudi_refresh_token');
    await deleteSecureItem('kudi_user');
    await deleteSecureItem('kudi_wallets');
    sdk.setAuthToken(null);
    set({
      user: null,
      wallets: [],
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isUnlocked: false,
      isLoading: false
    });
  },

  unlock: () => {
    set({ isUnlocked: true });
  },

  lock: () => {
    set({ isUnlocked: false });
  },

  verifyPin: (inputPin: string) => {
    return inputPin === get().pin;
  },

  setPin: async (newPin: string) => {
    await setSecureItem('kudi_user_pin', newPin);
    const userId = get().user?.id;
    if (userId) {
      try {
        await sdk.setPin(userId, newPin);
      } catch (e) {
        console.warn('Failed to sync PIN with server:', e);
      }
    }
    set({ pin: newPin });
  }
}));
