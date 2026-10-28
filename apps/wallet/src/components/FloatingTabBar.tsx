import React, { useRef, useEffect, useCallback } from 'react';
import {
    StyleSheet,
    View,
    TouchableOpacity,
    Text,
    ViewStyle,
    Platform,
    LayoutChangeEvent
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withSequence,
    withTiming,
    useReducedMotion,
    Easing
} from 'react-native-reanimated';
import { Home, CreditCard, Clock, LucideIcon, Settings, BarChart3 } from 'lucide-react-native';
// npx expo install expo-glass-effect — official Expo wrapper around iOS 26's Liquid Glass
// (UIVisualEffectView). GlassView renders the real native glass on iOS 26+ and quietly
// falls back to a plain View everywhere else (older iOS, Android, web) — no Platform
// branching needed on our end.
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useAppPalette, hexToRgba } from '../lib/theme';
import { Typography } from '../constants/typography';
import { haptics } from '../lib/haptics';

interface TabItemConfig {
    name: string;
    label: string;
    Icon: LucideIcon;
}

/**
 * Default tab configuration for the 3 main routes: Home, History, Settings.
 * Easily modify icons, labels, or add/remove routes here!
 * The bar shows only for routes listed here, so the pill slot mapping and the
 * visible buttons always stay in sync with this array.
 */
//To do { name: 'card', label: 'Card', Icon: CreditCard },
const DEFAULT_TABS: TabItemConfig[] = [
    { name: 'index', label: 'Home', Icon: Home },
    { name: 'history', label: 'History', Icon: Clock },
    { name: 'insights', label: 'Insights', Icon: BarChart3 },
    { name: 'settings', label: 'Settings', Icon: Settings },
];

// Tint laid over the real glass on iOS 26+ — kept light so the native blur still does the
// work of obscuring what's underneath. Derived from the active accent at render time.

// How strongly the active icon's shape gets washed with color while its outline stays crisp.
// Lower (~0.15) for a barely-there wash, higher (~0.4) for a bolder duotone look.
const ACTIVE_ICON_FILL_OPACITY = 0.28;

// ── Liquid morph tuning ──────────────────────────────────────────────────────
// The pill stretches horizontally while traveling between tabs (like a liquid
// blob being pulled) and squashes vertically to preserve "volume", then settles
// with a spring. These constants control that feel.
const MAX_STRETCH = 1.55;       // peak horizontal scale during transit
const MAX_SQUASH = 0.72;        // vertical squash at peak stretch (volume feel)
const STRETCH_EASE = Easing.bezier(0.23, 1, 0.32, 1); // strong ease-out for the pull
const STRETCH_DURATION = 130;   // ms to reach peak stretch
const PILL_SPRING = { duration: 420, dampingRatio: 0.72 } as const;   // travel + settle
const SETTLE_SPRING = { duration: 340, dampingRatio: 0.55 } as const; // bounce out of stretch

interface FloatingTabBarProps {
    state?: any;
    descriptors?: any;
    navigation?: any;
    tabs?: TabItemConfig[];
    width?: `${number}%` | number;
    showLabels?: boolean;
    iconSize?: number;
    containerStyle?: ViewStyle;
}

// ── TabItem subcomponent ─────────────────────────────────────────────────────
// Owns its own press-scale hook (hooks must not be called in a loop in the parent).
interface TabItemProps {
    tab: TabItemConfig;
    isFocused: boolean;
    activeColor: string;
    inactiveColor: string;
    iconSize: number;
    showLabels: boolean;
    onLayout: (e: LayoutChangeEvent) => void;
    onPress: () => void;
}

function TabItem({
    tab,
    isFocused,
    activeColor,
    inactiveColor,
    iconSize,
    showLabels,
    onLayout,
    onPress
}: TabItemProps) {
    const scale = useSharedValue(1);
    const TabIcon = tab.Icon;

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: scale.get() }]
    }));

    const handlePressIn = () => {
        // Instant squeeze — critically-damped, no overshoot (§1)
        scale.set(withSpring(0.86, { duration: 90, dampingRatio: 1 }));
        if (!isFocused && Platform.OS === 'ios') {
            haptics.impact('light');
        }
    };

    const handlePressOut = () => {
        // Gentle bounce back — physically appropriate on release
        scale.set(withSpring(1, { duration: 280, dampingRatio: 0.6 }));
    };

    const iconColor = isFocused ? activeColor : inactiveColor;

    return (
        <Animated.View
            onLayout={onLayout}
            style={[styles.tabItemWrap, animatedStyle]}
        >
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                style={styles.tabItem}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isFocused }}
            >
                <TabIcon
                    size={iconSize}
                    color={iconColor}
                    fill={isFocused ? activeColor : 'transparent'}
                    fillOpacity={isFocused ? ACTIVE_ICON_FILL_OPACITY : 1}
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
}

