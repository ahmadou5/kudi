import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { useAuthStore, AuthState } from '../store/auth.store';
import { CustomNumericKeypad } from '../components/ui/CustomNumericKeypad';
import { AppModal, useAppModal } from '../components/ui/AppModal';

export default function AuthLockScreen() {
  const palette = useAppPalette();
  const modal = useAppModal();
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
        setError('Incorrect PIN. Default is 1234');
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
    modal.show({
      title: 'Biometric Authentication',
      description: 'Scanning fingerprint or face identity to unlock Kudi Wallet...',
      type: 'info',
      primaryText: 'Authenticate',
      onPrimaryPress: () => {
        modal.hide();
        unlock();
        router.replace('/(tabs)');
      },
      secondaryText: 'Cancel',
      onSecondaryPress: modal.hide,
    });
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => logout()} style={styles.topAction} activeOpacity={0.7}>
          <View style={styles.logoutRow}>
            <Ionicons name="log-out-outline" size={18} color={palette.error} />
            <Text style={[styles.logoutText, { color: palette.error }]}>Log out</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.helpPill, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="help-circle-outline" size={16} color={palette.text} />
          <Text style={[styles.helpText, { color: palette.text }]}>Help</Text>
        </TouchableOpacity>
      </View>

      {/* Main Center Area */}
      <View style={styles.content}>
        <View style={[styles.avatar, { backgroundColor: palette.primary }]}>
          <Text style={[styles.avatarText, { color: palette.bg }]}>{initials}</Text>
        </View>

        <Text style={[styles.heading, { color: palette.text }]}>Welcome Back</Text>
        <Text style={[styles.subtitle, { color: palette.textSecondary }]}>
          Enter your 4-digit PIN or use biometrics to unlock
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
          <Text style={[styles.helper, { color: palette.textSecondary }]}>
            Use default PIN: 1234
          </Text>
        )}

        {/* Numeric Keypad */}
        <View style={styles.keypadContainer}>
          <CustomNumericKeypad
            onPressDigit={appendDigit}
            onDelete={removeDigit}
            onBiometricPress={triggerBiometric}
          />
          <AppModal config={modal.config} onClose={modal.hide} />
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
  avatar: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { fontSize: 26, fontWeight: '900' },
  heading: { fontSize: 30, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, textAlign: 'center' },
  dotsRow: { flexDirection: 'row', gap: 14, marginVertical: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  error: { fontSize: 13, fontWeight: '700' },
  helper: { fontSize: 12 },
  keypadContainer: { width: '100%', maxWidth: 360, marginTop: 10 },
  forgot: { fontSize: 14, fontWeight: '700' }
});
