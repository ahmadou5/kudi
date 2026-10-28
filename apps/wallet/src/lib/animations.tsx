import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';

/**
 * Storyboard (settings screens):
 * 0ms    header mounts (no animation — instant orientation)
 * 45ms   section 0 enters (FadeInDown, spring)
 * 90ms   section 1
 * 135ms  section 2
 * …      +45ms per section, capped at maxStagger; later items appear immediately
 */
const TIMING = {
  fast: 150,
  base: 280,
  stagger: 45,
  maxStagger: 8
} as const;

/**
 * Staggered FadeInDown entering animation for section/list entrances.
 * Returns undefined when the user prefers reduced motion (animation skipped).
 * Index is capped so deep lists don't accumulate long delays.
 */
export function useEnterFadeInDown(index: number) {
  const reduced = useReducedMotion();
  if (reduced) return undefined;
  const delay = Math.min(index, TIMING.maxStagger) * TIMING.stagger;
  return FadeInDown.delay(delay)
    .springify()
    .damping(18)
    .mass(0.7)
    .stiffness(180);
}

/** Wraps a section in a staggered FadeInDown entrance (skips when reduced motion). */
export function EnterSection({
  index,
  style,
  children
}: {
  index: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const entering = useEnterFadeInDown(index);
  return (
    <Animated.View entering={entering} style={style}>
      {children}
    </Animated.View>
  );
}
