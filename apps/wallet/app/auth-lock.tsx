import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAppPalette } from '../lib/theme';
import { useAuthStore, AuthState } from '../store/auth.store';
import { CustomNumericKeypad } from '../components/ui/CustomNumericKeypad';

export default function AuthLockScreen() {
  const palette = useAppPalette();
  const user = useAuthStore((s: AuthState) => s.user);
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated);
  const isUnlocked = useAuthStore((s: AuthState) => s.isUnlocked);
  const unlock = useAuthStore((s: AuthState) => s.unlock);
  const logout = useAuthStore((s: AuthState) => s.logout);
  const verifyPin = useAuthStore((s: AuthState) => s.verifyPin);

  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/welcome');
    } else if (isUnlocked) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isUnlocked]);

  const initials = user?.fullName
    ? user.fullName.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase()
    : 'K';

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
        setError('Incorrect PIN. Try 1234');
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

  const triggerBiometric = () => {
    Alert.alert(
      'Biometric Fingerprint Scanner',
      'Scanning fingerprint to unlock Kudi Wallet...',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Authenticate',
          onPress: () => {
            unlock();
            router.replace('/(tabs)');
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => logout()} style={styles.topAction}>
          <Text style={[styles.logoutText, { color: palette.error }]}>Log out</Text>
        </Pressable>
        <Pressable style={[styles.helpPill, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Text style={[styles.helpText, { color: palette.text }]}>🎧 Help</Text>
        </Pressable>
      </View>

      {/* Main Center Area */}
      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Text style={[styles.avatarText, { color: palette.bg }]}>{initials}</Text>
        </View>

        <Text style={[styles.heading, { color: palette.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Enter your PIN or use biometrics.
        </Text>

        {/* 4 PIN Box Indicators */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((idx) => {
            const filled = idx < pin.length;
            return (
              <View
                key={idx}
                style={[
                  styles.dot,
                  {
                    borderColor: error ? palette.error : filled ? palette.text : palette.border,
                    backgroundColor: filled ? palette.text : 'transparent'
                  }
                ]}
              />
            );
          })}
        </View>

        {error ? (
          <Text style={[styles.error, { color: palette.error }]}>{error}</Text>
        ) : (
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            Use demo PIN: 1234
          </Text>
        )}

        {/* Numeric Keypad */}
        <View style={styles.keypadContainer}>
          <CustomNumericKeypad
            onPressDigit={appendDigit}
            onDelete={removeDigit}
            onBiometricPress={triggerBiometric}
          />
        </View>

        <Pressable style={{ marginTop: 12 }}>
          <Text style={[styles.forgot, { color: palette.textSecondary }]}>Forgot PIN?</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, paddingVertical: 16 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 20 },
  topAction: { minHeight: 40, justifyContent: 'center' },
  logoutText: { fontSize: 14, fontWeight: '700' },
  helpPill: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  helpText: { fontSize: 13, fontWeight: '700' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 26, fontWeight: '900' },
  heading: { fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 14, marginVertical: 8 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  error: { fontSize: 13, fontWeight: '700' },
  helper: { fontSize: 12 },
  keypadContainer: { width: '100%', maxWidth: 360, marginTop: 10 },
  forgot: { fontSize: 14, fontWeight: '700' }
});
