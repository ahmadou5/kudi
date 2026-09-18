import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { Wrench, Clock, RefreshCw, ShieldAlert } from 'lucide-react-native';

import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { API_BASE_URL, sdk } from '../lib/sdk';
import { socket } from '../lib/socket';

export interface MaintenanceConfig {
  enabled: boolean;
  message: string;
  estimatedMinutes?: number | null;
  updatedAt?: string | null;
}

export function MaintenanceOverlay() {
  const palette = useAppPalette();
  const [maintenance, setMaintenance] = useState<MaintenanceConfig>({
    enabled: false,
    message: '',
    estimatedMinutes: null,
    updatedAt: null,
  });
  const [isChecking, setIsChecking] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Gentle breathing glow animation for the upgrade icon container
  useEffect(() => {
    if (maintenance.enabled) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [maintenance.enabled, pulseAnim]);

  const checkStatus = useCallback(async () => {
    try {
      setIsChecking(true);
      const res = await sdk.getHealthConfig();
      if (res?.data?.maintenance) {
        const m = res.data.maintenance;
        setMaintenance({
          enabled: Boolean(m.enabled),
          message: m.message || '',
          estimatedMinutes: m.estimatedMinutes ?? null,
          updatedAt: m.updatedAt ?? null,
        });
      }
    } catch {
      // Fallback direct fetch if SDK wrapper encounters network hiccup
      try {
        const response = await fetch(`${API_BASE_URL}/api/v1/health/config`, {
          headers: { 'Content-Type': 'application/json' },
        });
        if (response.ok) {
          const json = await response.json();
          if (json?.data?.maintenance) {
            const m = json.data.maintenance;
            setMaintenance({
              enabled: Boolean(m.enabled),
              message: m.message || '',
              estimatedMinutes: m.estimatedMinutes ?? null,
              updatedAt: m.updatedAt ?? null,
            });
          }
        }
      } catch (innerErr) {
        console.warn('[MaintenanceOverlay] Status check failed:', innerErr);
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    // Initial check on mount
    void checkStatus();

    // Regular background polling every 15 seconds
    const interval = setInterval(() => {
      if (active) void checkStatus();
    }, 15000);

    // Instant socket push listener for real-time unlock/lock
    const handleSocketMaintenance = (data: MaintenanceConfig) => {
      if (active && data && typeof data.enabled === 'boolean') {
        setMaintenance({
          enabled: Boolean(data.enabled),
          message: data.message || '',
          estimatedMinutes: data.estimatedMinutes ?? null,
          updatedAt: data.updatedAt ?? null,
        });
      }
    };

    socket.on('system:maintenance', handleSocketMaintenance);

    return () => {
      active = false;
      clearInterval(interval);
      socket.off('system:maintenance', handleSocketMaintenance);
    };
  }, [checkStatus]);

  if (!maintenance.enabled) {
    return null;
  }

  const defaultMessage =
    "We're currently updating Metropolis to bring you improved performance, faster settlement, and top-tier security. We'll be back online shortly!";

  return (
    <Modal
      visible={true}
      animationType="fade"
      transparent={false}
      statusBarTranslucent={true}
    >
      <View style={[styles.container, { backgroundColor: palette.bg }]}>
        <View style={styles.card}>
          {/* Animated Icon Wrapper with Apple design soft spring glow */}
          <Animated.View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: `${palette.primary}15`,
                borderColor: `${palette.primary}30`,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Wrench size={42} color={palette.primary} strokeWidth={2.2} />
          </Animated.View>

          {/* Upgrade Badge */}
          <View style={[styles.badge, { backgroundColor: `${palette.primary}12`, borderColor: `${palette.primary}25` }]}>
            <ShieldAlert size={12} color={palette.primary} />
            <Text style={[styles.badgeText, { color: palette.primary }]}>
              CORE ENGINE UPGRADE
            </Text>
          </View>

          {/* Main Title */}
          <Text style={[styles.heading, { color: palette.text }]}>
            SYSTEM UPGRADE IN PROGRESS
          </Text>

          {/* Informational Message */}
          <Text style={[styles.message, { color: palette.textSecondary }]}>
            {maintenance.message || defaultMessage}
          </Text>

          {/* Estimated Completion Pill Badge */}
          {maintenance.estimatedMinutes ? (
            <View
              style={[
                styles.timerBadge,
                { backgroundColor: palette.card, borderColor: palette.border },
              ]}
            >
              <Clock size={15} color={palette.primary} />
              <Text style={[styles.timerText, { color: palette.text }]}>
                Estimated completion: ~{maintenance.estimatedMinutes} mins
              </Text>
            </View>
          ) : null}

          {/* Status Indicator */}
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={palette.primary} />
            <Text style={[styles.loaderText, { color: palette.textSecondary }]}>
              {isChecking ? 'Verifying system readiness...' : 'Live status monitoring active'}
            </Text>
          </View>

          {/* Manual Retry Button with Direct Tactile Feel */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={checkStatus}
            disabled={isChecking}
            style={[
              styles.retryButton,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
                opacity: isChecking ? 0.6 : 1,
              },
            ]}
          >
            <RefreshCw
              size={14}
              color={palette.text}
              style={{ transform: [{ rotate: isChecking ? '180deg' : '0deg' }] }}
            />
            <Text style={[styles.retryText, { color: palette.text }]}>
              {isChecking ? 'Checking...' : 'Check Again'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  iconWrapper: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 99,
    borderWidth: 1,
    marginBottom: 16,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: Typography.family.bold,
    letterSpacing: 0.6,
  },
  heading: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: Typography.family.bold,
    textAlign: 'center',
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Typography.family.regular,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 99,
    borderWidth: 1,
    marginBottom: 20,
  },
  timerText: {
    fontSize: 13,
    fontFamily: Typography.family.semibold,
  },
  loaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  loaderText: {
    fontSize: 12,
    fontFamily: Typography.family.regular,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  retryText: {
    fontSize: 13,
    fontFamily: Typography.family.semibold,
  },
});
