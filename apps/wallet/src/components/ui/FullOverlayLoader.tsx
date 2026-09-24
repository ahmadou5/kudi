import React, { useEffect, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  Animated,
  Easing,
  Dimensions,
  Platform
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Sparkles, Zap, ShieldCheck } from 'lucide-react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { useLoaderStore } from '../../store/loader.store';

const { width } = Dimensions.get('window');

export interface FullOverlayLoaderProps {
  visible?: boolean;
  message?: string;
  title?: string;
}

export function FullOverlayLoader({
  visible: propVisible,
  message: propMessage,
  title: propTitle
}: FullOverlayLoaderProps) {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';

  // Global store fallback if props not directly passed
  const storeVisible = useLoaderStore((s) => s.visible);
  const storeMessage = useLoaderStore((s) => s.message);
  const storeTitle = useLoaderStore((s) => s.title);

  const isVisible = propVisible !== undefined ? propVisible : storeVisible;
  const displayMessage = propMessage || storeMessage || 'Processing...';
  const displayTitle = propTitle || storeTitle || 'KUDI';

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const dotCount = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isVisible) {
      // Fade in modal container
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }).start();

      // Continuous 360 Rotation
      const spin = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1600,
          easing: Easing.linear,
          useNativeDriver: true
        })
      );

      // Continuous Pulsing Glow
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true
          })
        ])
      );

      spin.start();
      pulse.start();

      return () => {
        spin.stop();
        pulse.stop();
      };
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [isVisible]);

  if (!isVisible) return null;

  const spinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg']
  });

  const reverseSpinInterpolation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['360deg', '0deg']
  });

  return (
    <Modal
      transparent
      animationType="none"
      visible={isVisible}
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
        {/* Blurred background backdrop */}
        {Platform.OS === 'ios' ? (
          <BlurView
            intensity={isDark ? 50 : 65}
            tint={isDark ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {/* Tint overlay for contrast */}
        <View
          style={[
            StyleSheet.absoluteFill,
            {
              backgroundColor: isDark
                ? 'rgba(10, 14, 26, 0.82)'
                : 'rgba(248, 250, 252, 0.88)'
            }
          ]}
        />

        {/* Elevated Glass Loader Card */}
        <View
          style={[
            styles.loaderCard,
            {
              backgroundColor: isDark ? 'rgba(21, 26, 40, 0.92)' : 'rgba(255, 255, 255, 0.95)',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.25)' : 'rgba(59, 130, 246, 0.18)',
              shadowColor: '#3B82F6'
            }
          ]}
        >
          {/* Animated Glow Halo */}
          <Animated.View
            style={[
              styles.glowHalo,
              {
                transform: [{ scale: pulseAnim }],
                borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.25)'
              }
            ]}
          />

          {/* Dual Spinning Orbital Rings */}
          <View style={styles.spinnerWrapper}>
            {/* Outer Ring */}
            <Animated.View
              style={[
                styles.outerRing,
                {
                  transform: [{ rotate: spinInterpolation }],
                  borderColor: isDark ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
                  borderTopColor: '#3B82F6',
                  borderRightColor: '#60A5FA'
                }
              ]}
            />

            {/* Inner Reverse Ring */}
            <Animated.View
              style={[
                styles.innerRing,
                {
                  transform: [{ rotate: reverseSpinInterpolation }],
                  borderColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
                  borderBottomColor: '#8B5CF6',
                  borderLeftColor: '#A78BFA'
                }
              ]}
            />

            {/* Center Brand Emblem */}
            <View style={styles.brandBadge}>
              <Text style={styles.brandLetter}>K</Text>
            </View>
          </View>

          {/* Brand & Loading Label */}
          <View style={styles.textContainer}>
            <View style={styles.titleRow}>
              <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 17, letterSpacing: 0.5 }]}>
                {displayTitle}
              </Text>
              <Sparkles size={14} color="#3B82F6" style={{ marginLeft: 4 }} />
            </View>

            <Text
              style={[
                Typography.footnote,
                {
                  color: palette.textSecondary,
                  textAlign: 'center',
                  marginTop: 4,
                  paddingHorizontal: 8
                }
              ]}
              numberOfLines={2}
            >
              {displayMessage}
            </Text>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24
  },
  loaderCard: {
    width: Math.min(width - 64, 280),
    paddingVertical: 28,
    paddingHorizontal: 24,
    borderRadius: 28,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 20,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 20
  },
  glowHalo: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
    top: 24
  },
  spinnerWrapper: {
    width: 90,
    height: 90,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16
  },
  outerRing: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3
  },
  innerRing: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2.5
  },
  brandBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8
  },
  brandLetter: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5
  },
  textContainer: {
    alignItems: 'center',
    width: '100%'
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center'
  }
});
