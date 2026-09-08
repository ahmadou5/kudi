import { useState, useEffect } from 'react';

export interface WalletData {
  chain: string;
  address: string;
  metadata?: Record<string, any>;
}

export interface UserSession {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string;
  pinHash?: string;
  privyUserId?: string;
  kycStatus?: string;
  kycTier?: string;
  accessToken?: string;
  refreshToken?: string;
  wallets?: WalletData[];
}

// In-memory global state for React Native wallet authentication & app lock
let globalAuthState = {
  isAuthenticated: false,
  isUnlocked: false,
  appLockEnabled: true,
  user: null as UserSession | null,
  pin: '1234' // Default demo PIN
};

const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const authStore = {
  get state() {
    return globalAuthState;
  },

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  login(user: UserSession) {
    globalAuthState = {
      ...globalAuthState,
      isAuthenticated: true,
      isUnlocked: true,
      user
    };
    notify();
  },

  logout() {
    globalAuthState = {
      ...globalAuthState,
      isAuthenticated: false,
      isUnlocked: false,
      user: null
    };
    notify();
  },

  lock() {
    globalAuthState = {
      ...globalAuthState,
      isUnlocked: false
    };
    notify();
  },

  unlock() {
    globalAuthState = {
      ...globalAuthState,
      isUnlocked: true
    };
    notify();
  },

  verifyPin(inputPin: string): boolean {
    return inputPin === globalAuthState.pin;
  },

  setPin(newPin: string) {
    globalAuthState = {
      ...globalAuthState,
      pin: newPin
    };
    notify();
  }
};

export function useAuthStore(): typeof authStore.state & {
  login: typeof authStore.login;
  logout: typeof authStore.logout;
  lock: typeof authStore.lock;
  unlock: typeof authStore.unlock;
  verifyPin: typeof authStore.verifyPin;
  setPin: typeof authStore.setPin;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const unsubscribe = authStore.subscribe(() => {
      setTick((t) => t + 1);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...authStore.state,
    login: authStore.login,
    logout: authStore.logout,
    lock: authStore.lock,
    unlock: authStore.unlock,
    verifyPin: authStore.verifyPin,
    setPin: authStore.setPin
  };
}
