import React, { useEffect, useState } from 'react';
import { Image, Modal, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { CheckCircle2, Clock, X, XCircle } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { Typography } from '../constants/typography';
import { useAppPalette, hexToRgba, readableInk } from '../lib/theme';
import { haptics } from '../lib/haptics';
import { CardBackgroundPattern } from './ui/CardBackgroundPattern';
import { TransactionTrack } from './ui/TransactionTrack';

interface TransactionResultModalProps {
  visible: boolean;
  type: 'success' | 'failed' | 'pending';
  title: string;
  message: string;
  amount?: string;
  reference?: string;
  onClose: () => void;
  onViewReceipt?: () => void;
}

function formatTimestamp(value: Date) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(value);
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable as any);

function PressableScale({
  children,
  onPress,
  style,
  accessibilityLabel
}: {
  children: React.ReactNode;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPressIn={() => {
        if (reduced) return;
        scale.value = withSpring(0.97, { damping: 20, stiffness: 400 });
      }}
      onPressOut={() => {
        if (reduced) return;
        scale.value = withSpring(1, { damping: 20, stiffness: 400 });
      }}
      onPress={() => {
        haptics.impact('light');
        onPress();
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  );
}

export function TransactionResultModal({
  visible,
  type,
  title,
  message,
  amount,
  reference,
  onClose,
  onViewReceipt
}: TransactionResultModalProps) {
  const palette = useAppPalette();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const isDark = palette.scheme === 'dark';

  // One master clock (0 → 1) drives every staggered entrance in the sheet.
  const entrance = useSharedValue(0);
  const iconPop = useSharedValue(0.6);
  const [openedAt, setOpenedAt] = useState<Date>(new Date());

  useEffect(() => {
    if (!visible) return;

    setOpenedAt(new Date());

    if (reduced) {
      entrance.value = 1;
      iconPop.value = 1;
      return;
    }

    entrance.value = 0;
    iconPop.value = 0.5;

    entrance.value = withDelay(100, withTiming(1, { duration: 640, easing: Easing.out(Easing.cubic) }));
    iconPop.value = withDelay(140, withSpring(1, { damping: 12, mass: 0.6, stiffness: 180 }));
  }, [entrance, iconPop, reduced, visible]);

  // Window helper: maps a slice of the master clock to a 0→1 rise with fade.
  const useRise = (from: number, travel = 22) =>
    useAnimatedStyle(() => {
      const p = interpolate(entrance.value, [from, from + 0.3], [0, 1], Extrapolation.CLAMP);
      return {
        opacity: p,
        transform: [{ translateY: (1 - p) * travel }]
      };
    });

  const heroStyle = useAnimatedStyle(() => ({
    opacity: interpolate(entrance.value, [0, 0.3], [0, 1], Extrapolation.CLAMP),
    transform: [{ scale: iconPop.value }]
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(entrance.value, [0.05, 0.5], [0, 1], Extrapolation.CLAMP)
  }));

  const titleStyle = useRise(0.08);
  const messageStyle = useRise(0.18);
  const trackStyle = useRise(0.32);
  const detailsStyle = useRise(0.5);
  const buttonsStyle = useRise(0.68, 16);

  const tone =
    type === 'success'
      ? {
          soft: hexToRgba(palette.success, 0.12),
          ring: hexToRgba(palette.success, 0.2),
          accent: palette.success
        }
      : type === 'failed'
        ? {
            soft: hexToRgba(palette.error, 0.12),
            ring: hexToRgba(palette.error, 0.2),
            accent: palette.error
          }
        : {
            soft: hexToRgba(palette.warning, 0.12),
            ring: hexToRgba(palette.warning, 0.2),
            accent: palette.warning
          };

  const detailRows: Array<{ label: string; value: string }> = [];
  if (amount) detailRows.push({ label: 'Amount', value: amount });
  if (reference) detailRows.push({ label: 'Reference', value: reference });
  detailRows.push({ label: 'Timestamp', value: formatTimestamp(openedAt) });

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: palette.bg }]}>
        {/* Top bar: brand + dismiss */}
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <View style={styles.topBarSide} />
          <View style={styles.brandRow}>
            <Image
              source={require('../../assets/logos/usdc.png')}
              style={styles.brandLogo}
              resizeMode="contain"
            />
            <Text style={[styles.brandText, { color: palette.text }]}>Kudi</Text>
          </View>
          <View style={styles.topBarSide}>
            <Pressable
              onPress={() => {
                haptics.tap();
                onClose();
              }}
              hitSlop={12}
              style={({ pressed }) => [
                styles.closeBtn,
                { backgroundColor: palette.card, borderColor: palette.border },
                pressed && { opacity: 0.6 }
              ]}
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
            >
              <X size={20} color={palette.text} />
            </Pressable>
          </View>
        </View>

        {/* Compact centered content — no scroll, fits the screen */}
        <View style={styles.content}>
          {/* Hero status block */}
          <Animated.View style={[styles.hero, heroStyle]}>
            <Animated.View
              pointerEvents="none"
              style={[styles.heroGlow, { backgroundColor: hexToRgba(tone.accent, 0.16) }, glowStyle]}
            />
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: tone.soft, borderColor: tone.ring }
              ]}
            >
              {type === 'success' && <CheckCircle2 size={38} color={tone.accent} />}
              {type === 'failed' && <XCircle size={38} color={tone.accent} />}
              {type === 'pending' && <Clock size={36} color={tone.accent} />}
            </View>
          </Animated.View>

          <Animated.View style={[styles.textBlock, titleStyle]}>
            <Text style={[Typography.title2, { color: palette.text, textAlign: 'center' }]}>{title}</Text>
          </Animated.View>

          <Animated.View style={[styles.textBlock, messageStyle]}>
            <Text style={[styles.message, { color: palette.textSecondary }]} numberOfLines={2}>{message}</Text>
          </Animated.View>

          {/* Animated transfer track */}
          <Animated.View style={[styles.section, trackStyle]}>
            <View style={[styles.trackCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <CardBackgroundPattern
                glowColor={hexToRgba(tone.accent, isDark ? 0.1 : 0.07)}
                isDarkOverride={isDark}
              />
              <TransactionTrack type={type} active={visible} />
            </View>
          </Animated.View>

          {/* Receipt-style detail rows */}
          <Animated.View style={[styles.section, detailsStyle]}>
            <View style={[styles.detailsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {detailRows.map((row, index) => (
                <React.Fragment key={row.label}>
                  {index > 0 && <View style={[styles.divider, { backgroundColor: palette.border }]} />}
                  <View style={styles.row}>
                    <Text style={[Typography.caption, { color: palette.textSecondary, letterSpacing: 0.8 }]}>
                      {row.label}
                    </Text>
                    <Text style={[styles.rowValue, { color: palette.text }]} numberOfLines={1}>
                      {row.value}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          </Animated.View>
        </View>

        {/* Actions pinned to the bottom */}
        <Animated.View style={[styles.buttons, { paddingBottom: insets.bottom + 16 }, buttonsStyle]}>
          <PressableScale
            onPress={onClose}
            accessibilityLabel="Done"
            style={[styles.primaryButton, { backgroundColor: tone.accent }]}
          >
            <Text style={[Typography.bodyBold, { color: readableInk(tone.accent), fontSize: 15 }]}>Done</Text>
          </PressableScale>

          {onViewReceipt ? (
            <PressableScale
              onPress={onViewReceipt}
              accessibilityLabel="View receipt"
              style={[styles.secondaryButton, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 15 }]}>View Receipt</Text>
            </PressableScale>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8
  },
  topBarSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  brandLogo: {
    width: 22,
    height: 22,
    borderRadius: 6
  },
  brandText: {
    fontSize: Typography.md,
    fontFamily: Typography.family.mono,
    letterSpacing: 0.5
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 14
  },
  hero: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  textBlock: {
    alignItems: 'center',
    gap: 6
  },
  message: {
    fontSize: Typography.sm,
    lineHeight: 20,
    textAlign: 'center',
    fontFamily: Typography.family.mono,
    maxWidth: 320
  },
  section: {
    width: '100%'
  },
  trackCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    overflow: 'hidden'
  },
  detailsCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 2
  },
  divider: {
    height: StyleSheet.hairlineWidth
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 11
  },
  rowValue: {
    fontSize: Typography.sm,
    fontFamily: Typography.family.mono,
    flexShrink: 1,
    textAlign: 'right'
  },
  buttons: {
    width: '100%',
    paddingHorizontal: 24,
    gap: 10
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
