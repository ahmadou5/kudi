import Animated, {
  FadeInDown,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSpring
} from 'react-native-reanimated';
import React, { useCallback, useEffect, useRef } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
// Expo Router vendors its own React Navigation fork. Screens are wrapped with
// *these* contexts — the standalone @react-navigation/native package is a
// different module graph, so importing NavigationContext from there always
// returns undefined and focus tracking silently dies.
import { NavigationContext as ExpoNavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import { IsFocusedContext } from 'expo-router/build/react-navigation/core/useIsFocused';
// Fallback for hosts that aren't Expo Router (unit tests, Storybook).
import { NavigationContext as StandaloneNavigationContext } from '@react-navigation/native';

/**
 * Storyboard:
 * 0ms    header mounts (no animation — instant orientation)
 * 60ms   section 0 enters (FadeInDown, spring)
 * 120ms  section 1
 * 180ms  section 2
 * …      +60ms per section; once index ≥ maxStagger every further section
 *        shares the same cap delay (they land together, no longer cascade).
 *
 * The same storyboard replays every time the host screen regains navigation
 * focus (tab switch, return from a pushed screen), because Reanimated's
 * `entering` only ever fires on mount.
 */
const TIMING = {
  stagger: 60,
  maxStagger: 8
} as const;

/** Mirror of Reanimated's FadeInDown geometry (opacity 0→1, translateY 25→0). */
const TRAVEL = 25;

const SPRING = {
  damping: 18,
  mass: 0.7,
  stiffness: 180
} as const;

/**
 * Safe drop-in for React Navigation's `useIsFocused`.
 *
 * Prefers `IsFocusedContext` (the precise per-screen boolean Expo Router's
 * NavigationProvider publishes). Falls back to focus/blur subscriptions on the
 * nearest navigation object, and finally to `true` when there is no navigator
 * at all (custom modals, portals, tests) so entrances still run on mount.
 */
function useSafeIsFocused(): boolean {
  // 1. Best path — context-driven, no event subscription needed.
  const focusedFromContext = React.useContext(IsFocusedContext);
  const expoNavigation = React.useContext(ExpoNavigationContext);
  const standaloneNavigation = React.useContext(StandaloneNavigationContext);
  const navigation = expoNavigation ?? standaloneNavigation;

  // IsFocusedContext is only provided inside a navigator's NavigationProvider.
  // When present it already accounts for the whole ancestor tree.
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (!navigation) return () => {};
      const unsubFocus = navigation.addListener('focus', onChange);
      const unsubBlur = navigation.addListener('blur', onChange);
      return () => {
        unsubFocus();
        unsubBlur();
      };
    },
    [navigation]
  );

  const getSnapshot = useCallback(
    () => navigation?.isFocused() ?? true,
    [navigation]
  );

  const focusedFromEvents = React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return focusedFromContext ?? focusedFromEvents;
}

/**
 * Staggered FadeInDown entering animation for list rows that are mounted and
 * unmounted frequently (e.g. filtered transaction rows). Returns undefined when
 * the user prefers reduced motion (animation skipped).
 * Index is capped so deep lists don't accumulate long delays.
 */
export function useEnterFadeInDown(index: number) {
  const reduced = useReducedMotion();
  if (reduced) return undefined;
  const delay = Math.min(index, TIMING.maxStagger) * TIMING.stagger;
  return FadeInDown.delay(delay)
    .springify()
    .damping(SPRING.damping)
    .mass(SPRING.mass)
    .stiffness(SPRING.stiffness);
}

/**
 * Staggered entrance style that replays whenever the host screen regains
 * navigation focus. Unlike `entering`, the subtree stays mounted — child state
 * (carousel index, form fields, open sheets) survives the replay.
 * Returns an invisible-but-static style under reduced motion.
 */
export function useEnterRevealStyle(index: number) {
  const reduced = useReducedMotion();
  const focused = useSafeIsFocused();
  const progress = useSharedValue(reduced ? 1 : 0);
  // Start as "unfocused" so the first focused commit is treated as a fresh entrance.
  const wasFocused = useRef(false);
  const delay = Math.min(index, TIMING.maxStagger) * TIMING.stagger;

  useEffect(() => {
    if (reduced) {
      cancelAnimation(progress);
      progress.value = 1;
      wasFocused.current = focused;
      return;
    }

    // Stay invisible until this screen is actually focused — background tabs
    // that mount lazily must not burn their entrance while off-screen.
    if (!focused) {
      wasFocused.current = false;
      return;
    }

    // Animate on first focus and on every regain after a blur.
    if (wasFocused.current) return;
    wasFocused.current = true;

    cancelAnimation(progress);
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withSpring(1, {
        damping: SPRING.damping,
        mass: SPRING.mass,
        stiffness: SPRING.stiffness
      })
    );
  }, [focused, reduced, delay, progress]);

  return useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * TRAVEL }]
  }));
}

/** Wraps a section in a staggered entrance that replays on every focus. */
export function EnterSection({
  index,
  style,
  children
}: {
  index: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const revealing = useEnterRevealStyle(index);
  return (
    <Animated.View style={[revealing, style]}>
      {children}
    </Animated.View>
  );
}
