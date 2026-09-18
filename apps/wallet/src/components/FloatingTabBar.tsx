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
// npx expo install expo-glass-effect — official Expo wrapper around iOS 26's Liquid Glass
// (UIVisualEffectView). GlassView renders the real native glass on iOS 26+ and quietly
// falls back to a plain View everywhere else (older iOS, Android, web) — no Platform
// branching needed on our end. Works straight in Expo Go; for your own dev/prod build,
// just make sure the build machine (or EAS image) is on Xcode 26 so it compiles.
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
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

// Tint laid over the real glass on iOS 26+ — kept light so the native blur still does the
// work of obscuring what's underneath. Swap these for your exact brand purple.
const GLASS_TINT_DARK = 'rgba(139, 92, 246, 0.18)';
const GLASS_TINT_LIGHT = 'rgba(124, 58, 237, 0.12)';

// How strongly the active icon's shape gets washed with color while its outline stays crisp.
// Lower (~0.15) for a barely-there wash, higher (~0.4) for a bolder duotone look.
const ACTIVE_ICON_FILL_OPACITY = 0.28;

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
 *  - GlassView (iOS 26+ Liquid Glass) provides the real "translucent material" layer (§12);
 *    falls back to the previous tinted-view look everywhere else
 *  - Bright top border edge = light catching the glass surface (§12)
 *  - Active icon stays duotone, not a solid silhouette: closed shapes get a light color wash,
 *    every outline (incl. internal detail lines) stays fully drawn (§16 — familiarity)
 *  - Active pill scale animation from current value on press (§1 — respond on down)
 *  - Shadow lives on its own wrapper, one level above the clipped glass surface (§12)
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

    // True only where the compiled app can actually render Liquid Glass (iOS 26+, right
    // Xcode/Info.plist). GlassView falls back to a plain View regardless — this just tells
    // us whether to skip painting an opaque fallback color over real glass.
    const hasNativeGlass = Platform.OS === 'ios' && isLiquidGlassAvailable();

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
            {/* Shadow lives on its own wrapper — overflow:'hidden' on the glass surface below
          would otherwise clip its own shadow away on iOS */}
            <View
                style={[
                    styles.shadowWrapper,
                    {
                        width,
                        shadowColor,
                        // Solid, fully hidden under the glass surface above — only here so Android's
                        // elevation shadow has an opaque layer to render against.
                        backgroundColor: isDark ? '#121216' : '#FFFFFF'
                    }
                ]}
            >
                {/* Glass pill shell — real UIVisualEffectView glass on iOS 26+, the previous
            tinted look as a graceful fallback everywhere else (older iOS, Android, web) */}
                <GlassView
                    glassEffectStyle="regular"
                    tintColor={hasNativeGlass ? (isDark ? GLASS_TINT_DARK : GLASS_TINT_LIGHT) : undefined}
                    style={[
                        styles.pillTabBar,
                        { borderColor },
                        !hasNativeGlass && {
                            backgroundColor: isDark ? 'rgba(18,18,22,0.78)' : 'rgba(255,255,255,0.82)'
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
                                    {/* Active icon: closed shapes get a light color wash, but every outline
                      — including internal detail lines — stays fully drawn (duotone, not
                      a solid silhouette) */}
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
        // No pointer events on the wrapper — only on pill content
        pointerEvents: 'box-none'
    },
    // Carries the shadow only. Kept separate from the clipped glass surface below, since
    // overflow:'hidden' on the same view would clip its own shadow away on iOS.
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
        paddingHorizontal: 6,
        borderRadius: 40,
        // Single-pixel border on all sides — glass rim
        borderWidth: 1,
        overflow: 'hidden'
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