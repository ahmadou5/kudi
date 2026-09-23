import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, Easing } from 'react-native';
import { useAppPalette } from '../../lib/theme';

export function AnimatedPulseView({
  style
}: {
  style?: any;
}) {
  const palette = useAppPalette();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <Animated.View
      style={[
        {
          backgroundColor: palette.border,
          opacity: pulseAnim
        },
        style
      ]}
    />
  );
}

export function BalanceCardSkeleton() {
  const palette = useAppPalette();
  return (
    <View style={[styles.skeletonCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <AnimatedPulseView style={{ width: 140, height: 16, borderRadius: 6, marginBottom: 12 }} />
      <AnimatedPulseView style={{ width: 220, height: 36, borderRadius: 8, marginBottom: 8 }} />
      <AnimatedPulseView style={{ width: 160, height: 18, borderRadius: 6, marginBottom: 16 }} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <AnimatedPulseView style={{ flex: 1, height: 44, borderRadius: 12 }} />
        <AnimatedPulseView style={{ flex: 1, height: 44, borderRadius: 12 }} />
      </View>
    </View>
  );
}

export function ActivityRowSkeleton() {
  const palette = useAppPalette();
  return (
    <View style={[styles.skeletonCard, { backgroundColor: palette.card, borderColor: palette.border, padding: 14 }]}>
      <View style={styles.skeletonRow}>
        <AnimatedPulseView style={styles.skeletonCircle} />
        <View style={styles.skeletonTextStack}>
          <AnimatedPulseView style={{ width: 120, height: 14, borderRadius: 4 }} />
          <AnimatedPulseView style={{ width: 80, height: 10, borderRadius: 4 }} />
        </View>
        <AnimatedPulseView style={{ width: 70, height: 16, borderRadius: 4 }} />
      </View>
    </View>
  );
}

export function VirtualCardSkeleton() {
  const palette = useAppPalette();
  return (
    <View style={[styles.skeletonCard, { backgroundColor: palette.card, borderColor: palette.border, height: 215 }]}>
      <AnimatedPulseView style={{ width: 100, height: 20, borderRadius: 6 }} />
      <AnimatedPulseView style={{ width: 200, height: 24, borderRadius: 6, marginVertical: 20 }} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 'auto' }}>
        <AnimatedPulseView style={{ width: 80, height: 14, borderRadius: 4 }} />
        <AnimatedPulseView style={{ width: 60, height: 14, borderRadius: 4 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeletonCard: {
    padding: 18,
    borderRadius: 20,
    borderWidth: 1
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  skeletonCircle: {
    width: 42,
    height: 42,
    borderRadius: 21
  },
  skeletonTextStack: {
    flex: 1,
    gap: 8
  }
});
