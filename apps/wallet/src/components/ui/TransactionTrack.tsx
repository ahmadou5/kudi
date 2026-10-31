import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Check, Clock, RefreshCw, X } from 'lucide-react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue
} from 'react-native-reanimated';
import { useAppPalette, hexToRgba } from '../../lib/theme';
import { Typography } from '../../constants/typography';

export type TransactionTrackType = 'success' | 'failed' | 'pending';
type StageState = 'complete' | 'active' | 'failed' | 'pending';

export interface TransactionTrackProps {
  type: TransactionTrackType;
  /** Uppercase micro-label above the timeline. */
  title?: string;
  /** Main label under each node (length 3). Defaults adapt to `type`. */
  labels?: [string, string, string];
  /** Optional secondary line under each label (length 3). */
  sublabels?: [string, string, string];
  /** Re-run the entrance choreography when this flips to true (e.g. modal visible). */
  active?: boolean;
}

const NODE = 36;
const POP_SPRING = { damping: 12, mass: 0.6, stiffness: 200 } as const;
const FILL = { duration: 320, easing: Easing.out(Easing.cubic) } as const;
// Choreography offsets (ms) from `active` — node, connector, node, connector, node.
const T = { n1: 250, c1: 430, n2: 580, c2: 760, n3: 900 } as const;

function defaultLabels(type: TransactionTrackType): [string, string, string] {
  return ['Requested', 'Processing', type === 'success' ? 'Completed' : type === 'failed' ? 'Failed' : 'Pending'];
}

function stageStates(type: TransactionTrackType): [StageState, StageState, StageState] {
  if (type === 'success') return ['complete', 'complete', 'complete'];
  if (type === 'failed') return ['complete', 'failed', 'failed'];
  return ['complete', 'active', 'pending'];
}

function TrackNode({
  state,
  tone,
  scale,
  pulse
}: {
  state: StageState;
  tone: string;
  scale: SharedValue<number>;
  pulse: SharedValue<number>;
}) {
  const palette = useAppPalette();
  const showRing = state !== 'pending';

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: showRing ? pulse.value : 0
  }));

  const iconColor =
    state === 'pending' ? palette.textSecondary : tone;

  return (
    <View style={styles.nodeWrap}>
      {showRing && (
        <Animated.View
          pointerEvents="none"
          style={[styles.nodeRing, { backgroundColor: hexToRgba(tone, 0.16) }, ringStyle]}
        />
      )}
      <Animated.View
        style={[
          styles.node,
          {
            backgroundColor: state === 'pending' ? 'transparent' : hexToRgba(tone, 0.14),
            borderColor: state === 'pending' ? hexToRgba(palette.text, 0.18) : tone
          },
          popStyle
        ]}
      >
        {state === 'complete' && <Check size={16} color={iconColor} strokeWidth={2.6} />}
        {state === 'failed' && <X size={16} color={iconColor} strokeWidth={2.6} />}
        {state === 'pending' && <Clock size={15} color={iconColor} strokeWidth={2.2} />}
        {state === 'active' && <SpinIcon tone={iconColor} />}
      </Animated.View>
    </View>
  );
}

function SpinIcon({ tone }: { tone: string }) {
  const rotation = useSharedValue(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    rotation.value = 0;
    rotation.value = withRepeat(
      withTiming(1, { duration: 1100, easing: Easing.linear }),
      -1,
      false
    );
    return () => cancelAnimation(rotation);
  }, [reduced, rotation]);

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 360}deg` }]
  }));

  return (
    <Animated.View style={spinStyle}>
      <RefreshCw size={15} color={tone} strokeWidth={2.4} />
    </Animated.View>
  );
}

function TrackConnector({
  tone,
  filled,
  progress
}: {
  tone: string;
  filled: boolean;
  progress: SharedValue<number>;
}) {
  const palette = useAppPalette();
  const muted = hexToRgba(palette.text, palette.scheme === 'dark' ? 0.14 : 0.1);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`
  }));

  return (
    <View style={styles.connector} pointerEvents="none">
      <View style={[styles.connectorBase, { backgroundColor: muted }]} />
      {filled && (
        <Animated.View
          style={[styles.connectorFill, { backgroundColor: tone }, fillStyle]}
        />
      )}
    </View>
  );
}

