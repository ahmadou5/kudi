import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';

export interface TabItemConfig {
  name: string;
  label: string;
  iconName: keyof typeof Ionicons.glyphMap;
  activeIconName?: keyof typeof Ionicons.glyphMap;
}

/**
 * Default tab configuration for the 3 main routes: Home, Card, History.
 * Easily modify icons, labels, or add/remove routes here!
 */
export const DEFAULT_TABS: TabItemConfig[] = [
  { name: 'index', label: 'Home', iconName: 'home-outline', activeIconName: 'home' },
  { name: 'card', label: 'Card', iconName: 'card-outline', activeIconName: 'card' },
  { name: 'history', label: 'History', iconName: 'time-outline', activeIconName: 'time' },
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
 */
export function FloatingTabBar({
  state,
  descriptors,
  navigation,
  tabs = DEFAULT_TABS,
  width = '55%',
  showLabels = false,
  iconSize = 18,
  containerStyle
}: FloatingTabBarProps) {
  const palette = useAppPalette();

  if (!state || !navigation) return null;

  // Ensure tab bar ONLY shows on the 3 main tab screens: Home ('index'), Card ('card'), and History ('history')
  const currentRouteName = state.routes[state.index]?.name;
  const isAllowedTab = ['index', 'card', 'history'].includes(currentRouteName);
  if (!isAllowedTab) {
    return null;
  }

  const isDark = palette.text === '#FFFFFF';
  const pillBg = isDark ? 'rgba(18, 20, 29, 0.73)' : 'rgba(255, 255, 255, 0.73)';

  return (
    <View style={styles.floatingContainer}>
      <View
        style={[
          styles.pillTabBar,
          {
            width,
            backgroundColor: pillBg,
            borderColor: palette.border
          },
          containerStyle
        ]}
      >
        {tabs.map((tab) => {
          const route = state.routes.find((r: any) => r.name === tab.name);
          const routeIndex = state.routes.findIndex((r: any) => r.name === tab.name);
          const isFocused = routeIndex !== -1 && state.index === routeIndex;
          const icon = isFocused ? (tab.activeIconName || tab.iconName) : tab.iconName;

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

          const color = isFocused
            ? (palette.text === '#FFFFFF' ? '#FFFFFF' : '#0F172A')
            : palette.textSecondary;

          return (
            <TouchableOpacity
              key={tab.name}
              onPress={onPress}
              activeOpacity={0.7}
              style={[
                styles.tabItem,
                isFocused && {
                  backgroundColor: palette.text === '#FFFFFF' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.08)'
                }
              ]}
            >
              <Ionicons name={icon} size={iconSize} color={color} />
              {showLabels && (
                <Text
                  style={[
                    Typography.footnote,
                    {
                      color,
                      fontWeight: isFocused ? '700' : '500'
                    }
                  ]}
                >
                  {tab.label}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 50
  },
  pillTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 35,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 25
  }
});
