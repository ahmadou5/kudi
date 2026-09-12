import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, View, StyleSheet } from 'react-native';

type FlowProgressDotsProps = {
  currentStep: number;
  totalSteps: number;
  onStepPress?: (step: number) => void;
};

/**
 * Percel Expanding-Pill Step Tracker.
 *
 * - Active step: wide bright pill (width springs to ~24, opacity 1.0)
 * - Completed step: narrower pill (width 8, opacity 0.65)
 * - Future step: narrowest pill (width 8, opacity 0.25)
 */
export function FlowProgressDots({ currentStep, totalSteps, onStepPress }: FlowProgressDotsProps) {
  const widths = useRef(
    Array.from({ length: totalSteps }, (_, i) =>
      new Animated.Value(i + 1 === currentStep ? 24 : 8)
    )
  ).current;

  const opacities = useRef(
    Array.from({ length: totalSteps }, (_, i) => {
      const s = i + 1;
      return new Animated.Value(s === currentStep ? 1 : s < currentStep ? 0.65 : 0.25);
    })
  ).current;

  useEffect(() => {
    const springs = Array.from({ length: totalSteps }, (_, i) => {
      const s = i + 1;
      const targetW = s === currentStep ? 24 : 8;
      const targetO = s === currentStep ? 1 : s < currentStep ? 0.65 : 0.25;

      return Animated.parallel([
        Animated.spring(widths[i], {
          toValue: targetW,
          damping: 18,
          stiffness: 200,
          useNativeDriver: false
        }),
        Animated.spring(opacities[i], {
          toValue: targetO,
          damping: 20,
          stiffness: 180,
          useNativeDriver: false
        })
      ]);
    });

    Animated.parallel(springs).start();
  }, [currentStep, totalSteps, widths, opacities]);

  return (
    <View style={styles.container}>
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const active = step === currentStep;
        const complete = step < currentStep;
        const interactive = Boolean(onStepPress) && (active || complete);

        return (
          <Pressable
            key={step}
            disabled={!interactive}
            onPress={() => onStepPress?.(step)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Animated.View
              style={[
                styles.pill,
                {
                  width: widths[i],
                  opacity: opacities[i]
                }
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  pill: {
    height: 6,
    borderRadius: 999,
    backgroundColor: '#FFFFFF'
  }
});
