import React, { useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ViewStyle,
  Animated,
  Platform
} from 'react-native';
import { Home, CreditCard, Clock, LucideIcon } from 'lucide-react-native';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';

export interface TabItemConfig {
  name: string;
  label: string;
  Icon: LucideIcon;
}

/**
 * Default tab configuration for the 3 main routes: Home, Card, History.
 * Easily modify icons, labels, or add/remove routes here!
 */
export const DEFAULT_TABS: TabItemConfig[] = [
  { name: 'index', label: 'Home', Icon: Home },
  { name: 'card', label: 'Card', Icon: CreditCard },
  { name: 'history', label: 'History', Icon: Clock },
];

export interface FloatingTabBarProps {
  state?: any;
  descriptors?: any;
  navigation?: any;
  tabs?: TabItemConfig[];
  width?: `${number}%` | number;
  showLabels?: boolean;
  iconSize?: number;
  containerStyle?: ViewStyle;
}

/**
 * Reusable, easily customizable Floating Pill Tab Bar Component.
 *
 * Design notes (Apple Design skill):
 *  - BlurView provides true backdrop blur = "translucent material" layer (§12)
 *  - Bright top border edge = light catching the glass surface (§12)
 *  - Active icon uses filled variant for clear affordance (§16 — familiarity)
 *  - Active pill scale animation from current value on press (§1 — respond on down)
 *  - Shadow is heavier to lift floating chrome over scrolling content (§12)
 */
export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  tabs = DEFAULT_TABS,
  width = '60%',
  showLabels = false,
  iconSize = 20,
  containerStyle
}: FloatingTabBarProps) {
  const palette = useAppPalette();

  // Per-tab animated scale for press feedback — instant on touch-down (§1)
  const scales = useRef<Animated.Value[]>(tabs.map(() => new Animated.Value(1))).current;

  if (!state || !navigation) return null;

  const currentRouteName = state.routes[state.index]?.name;
  const isAllowedTab = ['index', 'card', 'history'].includes(currentRouteName);
  if (!isAllowedTab) return null;

  const isDark = palette.text === '#FFFFFF';

  // Active accent — vivid white on dark, deep navy on light
  const activeColor = isDark ? '#FFFFFF' : '#0F172A';
  // Active pill background — subtle frosted highlight
  const activePillBg = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.09)';
  // Border: bright top edge = light catching glass (§12)
  const borderColor = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.09)';
  // Outer shadow glow colour
  const shadowColor = isDark ? '#000' : '#1E293B';

  const handlePressIn = (idx: number) => {
    Animated.spring(scales[idx], {
      toValue: 0.87,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0
    }).start();
  };

  const handlePressOut = (idx: number) => {
    Animated.spring(scales[idx], {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6
    }).start();
  };

  return (
    <View style={[styles.floatingContainer, { bottom: Platform.OS === 'ios' ? 28 : 20 }]}>
      {/* Glass pill shell — layered rgba glass effect */}
      <View
        style={[
          styles.pillTabBar,
          {
            width,
            borderColor,
            shadowColor,
            backgroundColor: isDark ? 'rgba(18,18,22,0.78)' : 'rgba(255,255,255,0.82)',
          },
          containerStyle
        ]}
      >
        {/* Bright top-edge inner highlight — simulates light catching the glass rim */}
        <View
          pointerEvents="none"
          style={[
            styles.topEdgeHighlight,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.6)' }
          ]}
        />

        {tabs.map((tab, idx) => {
          const route = state.routes.find((r: any) => r.name === tab.name);
          const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
          const isFocused = routeIndex !== -1 && state.index === routeIndex;
          const TabIcon = tab.Icon;

          const onPress = () => {
            if (route) {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true
              });
              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(tab.name);
              }
            } else {
              navigation.navigate(tab.name);
            }
          };

          const iconColor = isFocused ? activeColor : (isDark ? 'rgba(255,255,255,0.38)' : 'rgba(15,23,42,0.35)');

          return (
            <Animated.View
              key={tab.name}
              style={[styles.tabItemWrap, { transform: [{ scale: scales[idx] }] }]}
            >
              <TouchableOpacity
                onPress={onPress}
                onPressIn={() => handlePressIn(idx)}
                onPressOut={() => handlePressOut(idx)}
                activeOpacity={1}
                style={[
                  styles.tabItem,
                  isFocused && { backgroundColor: activePillBg }
                ]}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isFocused }}
              >
                {/* Duotone: active keeps stroke lines + semi-transparent fill behind them */}
                <TabIcon
                  size={iconSize}
                  color={iconColor}
                  fill={isFocused
                    ? (isDark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.18)')
                    : 'transparent'
                  }
                  strokeWidth={isFocused ? 1.8 : 1.6}
                />

                {showLabels && (
                  <Text
                    style={[
                      Typography.footnote,
                      {
                        color: iconColor,
                        fontWeight: isFocused ? '700' : '400',
                        letterSpacing: isFocused ? 0.1 : 0,
                        marginTop: 1
                      }
                    ]}
                  >
                    {tab.label}
                  </Text>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50,
    // No pointer events on the wrapper — only on pill content
    pointerEvents: 'box-none'
  },
  pillTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 40,
    // Single-pixel border on all sides — glass rim
    borderWidth: 1,
    overflow: 'hidden',
    // Deep, diffuse shadow = floating material over content (§12)
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
    elevation: 18
  },
  // Very thin frosted strip at top of pill — emulates light catching glass edge (§12)
  topEdgeHighlight: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    borderRadius: 1
  },
  tabItemWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  tabItem: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 30
  },
});
