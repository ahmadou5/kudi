import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Linking,
  ActivityIndicator,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Bell, BellOff, Send, Info } from 'lucide-react-native';
import * as Notifications from 'expo-notifications';
import { useAppPalette, isLight } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { registerPushToken, triggerLocalTestNotification } from '../../lib/notifications';
import { API_BASE_URL } from '../../src/lib/sdk';

export default function NotificationsScreen() {
  const palette = useAppPalette();
  const light = isLight(palette.bg);

  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [transactionAlerts, setTransactionAlerts] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
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
    return () => { active = false; };
  }, []);

  const handleTogglePush = async (value: boolean) => {
    setLoading(true);
    try {
      if (value) {
        const result = await registerPushToken();
        if (result.success) {
          setPermissionStatus(Notifications.PermissionStatus.GRANTED);
          setPushAlerts(true);
          Alert.alert('Notifications Enabled 🎉', 'You will now receive real-time USDC deposit & transaction alerts.');
        } else {
          setPushAlerts(false);
          Alert.alert(
            'Notifications Blocked ⚠️',
            result.error || 'Notifications are disabled in system settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Linking.openSettings() }
            ]
          );
        }
      } else {
        setPushAlerts(false);
        Alert.alert('Notifications Paused', 'You can re-enable push notifications at any time.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setTesting(true);
    try {
      // 1. Local notification
      await triggerLocalTestNotification('Kudi Push Active 🔔', 'Test notification received! Deposit & spend alerts are working.');

      // 2. Server notification test call
      try {
        await fetch(`${API_BASE_URL}/api/v1/auth/test-notification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Server Push Test 🚀', body: 'Live push notification sent from Kudi API backend.' })
        });
      } catch (e) {
        // Fallback
      }

      Alert.alert('Test Notification Sent! 🚀', 'Check your device top banner or notification drawer.');
    } catch (err: any) {
      Alert.alert('Could Not Send Test', err?.message || 'Please verify device notification permissions.');
    } finally {
      setTesting(false);
    }
  };

  const isGranted = permissionStatus === Notifications.PermissionStatus.GRANTED;

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.heroTop}>
            <View style={[styles.bellWrap, { backgroundColor: isGranted ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)' }]}>
              {isGranted ? (
                <Bell size={24} color="#10B981" />
              ) : (
                <BellOff size={24} color="#EF4444" />
              )}
            </View>
            <View style={[styles.statusBadge, { backgroundColor: isGranted ? 'rgba(16,185,129,0.15)' : 'rgba(148,163,184,0.15)' }]}>
              <View style={[styles.dot, { backgroundColor: isGranted ? '#10B981' : '#64748B' }]} />
              <Text style={[styles.statusText, { color: isGranted ? '#10B981' : palette.textSecondary }]}>
                {isGranted ? 'Active' : 'Disabled'}
              </Text>
            </View>
          </View>
          <Text style={[Typography.title3, { color: palette.text, marginTop: 12 }]}>
            Real-Time Push Alerts
          </Text>
          <Text style={[Typography.subhead, { color: palette.textSecondary, marginTop: 4, lineHeight: 20 }]}>
            Get instant mobile alerts for incoming Solana/Monad USDC deposits, virtual card spends, and identity verification.
          </Text>
        </View>

        {/* Toggle List */}
        <View style={[styles.cardGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.rowItem, { borderBottomColor: palette.border }]}>
            <View style={styles.itemLeft}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Push Notifications</Text>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                Allow Kudi to send pop-up alerts on this device
              </Text>
            </View>
            {loading ? (
              <ActivityIndicator size="small" color="#10B981" />
            ) : (
              <Switch
                value={pushAlerts}
                onValueChange={handleTogglePush}
                trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
                thumbColor="#FFFFFF"
              />
            )}
          </View>

          <View style={[styles.rowItem, { borderBottomColor: palette.border }]}>
            <View style={styles.itemLeft}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>USDC Deposit & Payout Alerts</Text>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                Alerts when deposits land on Solana Devnet or payouts settle
              </Text>
            </View>
            <Switch
              value={transactionAlerts}
              onValueChange={setTransactionAlerts}
              trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowItem}>
            <View style={styles.itemLeft}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Security & PIN Alerts</Text>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                Instant notifications on login attempts and PIN updates
              </Text>
            </View>
            <Switch
              value={securityAlerts}
              onValueChange={setSecurityAlerts}
              trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Action Button: Send Test Notification */}
        <TouchableOpacity
          onPress={handleTestNotification}
          disabled={testing}
          style={[styles.testBtn, { backgroundColor: '#10B981' }]}
          activeOpacity={0.8}
        >
          {testing ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Send size={18} color="#FFFFFF" />
              <Text style={styles.testBtnText}>Send Test Push Notification</Text>
            </>
          )}
        </TouchableOpacity>

        {/* System Info */}
        <View style={[styles.infoCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <Info size={20} color={palette.textSecondary} />
          <Text style={[styles.infoText, { color: palette.textSecondary }]}>
            Permission status: {permissionStatus || 'Checking permission state...'}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 16
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  bellWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700'
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  itemLeft: {
    flex: 1,
    paddingRight: 16
  },
  testBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8
  },
  testBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700'
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 4
  },
  infoText: {
    fontSize: 13,
    flex: 1
  }
});
