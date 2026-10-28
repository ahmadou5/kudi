import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, ChevronRight, Fingerprint, Key, KeyRound } from 'lucide-react-native';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { usePreferencesStore, PreferencesState } from '../../src/store/preferences.store';
import { useAuthStore } from '../../src/store/auth.store';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { authenticateBiometric, getBiometricAvailability } from '../../src/lib/localAuthentication';
import { EnterSection } from '../../src/lib/animations';

export default function SecurityScreen() {
  const palette = useAppPalette();
  const appLockEnabled = usePreferencesStore((s: PreferencesState) => s.appLockEnabled);
  const setAppLockEnabled = usePreferencesStore((s: PreferencesState) => s.setAppLockEnabled);
  const biometricsEnabled = usePreferencesStore((s: PreferencesState) => s.biometricsEnabled);
  const setBiometricsEnabled = usePreferencesStore((s: PreferencesState) => s.setBiometricsEnabled);
  const hasPin = useAuthStore((s) => s.hasPin);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    getBiometricAvailability().then((a) => setBioAvailable(a.available));
  }, []);

  const handleBiometricsToggle = async (enabled: boolean) => {
    if (!enabled) {
      setBiometricsEnabled(false);
      return;
    }
    if (!bioAvailable || !hasPin) return;
    const success = await authenticateBiometric('Enable fingerprint unlock for Kudi');
    if (success) {
      setBiometricsEnabled(true);
      setAppLockEnabled(true);
    }
  };

  const tileTint = hexToRgba(palette.text, 0.07);
  const switchTrack = { false: hexToRgba(palette.text, 0.15), true: palette.success };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibility-label="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.6 }
          ]}
        >
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[Typography.title1, { color: palette.text }]}>Security</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <EnterSection index={0}>
          <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5), paddingHorizontal: 4 }]}>
            Protect your account and transactions
          </Text>
        </EnterSection>

        {/* ── Authentication ── */}
        <EnterSection index={1}>
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>AUTHENTICATION</Text>
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Pressable
                onPress={() => router.push('/settings/set-pin')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: hexToRgba(palette.text, 0.05) }]}
              >
                <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                  <KeyRound size={19} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>
                    {hasPin ? 'Change 4-Digit PIN' : 'Create 4-Digit PIN'}
                  </Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    {hasPin ? 'Update your transaction PIN' : 'Set a PIN to confirm transactions'}
                  </Text>
                </View>
                <ChevronRight size={17} color={hexToRgba(palette.text, 0.35)} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.row}>
                <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                  <Fingerprint size={19} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>Fingerprint / Face Unlock</Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    {!bioAvailable
                      ? 'Not available on this device'
                      : !hasPin
                        ? 'Set a PIN first to use biometrics'
                        : 'Unlock the app without typing your PIN'}
                  </Text>
                </View>
                <Switch
                  value={biometricsEnabled}
                  onValueChange={(v) => void handleBiometricsToggle(v)}
                  disabled={!bioAvailable || !hasPin}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                  style={(!bioAvailable || !hasPin) && { opacity: 0.5 }}
                />
              </View>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.row}>
                <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                  <Key size={19} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>Require Passcode on Launch</Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    Lock app when sent to background
                  </Text>
                </View>
                <Switch
                  value={appLockEnabled}
                  onValueChange={setAppLockEnabled}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </EnterSection>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: 6,
    paddingBottom: 40,
    gap: 20
  },
  group: { gap: 8 },
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  divider: {
    height: 1,
    marginLeft: 66
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowCopy: { flex: 1 }
});
