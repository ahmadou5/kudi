import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { Bell } from 'lucide-react-native';
import { useAppPalette, hexToRgba } from '../lib/theme';

const CARD_WIDTH = 214;
const CARD_HEIGHT = 64;

const SLOTS_OFFSET = 32;
const SLOTS = [
  { top: 46, left: 0, scale: 1 },
  { top: 28, left: 16, scale: 0.97 },
  { top: 10, left: 32, scale: 0.94 }
];

const DECK_WIDTH = CARD_WIDTH + SLOTS_OFFSET;

interface NotificationCardProps {
  index: number;
}

function NotificationCard({ index }: NotificationCardProps) {
  const palette = useAppPalette();
  const reduced = useReducedMotion();
  const appear = useSharedValue(reduced ? 1 : 0);
  const slot = SLOTS[index];
  const isFront = index === 0;

  useEffect(() => {
    if (reduced) {
      appear.value = 1;
      return;
    }
    appear.value = withDelay(
      index * 110,
      withSpring(1, { damping: 15, stiffness: 110, mass: 0.9 })
    );
  }, [appear, index, reduced]);

  const cardStyle = useAnimatedStyle(() => {
    const progress = appear.value;
    return {
      opacity: progress,
      transform: [
        { perspective: 900 },
        { translateX: slot.left },
        { translateY: slot.top + (1 - progress) * 36 },
        { scale: slot.scale * (0.94 + progress * 0.06) }
      ]
    };
  });

  const unreadStyle = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [{ scale: 1 }] };
    return {
      opacity: 0.55 + appear.value * 0.45,
      transform: [{ scale: 0.7 + appear.value * 0.3 }]
    };
  });

  return (
    <Animated.View style={[styles.cardWrap, { zIndex: SLOTS.length - index }, cardStyle]}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: hexToRgba(palette.text, isFront ? 0.07 : 0.05),
            borderColor: hexToRgba(palette.text, isFront ? 0.12 : 0.08)
          }
        ]}
      >
        <View style={[styles.shade, { backgroundColor: 'rgba(0,0,0,0.14)' }]} />

        <View style={styles.rowContent}>
          <View
            style={[
              styles.tile,
              {
                backgroundColor: isFront
                  ? hexToRgba(palette.primary, 0.22)
                  : hexToRgba(palette.text, 0.09)
              }
            ]}
          >
            <Bell
              size={16}
              strokeWidth={2}
              color={isFront ? palette.primary : hexToRgba(palette.text, 0.35)}
            />
          </View>

          <View style={styles.bars}>
            <View
              style={[
                styles.bar,
                {
                  width: isFront ? 88 : 70,
                  backgroundColor: hexToRgba(palette.text, isFront ? 0.18 : 0.1)
                }
              ]}
            />
            <View
              style={[
                styles.barSmall,
                { backgroundColor: hexToRgba(palette.text, isFront ? 0.11 : 0.07) }
              ]}
            />
          </View>

          {isFront ? (
            <Animated.View style={[styles.unreadWrap, unreadStyle]}>
              <View style={[styles.unreadDot, { backgroundColor: palette.primary }]} />
            </Animated.View>
          ) : (
            <View style={styles.unreadWrap} />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

export function NotificationEmptyVisual() {
  const reduced = useReducedMotion();
  const ambient = useSharedValue(0.5);

  useEffect(() => {
    if (reduced) return;
    ambient.value = withRepeat(
      withTiming(1, { duration: 3400, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, [ambient, reduced]);

  const stageStyle = useAnimatedStyle(() => {
    if (reduced) {
      return { transform: [{ perspective: 900 }, { rotateX: '6deg' }] };
    }
    const t = ambient.value;
    return {
      transform: [
        { perspective: 900 },
        { rotateX: '6deg' },
        { rotateY: `${-4 + t * 8}deg` },
        { translateY: -4 + t * 8 }
      ]
    };
  });

  return (
    <View style={styles.stage}>
      <Animated.View style={[styles.deck, stageStyle]}>
        {SLOTS.map((_, index) => (
          <NotificationCard key={index} index={index} />
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    height: 122,
    width: DECK_WIDTH,
    alignSelf: 'center',
    justifyContent: 'flex-end'
  },
  deck: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: DECK_WIDTH,
    height: 118,
    overflow: 'hidden'
  },
  cardWrap: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: CARD_HEIGHT
  },
  card: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    paddingHorizontal: 12,
    justifyContent: 'center'
  },
  shade: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '45%'
  },
  rowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  tile: {
    width: 32,
    height: 32,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bars: {
    flex: 1,
    gap: 7
  },
  bar: {
    height: 10,
    borderRadius: 5
  },
  barSmall: {
    width: 58,
    height: 8,
    borderRadius: 4
  },
  unreadWrap: {
    width: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  }
});