export function TransactionTrack({
  type,
  title = 'TRANSFER TRACK',
  labels,
  sublabels,
  active = true
}: TransactionTrackProps) {
  const palette = useAppPalette();
  const reduced = useReducedMotion();

  const n1 = useSharedValue(0.3);
  const n2 = useSharedValue(0.3);
  const n3 = useSharedValue(0.3);
  const c1 = useSharedValue(0);
  const c2 = useSharedValue(0);
  const pulse = useSharedValue(1);

  const states = stageStates(type);
  const finalLabels = labels ?? defaultLabels(type);

  // Stage 3 tone follows the terminal status; early stages ride the accent.
  const tones: [string, string, string] = [
    palette.primary,
    type === 'failed' ? palette.error : palette.primary,
    type === 'success' ? palette.success : type === 'failed' ? palette.error : palette.warning
  ];

  const filled1 = states[1] !== 'pending';
  const filled2 = states[2] !== 'pending';

  useEffect(() => {
    cancelAnimation(n1);
    cancelAnimation(n2);
    cancelAnimation(n3);
    cancelAnimation(c1);
    cancelAnimation(c2);
    cancelAnimation(pulse);

    if (!active) return;

    if (reduced) {
      n1.value = 1;
      n2.value = 1;
      n3.value = 1;
      c1.value = filled1 ? 1 : 0;
      c2.value = filled2 ? 1 : 0;
      pulse.value = 1;
      return;
    }

    n1.value = 0.3;
    n2.value = 0.3;
    n3.value = 0.3;
    c1.value = 0;
    c2.value = 0;

    n1.value = withDelay(T.n1, withSpring(1, POP_SPRING));
    c1.value = withDelay(T.c1, withTiming(filled1 ? 1 : 0, FILL));
    n2.value = withDelay(T.n2, withSpring(1, POP_SPRING));
    c2.value = withDelay(T.c2, withTiming(filled2 ? 1 : 0, FILL));
    n3.value = withDelay(T.n3, withSpring(1, POP_SPRING));

    // Soft breathing glow while the transfer is still moving.
    if (type === 'pending') {
      pulse.value = withDelay(
        T.n3 + 200,
        withRepeat(
          withSequence(
            withTiming(0.4, { duration: 950, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 950, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      );
    } else {
      pulse.value = withSequence(
        withTiming(0.5, { duration: 260, easing: Easing.out(Easing.cubic) }),
        withSpring(1, { damping: 14, stiffness: 180 })
      );
    }
  }, [active, reduced, type, filled1, filled2, n1, n2, n3, c1, c2, pulse]);

  const headerPulseStyle = useAnimatedStyle(() => ({
    opacity: type === 'pending' ? pulse.value * 0.5 + 0.5 : 1
  }));

  const badgeTone =
    type === 'success' ? palette.success : type === 'failed' ? palette.error : palette.warning;
  const badgeText = type === 'success' ? 'Completed' : type === 'failed' ? 'Failed' : 'In Progress';

  return (
    <View
      style={styles.root}
      accessibilityRole="progressbar"
      accessibilityLabel={`Transfer track: ${badgeText}`}
    >
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Animated.View style={[styles.headerDot, { backgroundColor: badgeTone }, headerPulseStyle]} />
          <Text style={[Typography.currencySub, styles.headerTitle, { color: palette.textSecondary }]}>
            {title}
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: hexToRgba(badgeTone, 0.12) }]}>
          <Text style={[Typography.currencySub, styles.badgeText, { color: badgeTone }]}>
            {badgeText}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.stage}>
          <TrackNode state={states[0]} tone={tones[0]} scale={n1} pulse={pulse} />
          <Text style={[styles.stageLabel, { color: states[0] === 'failed' ? tones[0] : palette.text }]}>
            {finalLabels[0]}
          </Text>
          {sublabels && <Text style={[styles.stageSub, { color: palette.textSecondary }]}>{sublabels[0]}</Text>}
        </View>

        <TrackConnector tone={tones[1]} filled={filled1} progress={c1} />

        <View style={styles.stage}>
          <TrackNode state={states[1]} tone={tones[1]} scale={n2} pulse={pulse} />
          <Text
            style={[
              styles.stageLabel,
              { color: states[1] === 'failed' ? tones[1] : states[1] === 'pending' ? palette.textSecondary : palette.text }
            ]}
          >
            {finalLabels[1]}
          </Text>
          {sublabels && <Text style={[styles.stageSub, { color: palette.textSecondary }]}>{sublabels[1]}</Text>}
        </View>

        <TrackConnector tone={tones[2]} filled={filled2} progress={c2} />

        <View style={styles.stage}>
          <TrackNode state={states[2]} tone={tones[2]} scale={n3} pulse={pulse} />
          <Text
            style={[
              styles.stageLabel,
              {
                color:
                  states[2] === 'complete'
                    ? palette.success
                    : states[2] === 'failed'
                      ? tones[2]
                      : palette.textSecondary
              }
            ]}
          >
            {finalLabels[2]}
          </Text>
          {sublabels && <Text style={[styles.stageSub, { color: palette.textSecondary }]}>{sublabels[2]}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 13
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  headerDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  headerTitle: {
    letterSpacing: 1,
    fontSize: 11,

  },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 12
  },
  badgeText: {
    fontSize: 10,

    letterSpacing: 0.4
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 2
  },
  stage: {
    alignItems: 'center',
    gap: 4,
    flexShrink: 1
  },
  nodeWrap: {
    width: NODE,
    height: NODE,
    alignItems: 'center',
    justifyContent: 'center'
  },
  nodeRing: {
    position: 'absolute',
    width: NODE + 16,
    height: NODE + 16,
    borderRadius: (NODE + 16) / 2
  },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stageLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: Typography.family.mono,
    marginTop: 6,
    textAlign: 'center'
  },
  stageSub: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: Typography.currencySub.fontFamily,
    textAlign: 'center'
  },
  connector: {
    flex: 1,
    height: 2.5,
    borderRadius: 2,
    marginTop: NODE / 2 - 1.25,
    marginHorizontal: 8,
    overflow: 'hidden'
  },
  connectorBase: {
    ...StyleSheet.absoluteFill,
    borderRadius: 2
  },
  connectorFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2
  }
});
