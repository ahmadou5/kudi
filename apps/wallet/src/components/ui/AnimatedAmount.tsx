import React, { useEffect, useState } from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming
} from 'react-native-reanimated';

interface AnimatedAmountProps {
  /** Target numeric value. Animates smoothly whenever it changes. */
  value: number;
  /** Formats the (possibly in-flight) number for display, e.g. n => n.toFixed(2). */
  format: (value: number) => string;
  /** Resting text color. */
  color?: string;
  /** Momentary highlight while the value moves: green on rise, red on fall. */
  flash?: boolean;
  /** Base text style. Color from `color` prop wins over style.color. */
  style?: StyleProp<TextStyle>;
  /** Animation duration in ms (default 550). */
  duration?: number;
  accessibilityLabel?: string;
}

const AnimatedText = Animated.Text;

/**
 * A currency/number text that eases from the previous value to the next
 * (so ₦ balances visibly tick through kobo-level changes), and briefly
 * flashes green/red in the direction of travel.
 *
 * Renders as a nested <Text>, so it can sit inline inside a parent <Text>.
 */
export function AnimatedAmount({
  value,
  format,
  color,
  flash = true,
  style,
  duration = 550,
  accessibilityLabel
}: AnimatedAmountProps) {
  const reducedMotion = useReducedMotion();
  const displayed = useSharedValue(value);
  const flashProgress = useSharedValue(0);
  const flashRise = useSharedValue(true);
  const prevValueRef = React.useRef(value);

  const [text, setText] = useState(() => format(value));

  // Keep the displayed string in sync with the shared value every frame.
  // `format` is a plain JS fn, so it must run on the JS thread via runOnJS —
  // calling it directly inside the reaction worklet would throw.
  const applyText = (v: number) => setText(format(v));
  useAnimatedReaction(
    () => displayed.value,
    (current) => {
      runOnJS(applyText)(current);
    }
  );

  useEffect(() => {
    const prev = prevValueRef.current;
    prevValueRef.current = value;

    if (reducedMotion || value === prev) {
      displayed.value = value;
      return;
    }

    displayed.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic)
    });

    if (flash) {
      flashRise.value = value > prev;
      flashProgress.value = withSequence(
        withTiming(1, { duration: 180 }),
        withTiming(0, { duration: 700, easing: Easing.out(Easing.quad) })
      );
    }
  }, [value, duration, flash, reducedMotion, displayed, flashProgress, flashRise]);

  const animatedStyle = useAnimatedStyle(() => {
    if (!color || !flash) return { color };
    return {
      color: interpolateColor(
        flashProgress.value,
        [0, 1],
        [color, flashRise.value ? '#34D399' : '#F87171']
      )
    };
  });

  return (
    <AnimatedText
      style={[style, color ? { color } : null, animatedStyle]}
      accessibilityLabel={accessibilityLabel ?? text}
      accessibilityRole="text"
    >
      {text}
    </AnimatedText>
  );
}

/** Standard naira formatting: ₦0.00 with thousands separators. */
export function formatNaira(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/** Standard dollar formatting: 0.00 with thousands separators. */
export function formatUsd(value: number) {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