/**
 * Floating pill tab bar with a liquid-glass morph indicator.
 *
 * The active pill is a single absolutely-positioned view that slides between
 * tab slots. On tab change it:
 *   1. Stretches horizontally (scaleX) proportional to travel distance — the
 *      "liquid pull" — while squashing vertically to preserve volume.
 *   2. Springs to the new position with a slight overshoot.
 *   3. Settles back to scale 1 with a bouncy spring.
 *
 * On iOS 26+, GlassView renders real Liquid Glass underneath. Everywhere else
 * it falls back to a tinted translucent view.
 */
export function FloatingTabBar({
    state,
    descriptors,
    navigation,
    tabs = DEFAULT_TABS,
    width = '72%',
    showLabels = false,
    iconSize = 20,
    containerStyle
}: FloatingTabBarProps) {
    const palette = useAppPalette();
    const reducedMotion = useReducedMotion();

    // ── Liquid pill shared values ─────────────────────────────────────────────
    const pillX = useSharedValue(0);        // translateX of the pill
    const pillW = useSharedValue(0);        // width of the pill
    const pillScaleX = useSharedValue(1);   // horizontal stretch during transit
    const pillScaleY = useSharedValue(1);   // vertical squash during transit

    // Per-tab measured layouts (x + width relative to the slot row)
    const layoutsRef = useRef<Array<{ x: number; width: number }>>([]);
    // Tab-array index the pill currently sits on. Never use state.index for
    // this: it points into state.routes, which also holds non-tab routes
    // (card, deposit, …), so it drifts from the index within `tabs`.
    const prevIndexRef = useRef<number>(-1);
    // First paint has no layout yet, so the initial placement is completed by
    // measureTab; this flag tells the two paths apart.
    const pillPositionedRef = useRef(false);

    // Which slot in `tabs` the active route maps to (-1 when it has no slot).
    const activeRouteName = state?.routes?.[state.index]?.name;
    const activeTabIdx = tabs.findIndex((t) => t.name === activeRouteName);

    useEffect(() => {
        if (activeTabIdx < 0) return;
        const layout = layoutsRef.current[activeTabIdx];
        if (!layout) return; // measureTab places the pill once layouts arrive

        if (!pillPositionedRef.current) {
            // First placement — snap, never animate from x=0/width=0.
            pillX.set(layout.x);
            pillW.set(layout.width);
            pillScaleX.set(1);
            pillScaleY.set(1);
            pillPositionedRef.current = true;
            prevIndexRef.current = activeTabIdx;
            return;
        }

        if (activeTabIdx === prevIndexRef.current) {
            // Same tab — re-align if the slot was re-measured (resize etc).
            if (pillX.get() !== layout.x || pillW.get() !== layout.width) {
                pillX.set(layout.x);
                pillW.set(layout.width);
            }
            return;
        }

        if (reducedMotion) {
            pillX.set(layout.x);
            pillW.set(layout.width);
            pillScaleX.set(1);
            pillScaleY.set(1);
            prevIndexRef.current = activeTabIdx;
            return;
        }

        // ── Liquid morph ──────────────────────────────────────────────────────
        const fromX = pillX.get();
        const distance = Math.abs(layout.x - fromX);

        // Stretch proportional to travel distance, capped at MAX_STRETCH.
        // Adjacent tabs stretch a little; opposite-end tabs stretch a lot.
        const stretch = Math.min(1 + distance / 120, MAX_STRETCH);
        const squash = Math.max(1 / stretch, MAX_SQUASH);

        // Phase 1: stretch out + travel (fast, ease-out pull), then
        // Phase 2: settle back to rest with a bouncy spring.
        pillScaleX.set(withSequence(
            withTiming(stretch, { duration: STRETCH_DURATION, easing: STRETCH_EASE }),
            withSpring(1, SETTLE_SPRING)
        ));
        pillScaleY.set(withSequence(
            withTiming(squash, { duration: STRETCH_DURATION, easing: STRETCH_EASE }),
            withSpring(1, SETTLE_SPRING)
        ));
        pillX.set(withSpring(layout.x, PILL_SPRING));
        pillW.set(withSpring(layout.width, PILL_SPRING));
        prevIndexRef.current = activeTabIdx;
    }, [activeTabIdx, reducedMotion]);

    // Measure each tab slot so the pill knows where to travel
    const measureTab = useCallback((idx: number, e: LayoutChangeEvent) => {
        const { x, width: w } = e.nativeEvent.layout;
        layoutsRef.current[idx] = { x, width: w };

        // Effects run before native layout events, so the initially-active
        // tab is placed here as soon as it is measured — this is what makes
        // the pill visible on app start. Also re-aligns when a slot
        // re-measures (rotation, font change, …).
        if (idx === activeTabIdx && (!pillPositionedRef.current || prevIndexRef.current === idx)) {
            pillX.set(x);
            pillW.set(w);
            pillPositionedRef.current = true;
            prevIndexRef.current = idx;
        }
    }, [activeTabIdx]);

    // ── Animated styles ───────────────────────────────────────────────────────
    const pillStyle = useAnimatedStyle(() => ({
        transform: [
            { translateX: pillX.get() },
            { scaleX: pillScaleX.get() },
            { scaleY: pillScaleY.get() }
        ],
        width: pillW.get()
    }));

    if (!state || !navigation) return null;

    const currentRouteName = state.routes[state.index]?.name;
    const isAllowedTab = ['index', 'card', 'history', 'insights'].includes(currentRouteName);
    if (!isAllowedTab) return null;

    const isDark = palette.scheme === 'dark';

    // True only where the compiled app can actually render Liquid Glass (iOS 26+, right
    // Xcode/Info.plist). GlassView falls back to a plain View regardless — this just tells
    // us whether to skip painting an opaque fallback color over real glass.
    const hasNativeGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

    // Active accent follows the theme's text color
    const activeColor = palette.text;
    const inactiveColor = hexToRgba(palette.text, isDark ? 0.38 : 0.35);
    // Active pill background — visible frosted highlight
    const activePillBg = hexToRgba(palette.text, isDark ? 0.22 : 0.13);
    // Border: bright top edge = light catching glass
    const borderColor = hexToRgba(palette.text, isDark ? 0.18 : 0.09);
    // Outer shadow glow colour
    const shadowColor = isDark ? '#000' : '#1E293B';
    // Glass tint derives from the active accent so custom themes recolor the bar
    const glassTint = hexToRgba(palette.primary, isDark ? 0.18 : 0.12);

    return (
        <View style={[styles.floatingContainer, { bottom: Platform.OS === 'ios' ? 28 : 20 }]}>
            {/* Shadow lives on its own wrapper — overflow:'hidden' on the glass surface below
                would otherwise clip its own shadow away on iOS */}
            <View
                style={[
                    styles.shadowWrapper,
                    {
                        width,
                        shadowColor,
                        backgroundColor: palette.card
                    }
                ]}
            >
                {/* Glass pill shell — real UIVisualEffectView glass on iOS 26+, the previous
                    tinted look as a graceful fallback everywhere else */}
                <GlassView
                    glassEffectStyle="regular"
                    tintColor={hasNativeGlass ? glassTint : undefined}
                    style={[
                        styles.pillTabBar,
                        { borderColor },
                        !hasNativeGlass && {
                            backgroundColor: hexToRgba(palette.card, 0.82)
                        },
                        containerStyle
                    ]}
                >
                    {/* Bright top-edge inner highlight — simulates light catching the glass rim */}
                    <View
                        pointerEvents="none"
                            style={[
                            styles.topEdgeHighlight,
                            { backgroundColor: hexToRgba(palette.text, isDark ? 0.09 : 0.6) }
                        ]}
                    />

                    {/* ── Liquid pill — single sliding indicator ────────────────── */}
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            styles.liquidPill,
                            { backgroundColor: activePillBg },
                            pillStyle
                        ]}
                    />

                    {tabs.map((tab, idx) => {
                        const route = state.routes.find((r: any) => r.name === tab.name);
                        const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
                        const isFocused = routeIndex !== -1 && state.index === routeIndex;

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

                        return (
                            <TabItem
                                key={tab.name}
                                tab={tab}
                                isFocused={isFocused}
                                activeColor={activeColor}
                                inactiveColor={inactiveColor}
                                iconSize={iconSize}
                                showLabels={showLabels}
                                onLayout={(e) => measureTab(idx, e)}
                                onPress={onPress}
                            />
                        );
                    })}
                </GlassView>
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
        pointerEvents: 'box-none'
    },
    shadowWrapper: {
        borderRadius: 40,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.28,
        shadowRadius: 24,
        elevation: 18
    },
    pillTabBar: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 7,
        paddingHorizontal: 8,
        borderRadius: 40,
        borderWidth: 1,
        overflow: 'hidden'
    },
    topEdgeHighlight: {
        position: 'absolute',
        top: 0,
        left: 16,
        right: 16,
        height: 1,
        borderRadius: 1,
        zIndex: 1
    },
    // The liquid pill — absolutely positioned behind the icons, animated by Reanimated.
    // left must be 0: layout.x from onLayout already includes the parent's paddingHorizontal,
    // so hardcoding left: 6 here double-counts it and shifts the pill off the icon center.
    liquidPill: {
        position: 'absolute',
        left: 0,
        top: 6,
        bottom: 6,
        borderRadius: 30,
        zIndex: 0
    },
    tabItemWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2
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
