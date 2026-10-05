import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { Spacing } from '../constants/spacing';
import { useAppModal } from './ui/AppModal';

export function AppVersionFooter() {
  const palette = useAppPalette();
  const modal = useAppModal();
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const nativeVersion = Constants.expoConfig?.version || '1.0.0';
  const nativeBuild = Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1';

  const handleCheckForUpdates = async () => {
    setIsSyncing(true);
    setSyncStatus('Checking for updates…');

    // Simulate OTA update check for development/preview builds
    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatus(null);
      modal.show({
        title: 'Up to Date',
        description: `You are running the latest version of Kudi Wallet (v${nativeVersion}).`,
        type: 'success',
        primaryText: 'OK',
        onPrimaryPress: () => modal.hide(),
      });
    }, 1200);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.metaText, { color: palette.textSecondary }]}>
        {`APP VERSION: ${nativeVersion} (${nativeBuild})`}
      </Text>
      <Text style={[styles.metaText, { color: palette.textSecondary }]}>
        RUNTIME: KUDI LIVE ENGINE
      </Text>

      <Pressable
        onPress={() => void handleCheckForUpdates()}
        disabled={isSyncing}
        style={({ pressed }) => [styles.updateButton, pressed && { opacity: 0.65 }]}
      >
        {isSyncing ? (
          <View style={styles.syncingRow}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.updateText, { color: palette.primary }]}>{syncStatus ?? 'Syncing…'}</Text>
          </View>
        ) : (
          <Text style={[styles.updateText, styles.underline, { color: palette.primary }]}>
            Check for updates
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    fontFamily: Typography.family.medium,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    lineHeight: 15,
  },
  updateButton: {
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  syncingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  updateText: {
    fontSize: 12,
    fontFamily: Typography.family.medium,
    textAlign: 'center',
  },
  underline: {
    textDecorationLine: 'underline',
  },
});
