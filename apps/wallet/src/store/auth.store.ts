import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { sdk } from '../lib/sdk';

export interface User {
  id: string;
  privyUserId?: string;
  email?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  dob?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  kycTier?: string;
  kycStatus?: string;
  profileCompleted?: boolean;
  hasPin?: boolean;
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
  hasPin: boolean;

  hydrate: () => Promise<void>;
  sendPrivyOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyPrivyOTP: (email: string, code: string) => Promise<{ success: boolean; error?: string }>;
  loginWithPrivy: (privyPayload: {
    privyToken?: string;
    privyUserId: string;
    email?: string;
    phoneNumber?: string;
    name?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    dob?: string;
    avatarUrl?: string;
    profileCompleted?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  unlock: () => void;
  lock: () => void;
  verifyPin: (inputPin: string) => boolean;
  setPin: (newPin: string) => Promise<void>;
  clearPin: () => Promise<void>;
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

const pinStorageKey = (userId: string) => `kudi_user_pin:${userId}`;

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  wallets: [],
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isUnlocked: false,
  isLoading: true,
  pin: '',
  hasPin: false,

  hydrate: async () => {
    try {
      const storedToken = await getSecureItem('kudi_access_token');
      const storedRefreshToken = await getSecureItem('kudi_refresh_token');
      const storedUser = await getSecureItem('kudi_user');
      const storedWallets = await getSecureItem('kudi_wallets');

      if (storedToken && storedUser) {
        const user: User = JSON.parse(storedUser);
        const wallets = storedWallets ? JSON.parse(storedWallets) : [];
        sdk.setAuthToken(storedToken);

        // Per-user PIN key; migrate the legacy unscoped key written by older builds
        let storedPin = await getSecureItem(pinStorageKey(user.id));
        if (!storedPin) {
          const legacyPin = await getSecureItem('kudi_user_pin');
          if (legacyPin) {
            storedPin = legacyPin;
            await setSecureItem(pinStorageKey(user.id), legacyPin);
          }
        }
        await deleteSecureItem('kudi_user_pin');

        set({
          user,
          wallets,
          accessToken: storedToken,
          refreshToken: storedRefreshToken,
          isAuthenticated: true,
          isUnlocked: false,
          isLoading: false,
          pin: storedPin || '',
          hasPin: !!storedPin
        });

        // Refresh server-side PIN status once per launch (cached user may predate hasPin)
        if (user.hasPin === undefined) {
          void sdk
            .getUserProfile(user.id)
            .then((res: any) => {
              const fresh = res?.data?.user as User | undefined;
              const current = get().user;
              if (fresh && typeof fresh.hasPin === 'boolean' && current?.id === fresh.id) {
                const updated = { ...current, hasPin: fresh.hasPin };
                set({ user: updated });
                void setSecureItem('kudi_user', JSON.stringify(updated));
              }
            })
            .catch(() => {});
        }
      } else {
        set({ isAuthenticated: false, isLoading: false });
      }
    } catch (err) {
      console.error('Auth store hydration failed:', err);
      set({ isAuthenticated: false, isLoading: false });
    }
  },

  sendPrivyOTP: async (email: string) => {
    try {
      console.log('[AuthStore] Sending Privy OTP to:', email);
      const res = await sdk.sendPrivyOTP(email);
      if (res && (res.success || res.sent)) {
        return { success: true };
      }
      return { success: false, error: res?.error?.message || res?.message || 'Failed to send OTP code' };
    } catch (err: any) {
      console.error('[AuthStore] sendPrivyOTP error:', err);
      return { success: false, error: err?.message || 'Failed to send OTP code' };
    }
  },

  verifyPrivyOTP: async (email: string, code: string) => {
    try {
      set({ isLoading: true });
      console.log('[AuthStore] Verifying Privy OTP for:', email);
      const response = await sdk.verifyPrivyOTP(email, code);
      console.log('[AuthStore] Verify OTP response:', response);

      if (response && response.success && response.data) {
        const { user, wallets, accessToken, refreshToken } = response.data;

        await setSecureItem('kudi_access_token', accessToken);
        if (refreshToken) await setSecureItem('kudi_refresh_token', refreshToken);
        await setSecureItem('kudi_user', JSON.stringify(user));
        if (wallets) await setSecureItem('kudi_wallets', JSON.stringify(wallets));

        sdk.setAuthToken(accessToken);

        const localPin = await getSecureItem(pinStorageKey(user.id));
        set({
          user,
          wallets: wallets || [],
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isUnlocked: true,
          isLoading: false,
          pin: localPin || '',
          hasPin: !!localPin
        });

        return { success: true };
      } else {
        const errorMsg = response?.error?.message || response?.message || 'Invalid verification code';
        set({ isLoading: false });
        return { success: false, error: errorMsg };
      }
    } catch (err: any) {
      console.error('[AuthStore] verifyPrivyOTP error:', err);
      set({ isLoading: false });
      return { success: false, error: err?.message || 'Network connection failed' };
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

        const localPin = await getSecureItem(pinStorageKey(user.id));
        set({
          user,
          wallets: wallets || [],
          accessToken,
          refreshToken,
          isAuthenticated: true,
          isUnlocked: true,
          isLoading: false,
          pin: localPin || '',
          hasPin: !!localPin
        });

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
      isLoading: false,
      pin: '',
      hasPin: false
    });
  },

  deleteAccount: async () => {
    const currentUser = get().user;
    if (currentUser?.id) {
      try {
        await sdk.deleteAccount(currentUser.id);
      } catch (err: any) {
        console.warn('Backend deleteAccount request warning:', err?.message || err);
      }
      await deleteSecureItem(pinStorageKey(currentUser.id));
    }
    await get().logout();
    return { success: true };
  },

  unlock: () => {
    set({ isUnlocked: true });
  },

  updateProfile: async (data: {
    fullName?: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    dob?: string;
    avatarUrl?: string;
    profileCompleted?: boolean;
  }) => {
    const currentUser = get().user;
    if (!currentUser) return { success: false, error: 'User not logged in' };

    const calculatedFullName = data.fullName || (data.firstName && data.lastName ? `${data.firstName.trim()} ${data.lastName.trim()}` : currentUser.fullName);

    const updatedUser: User = {
      ...currentUser,
      ...data,
      fullName: calculatedFullName
    };

    set({ user: updatedUser });
    await setSecureItem('kudi_user', JSON.stringify(updatedUser));

    try {
      await sdk.updateUserProfile(currentUser.id, {
        ...data,
        fullName: calculatedFullName
      });
    } catch (e) {
      console.warn('Failed to sync profile update with server:', e);
    }

    return { success: true };
  },

  lock: () => {
    set({ isUnlocked: false });
  },

  verifyPin: (inputPin: string) => {
    const storedPin = get().pin;
    if (!storedPin || !inputPin) return false;
    return inputPin === storedPin;
  },

  setPin: async (newPin: string) => {
    const currentUser = get().user;
    if (currentUser?.id) {
      let res: any;
      try {
        res = await sdk.setPin(currentUser.id, newPin);
      } catch (e) {
        console.warn('Failed to sync PIN with server:', e);
        throw new Error('Could not save your PIN. Please check your connection and try again.');
      }
      if (res && res.success === false) {
        console.warn('PIN rejected by server:', res.message || res.error);
        throw new Error(res.message || 'Could not save your PIN. Please try again.');
      }
    }
    await setSecureItem(pinStorageKey(currentUser?.id || 'unknown'), newPin);
    await deleteSecureItem('kudi_user_pin');
    if (currentUser) {
      const updatedUser: User = { ...currentUser, hasPin: true };
      await setSecureItem('kudi_user', JSON.stringify(updatedUser));
      set({ user: updatedUser, pin: newPin, hasPin: true });
    } else {
      set({ pin: newPin, hasPin: true });
    }
  },

  clearPin: async () => {
    const currentUser = get().user;
    if (currentUser?.id) {
      await deleteSecureItem(pinStorageKey(currentUser.id));
    }
    await deleteSecureItem('kudi_user_pin');
    set({ pin: '', hasPin: false });
  }
}));
