import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { ShieldCheck, Fingerprint, Lock } from 'lucide-react-native';
import { useAppPalette, isLight, hexToRgba, readableInk } from '../lib/theme';
import { useAuthStore, AuthState } from '../store/auth.store';
import { usePreferencesStore, PreferencesState } from '../store/preferences.store';
import { Typography } from '../constants/typography';
import { authenticateBiometric, getBiometricAvailability } from '../lib/localAuthentication';

type CardAction = 'pin' | 'lock';

/**
 * Home-screen security nudges:
 *  - PIN card: shown while the account has no transaction PIN on the server.
 *  - App-lock/biometrics card: shown once a PIN exists but fingerprint unlock
 *    (or the app lock itself) has not been enabled yet.
 * Both dismiss for the rest of the session and re-appear on the next launch
 * if still unresolved.
 */
export const SecurityPromptCards = () => {
  const palette = useAppPalette();
  const light = isLight(palette.bg);
  const user = useAuthStore((s: AuthState) => s.user);
  const appLockEnabled = usePreferencesStore((s: PreferencesState) => s.appLockEnabled);
  const biometricsEnabled = usePreferencesStore((s: PreferencesState) => s.biometricsEnabled);
  const setAppLockEnabled = usePreferencesStore((s: PreferencesState) => s.setAppLockEnabled);
  const setBiometricsEnabled = usePreferencesStore((s: PreferencesState) => s.setBiometricsEnabled);

  const [dismissed, setDismissed] = useState<Set<CardAction>>(new Set());
  const [bioAvailable, setBioAvailable] = useState(false);
  const [bioResolved, setBioResolved] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    getBiometricAvailability().then((a) => {
      setBioAvailable(a.available);
      setBioResolved(true);
    });
  }, []);

  const dismiss = (card: CardAction) => {
    setDismissed((prev) => new Set(prev).add(card));
  };

  const serverHasPin = user?.hasPin === true;
  const needsPinCard = user?.hasPin === false && !dismissed.has('pin');
  const canUseBiometrics = bioResolved && bioAvailable && !biometricsEnabled;
  // Fingerprint card when biometrics aren't on yet; app-lock card when the lock itself is off.
  // Only meaningful once a PIN exists (biometrics need a PIN fallback).
  const showLockCard =
    bioResolved &&
    serverHasPin &&
    (canUseBiometrics || !appLockEnabled) &&
    !dismissed.has('lock');

  if (needsPinCard) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
          styles.wrapper
        ]}
      >
        <View style={styles.row}>
          <View style={[styles.iconBadge, { backgroundColor: hexToRgba(palette.warning, light ? 0.22 : 0.15) }]}>
            <ShieldCheck size={20} color={palette.warning} />
          </View>
          <View style={styles.copyBlock}>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>Secure your wallet</Text>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>
              Create a 4-digit PIN to protect your money and confirm transactions.
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
            onPress={() => router.push('/settings/set-pin')}
            activeOpacity={0.8}
            disabled={enabling}
          >
            <Text style={[styles.primaryBtnText, { color: readableInk(palette.primary) }]}>Set up PIN</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => dismiss('pin')}
            activeOpacity={0.7}
            disabled={enabling}
          >
            <Text style={[styles.secondaryBtnText, { color: palette.textSecondary }]}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (showLockCard) {
    const enable = async () => {
      setActionError(null);
      setEnabling(true);
      try {
        if (canUseBiometrics) {
          const success = await authenticateBiometric('Enable fingerprint unlock for Kudi');
          if (!success) {
            setActionError('Biometric authentication was not completed. You can try again anytime.');
            return;
          }
          setBiometricsEnabled(true);
          setAppLockEnabled(true);
        } else if (!appLockEnabled) {
          setAppLockEnabled(true);
        }
      } finally {
        setEnabling(false);
      }
    };

    return (
      <View
        style={[
          styles.card,
          { backgroundColor: palette.card, borderColor: palette.border },
          styles.wrapper
        ]}
      >
        <View style={styles.row}>
          <View style={[styles.iconBadge, { backgroundColor: hexToRgba(palette.primary, light ? 0.18 : 0.15) }]}>
            {canUseBiometrics ? (
              <Fingerprint size={20} color={palette.primary} />
            ) : (
              <Lock size={20} color={palette.primary} />
            )}
          </View>
          <View style={styles.copyBlock}>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>
              {canUseBiometrics ? 'Enable Fingerprint Unlock' : 'Enable App Lock'}
            </Text>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>
              {canUseBiometrics
                ? 'Unlock Kudi instantly with your fingerprint instead of typing your PIN.'
                : 'Ask for your PIN whenever Kudi opens or returns from the background.'}
            </Text>
          </View>
        </View>
        {actionError ? (
          <Text style={[Typography.caption, styles.errorText, { color: palette.error }]}>
            {actionError}
          </Text>
        ) : null}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: palette.primary }]}
            onPress={() => void enable()}
            activeOpacity={0.8}
            disabled={enabling}
          >
            {enabling ? (
              <ActivityIndicator size="small" color={readableInk(palette.primary)} />
            ) : (
              <Text style={[styles.primaryBtnText, { color: readableInk(palette.primary) }]}>
                {canUseBiometrics ? 'Enable' : 'Turn on'}
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => dismiss('lock')}
            activeOpacity={0.7}
            disabled={enabling}
          >
            <Text style={[styles.secondaryBtnText, { color: palette.textSecondary }]}>Not now</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  copyBlock: {
    flex: 1,
    gap: 4
  },
  errorText: {
    marginTop: -6
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  primaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: '700'
  },
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700'
  }
});
