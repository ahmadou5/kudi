import React, { useState, useEffect, useCallback, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { LogOut, HelpCircle } from 'lucide-react-native';
import { useAppPalette } from '../src/lib/theme';
import { useAuthStore, AuthState } from '../src/store/auth.store';
import { usePreferencesStore, PreferencesState } from '../src/store/preferences.store';
import { CustomNumericKeypad } from '../src/components/ui/CustomNumericKeypad';
import { authenticateBiometric, getBiometricAvailability } from '../src/lib/localAuthentication';
import { Avatar, userAvatarSeed } from '../src/components/Avatar';

export default function AuthLockScreen() {
  const palette = useAppPalette();
  const user = useAuthStore((s: AuthState) => s.user);
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated);
  const isUnlocked = useAuthStore((s: AuthState) => s.isUnlocked);
  const hasPin = useAuthStore((s: AuthState) => s.hasPin);
  const unlock = useAuthStore((s: AuthState) => s.unlock);
  const logout = useAuthStore((s: AuthState) => s.logout);
  const verifyPin = useAuthStore((s: AuthState) => s.verifyPin);
  const biometricsEnabled = usePreferencesStore((s: PreferencesState) => s.biometricsEnabled);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bioAvailable, setBioAvailable] = useState(false);
  const autoPromptDone = useRef(false);

  const biometricActive = biometricsEnabled && bioAvailable;

  useEffect(() => {
    getBiometricAvailability().then((availability) => setBioAvailable(availability.available));
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/welcome');
    } else if (isUnlocked || !hasPin) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isUnlocked, hasPin]);

  const handleBiometric = useCallback(async () => {
    const success = await authenticateBiometric('Unlock Kudi Wallet');
    if (success) {
      unlock();
      router.replace('/(tabs)');
    }
  }, [unlock]);

  // Offer biometrics immediately when the user has them enabled
  useEffect(() => {
    if (!biometricActive || autoPromptDone.current) return;
    autoPromptDone.current = true;
    const timer = setTimeout(() => {
      void handleBiometric();
    }, 400);
    return () => clearTimeout(timer);
  }, [biometricActive, handleBiometric]);

  const appendDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    if (nextPin.length === 4) {
      if (verifyPin(nextPin)) {
        unlock();
        router.replace('/(tabs)');
      } else {
        setError('Incorrect PIN. Please try again.');
        setPin('');
      }
    }
  };

  const removeDigit = () => {
    if (pin.length > 0) {
      setPin((prev) => prev.slice(0, -1));
      setError(null);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => logout()} style={styles.topAction} activeOpacity={0.7}>
          <View style={styles.logoutRow}>
            <LogOut size={18} color={palette.error} />
            <Text style={[styles.logoutText, { color: palette.error }]}>Log out</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.helpPill, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <HelpCircle size={16} color={palette.text} />
          <Text style={[styles.helpText, { color: palette.text }]}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* Main Center Area */}
      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Avatar avatarUrl={user?.avatarUrl} seed={userAvatarSeed(user)} size={76} />
        </View>

        <Text style={[styles.heading, { color: palette.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          {biometricActive
            ? 'Enter your 4-digit PIN or use biometrics to unlock'
            : 'Enter your 4-digit PIN to unlock'}
        </Text>

        {/* 4 PIN Indicator Dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pin.length;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    borderColor: error ? palette.error : filled ? palette.primary : palette.border,
                    backgroundColor: filled ? palette.primary : 'transparent'
                  }
                ]}
              />
            );
          })}
        </View>

        {error ? (
          <Text style={[styles.error, { color: palette.error }]}>{error}</Text>
        ) : (
          <View style={{ height: 18 }} />
        )}

        {/* Numeric Keypad */}
        <View style={styles.keypadContainer}>
          <CustomNumericKeypad
            onPressDigit={appendDigit}
            onDelete={removeDigit}
            onBiometricPress={biometricActive ? () => void handleBiometric() : undefined}
          />
        </View>

        <TouchableOpacity style={{ marginTop: 12 }} activeOpacity={0.7}>
          <Text style={[styles.forgot, { color: palette.textSecondary }]}>Forgot PIN?</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, paddingVertical: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20 },
  topAction: { minHeight: 40, justifyContent: 'center' },
  logoutRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoutText: { fontSize: 14, fontWeight: '700' },
  helpPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  helpText: { fontSize: 13, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 4, overflow: 'hidden' },
  heading: { fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 14, marginVertical: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  error: { fontSize: 13, fontWeight: '700' },
  keypadContainer: { width: '100%', maxWidth: 360, marginTop: 10 },
  forgot: { fontSize: 14, fontWeight: '700' }
});
