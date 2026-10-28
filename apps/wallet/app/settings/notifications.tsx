import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ArrowLeft, Bell, BellOff, Info, Send } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { registerPushToken, triggerLocalTestNotification } from '../../src/lib/notifications';
import { API_BASE_URL } from '../../src/lib/sdk';
import { usePreferencesStore, PreferencesState } from '../../src/store/preferences.store';
import { AppModal, useAppModal } from '../../src/components/ui/AppModal';
import { EnterSection } from '../../src/lib/animations';
import { haptics } from '../../src/lib/haptics';

export default function NotificationsScreen() {
  const palette = useAppPalette();
  const modal = useAppModal();

  const txAlertsEnabled = usePreferencesStore((s: PreferencesState) => s.txAlertsEnabled);
  const setTxAlertsEnabled = usePreferencesStore((s: PreferencesState) => s.setTxAlertsEnabled);
  const securityAlertsEnabled = usePreferencesStore(
    (s: PreferencesState) => s.securityAlertsEnabled
  );
  const setSecurityAlertsEnabled = usePreferencesStore(
    (s: PreferencesState) => s.setSecurityAlertsEnabled
  );

  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const perms = await Notifications.getPermissionsAsync();
        if (active) {
          setPermissionStatus(perms.status);
          setPushAlerts(perms.status === 'granted');
        }
      } catch (err) {
        // Native module not available (Expo Go) — show undetermined state
        console.warn('[Notifications] getPermissionsAsync unavailable (needs dev build):', err);
        if (active) setPermissionStatus(Notifications.PermissionStatus.UNDETERMINED);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const handleTogglePush = async (value: boolean) => {
    setLoading(true);
    try {
      if (value) {
        const result = await registerPushToken();
        if (result.success) {
          setPermissionStatus(Notifications.PermissionStatus.GRANTED);
          setPushAlerts(true);
          modal.alert(
            'Notifications Enabled',
            'You will now receive real-time USDC deposit & transaction alerts.',
            'success'
          );
        } else {
          setPushAlerts(false);
          modal.show({
            title: 'Notifications Blocked',
            description:
              result.error || 'Notifications are disabled in system settings. Enable them to keep receiving alerts.',
            type: 'warning',
            primaryText: 'Open Settings',
            onPrimaryPress: () => {
              modal.hide();
              void Linking.openSettings();
            },
            secondaryText: 'Not now',
            onSecondaryPress: () => modal.hide()
          });
        }
      } else {
        setPushAlerts(false);
        modal.alert('Notifications Paused', 'You can re-enable push notifications at any time.', 'info');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    haptics.tap();
    setTesting(true);
    try {
      // 1. Local notification
      await triggerLocalTestNotification(
        'Kudi Push Active',
        'Test notification received! Deposit & spend alerts are working.'
      );

      // 2. Server notification test call
      try {
        await fetch(`${API_BASE_URL}/api/v1/auth/test-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Server Push Test',
            body: 'Live push notification sent from Kudi API backend.'
          })
        });
      } catch {
        // Fallback — local notification already delivered
      }

      modal.alert(
        'Test Notification Sent',
        'Check your device top banner or notification drawer.',
        'success'
      );
    } catch (err: any) {
      modal.alert(
        'Could Not Send Test',
        err?.message || 'Please verify device notification permissions.',
        'error'
      );
    } finally {
      setTesting(false);
    }
  };

  const isGranted = permissionStatus === Notifications.PermissionStatus.GRANTED;
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
        <Text style={[Typography.title1, { color: palette.text }]}>Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Status hero ── */}
        <EnterSection index={0}>
          <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.heroTop}>
              <View
                style={[
                  styles.iconTile,
                  {
                    backgroundColor: hexToRgba(isGranted ? palette.success : palette.error, 0.14)
                  }
                ]}
              >
                {isGranted ? (
                  <Bell size={22} color={palette.success} strokeWidth={2} />
                ) : (
                  <BellOff size={22} color={palette.error} strokeWidth={2} />
                )}
              </View>
              <View
                style={[
                  styles.statusPill,
                  { backgroundColor: hexToRgba(isGranted ? palette.success : palette.error, 0.14) }
                ]}
              >
                <View
                  style={[styles.statusDot, { backgroundColor: isGranted ? palette.success : palette.error }]}
                />
                <Text
                  style={[
                    Typography.footnote,
                    { color: isGranted ? palette.success : palette.error, fontWeight: '700' }
                  ]}
                >
                  {isGranted ? 'Active' : 'Disabled'}
                </Text>
              </View>
            </View>
            <Text style={[Typography.title3, { color: palette.text, marginTop: 14 }]}>
              Real-Time Push Alerts
            </Text>
            <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.55), marginTop: 4, lineHeight: 20 }]}>
              Get instant mobile alerts for incoming Solana/Monad USDC deposits, virtual card
              spends, and identity verification.
            </Text>
          </View>
        </EnterSection>

        {/* ── Push toggle ── */}
        <EnterSection index={1}>
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>PUSH</Text>
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: tileTint }]}>
                  <Bell size={18} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>Push Notifications</Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    Allow Kudi to send pop-up alerts on this device
                  </Text>
                </View>
                {loading ? (
                  <ActivityIndicator size="small" color={palette.success} />
                ) : (
                  <Switch
                    value={pushAlerts}
                    onValueChange={handleTogglePush}
                    trackColor={switchTrack}
                    thumbColor="#FFFFFF"
                  />
                )}
              </View>
            </View>
          </View>
        </EnterSection>

        {/* ── Alert types ── */}
        <EnterSection index={2}>
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>
              ALERT TYPES
            </Text>
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>
                    USDC Deposit & Payout Alerts
                  </Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    Alerts when deposits land on Solana Devnet or payouts settle
                  </Text>
                </View>
                <Switch
                  value={txAlertsEnabled}
                  onValueChange={(v) => {
                    haptics.tap();
                    setTxAlertsEnabled(v);
                  }}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                />
              </View>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <View style={styles.row}>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>Security & PIN Alerts</Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    Instant notifications on login attempts and PIN updates
                  </Text>
                </View>
                <Switch
                  value={securityAlertsEnabled}
                  onValueChange={(v) => {
                    haptics.tap();
                    setSecurityAlertsEnabled(v);
                  }}
                  trackColor={switchTrack}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>
          </View>
        </EnterSection>

        {/* ── Test ── */}
        <EnterSection index={3}>
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>TEST</Text>
            <Pressable
              onPress={handleTestNotification}
              disabled={testing}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primaryBtn,
                { backgroundColor: palette.text },
                (testing || pressed) && { opacity: 0.9 }
              ]}
            >
              {testing ? (
                <ActivityIndicator color={palette.bg} />
              ) : (
                <>
                  <Send size={17} color={palette.bg} />
                  <Text style={[Typography.currencySub, { color: palette.bg }]}>
                    Send Test Push Notification
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </EnterSection>

        {/* ── System info ── */}
        <EnterSection index={4}>
          <View style={[styles.infoRow, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Info size={17} color={palette.textSecondary} strokeWidth={1.9} />
            <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.55), flex: 1 }]}>
              Permission status: {permissionStatus || 'Checking permission state…'}
            </Text>
          </View>
        </EnterSection>

        <AppModal config={modal.config} onClose={modal.hide} />
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
  heroCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  iconTile: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4
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
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  divider: {
    height: 1,
    marginLeft: 66
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowCopy: { flex: 1 },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  infoRow: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    alignItems: 'center'
  }
});
