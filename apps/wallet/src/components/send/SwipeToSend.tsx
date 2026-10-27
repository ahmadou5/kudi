import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  LayoutChangeEvent,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ChevronsRight } from 'lucide-react-native';
import { haptics } from '../../lib/haptics';
import { useAppPalette } from '../../lib/theme';

const KNOB = 48;
const PADDING = 4;
const COMPLETE_THRESHOLD = 0.85;

interface SwipeToSendProps {
  label?: string;
  onComplete: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Icon inside the draggable knob. */
  knobIcon?: React.ReactNode;
  /** Decoration shown at the far-right end of the track. */
  trailing?: React.ReactNode;
}

export const SwipeToSend: React.FC<SwipeToSendProps> = ({
  label = 'Swipe to send',
  onComplete,
  disabled = false,
  loading = false,
  knobIcon,
  trailing,
}) => {
  const palette = useAppPalette();
  const translateX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const maxX = Math.max(0, trackWidth - KNOB - PADDING * 2);

  // Refs so the PanResponder (created once) always sees current values.
  const maxXRef = useRef(0);
  const lockedRef = useRef(false);
  const completeRef = useRef(onComplete);
  maxXRef.current = maxX;
  lockedRef.current = disabled || loading;
  completeRef.current = onComplete;

  // Reset the knob when the swipe is no longer in flight (e.g. PIN rejected).
  useEffect(() => {
    if (!loading) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
    }
  }, [loading, translateX]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !lockedRef.current,
      onMoveShouldSetPanResponder: () => !lockedRef.current,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => {
        translateX.setValue(Math.min(Math.max(0, g.dx), maxXRef.current));
      },
      onPanResponderRelease: (_, g) => {
        const max = maxXRef.current;
        if (max > 0 && g.dx >= max * COMPLETE_THRESHOLD) {
          Animated.timing(translateX, { toValue: max, duration: 120, useNativeDriver: true }).start();
          haptics.notify('success');
          completeRef.current();
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
        }
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 7 }).start();
      },
    })
  ).current;

  const labelOpacity = translateX.interpolate({
    inputRange: [0, Math.max(1, maxX * 0.6)],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <View
      style={[styles.track, { backgroundColor: palette.text }, disabled && styles.trackDisabled]}
      onLayout={(e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
    >
      <Animated.Text style={[styles.label, { color: palette.bg, opacity: labelOpacity }]} numberOfLines={1}>
        {loading ? 'Sending…' : label}
      </Animated.Text>

      {!loading && (
        <Animated.View style={[styles.chevrons, { opacity: labelOpacity }]} pointerEvents="none">
          <ChevronsRight size={16} color={palette.bg} />
        </Animated.View>
      )}

      {trailing ? <View style={styles.trailing} pointerEvents="none">{trailing}</View> : null}

      <Animated.View
        {...panResponder.panHandlers}
        style={[styles.knob, { backgroundColor: palette.bg, transform: [{ translateX }] }]}
      >
        {loading ? <ActivityIndicator color={palette.text} /> : knobIcon ?? <ChevronsRight size={22} color={palette.text} />}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    height: KNOB + PADDING * 2,
    borderRadius: (KNOB + PADDING * 2) / 2,
    justifyContent: 'center',
    paddingHorizontal: PADDING,
  },
  trackDisabled: { opacity: 0.45 },
  knob: {
    position: 'absolute',
    left: PADDING,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '600',
    paddingLeft: 24,
  },
  chevrons: {
    position: 'absolute',
    left: '50%',
    marginLeft: 52,
  },
  trailing: {
    position: 'absolute',
    right: PADDING,
  },
});
