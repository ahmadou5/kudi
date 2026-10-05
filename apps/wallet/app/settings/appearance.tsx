import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  Pressable,
  ScrollView,
  useColorScheme as useDeviceColorScheme,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, SunMedium, MoonStar, Smartphone, Check, Sparkles } from 'lucide-react-native';
import { useAppPalette, getThemeLabel, hexToRgba } from '../../src/lib/theme';
import { usePreferencesStore, PreferencesState, ThemeMode } from '../../src/store/preferences.store';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const THEME_OPTIONS: Array<{
  mode: ThemeMode;
  title: string;
  subtitle: string;
  Icon: typeof SunMedium;
}> = [
  {
    mode: 'light',
    title: 'Light',
    subtitle: 'Bright surfaces and crisp contrast for daytime use.',
    Icon: SunMedium,
  },
  {
    mode: 'dark',
    title: 'Dark',
    subtitle: 'Deep surfaces with softer contrast for low-light use.',
    Icon: MoonStar,
  },
  {
    mode: 'system',
    title: 'System',
    subtitle: 'Follow your device system theme automatically.',
    Icon: Smartphone,
  },
];

export default function AppearanceScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const deviceScheme = (useDeviceColorScheme() ?? 'dark') as 'light' | 'dark';
  const themeMode = usePreferencesStore((s: PreferencesState) => s.themeMode);
  const setThemeMode = usePreferencesStore((s: PreferencesState) => s.setThemeMode);

  const activeThemeLabel = useMemo(
    () => getThemeLabel(themeMode, deviceScheme),
    [themeMode, deviceScheme]
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Top Header */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          hitSlop={12}
        >
          <ChevronLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Appearance</Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.heroHeader}>
            <View style={[styles.sparkleBadge, { backgroundColor: hexToRgba(palette.primary, 0.14) }]}>
              <Sparkles size={18} color={palette.primary} />
            </View>
            <Text style={[styles.heroLabel, { color: palette.textSecondary }]}>Theme & Preferences</Text>
          </View>
          <Text style={[styles.heroTitle, { color: palette.text }]}>
            Pick a theme that matches how you like to view your finances.
          </Text>
        </View>

        {/* Active Theme Bar & Options */}
        <View style={[styles.cardGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.activeRow, { borderBottomColor: palette.border }]}>
            <View style={styles.activeCopy}>
              <View style={[styles.activeDot, { backgroundColor: palette.success }]} />
              <Text style={[styles.activeLabel, { color: palette.textSecondary }]}>
                Active: <Text style={{ color: palette.text, fontFamily: Typography.family.bold }}>{activeThemeLabel}</Text>
              </Text>
            </View>
            <Text style={[styles.activeHint, { color: palette.textSecondary }]}>Syncs across app</Text>
          </View>

          <View style={styles.themeList}>
            {THEME_OPTIONS.map((item) => {
              const isSelected = themeMode === item.mode;
              const OptIcon = item.Icon;

              return (
                <Pressable
                  key={item.mode}
                  onPress={() => setThemeMode(item.mode)}
                  style={({ pressed }) => [
                    styles.themeRow,
                    {
                      backgroundColor: palette.bg,
                      borderColor: isSelected ? palette.primary : palette.border,
                      opacity: pressed ? 0.95 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.themeIcon,
                      {
                        backgroundColor: isSelected
                          ? hexToRgba(palette.primary, 0.16)
                          : hexToRgba(palette.textSecondary, 0.1),
                      },
                    ]}
                  >
                    <OptIcon size={20} color={isSelected ? palette.primary : palette.textSecondary} />
                  </View>

                  <View style={styles.themeCopy}>
                    <Text style={[styles.themeTitle, { color: palette.text }]}>{item.title}</Text>
                    <Text style={[styles.themeSubtitle, { color: palette.textSecondary }]}>{item.subtitle}</Text>
                  </View>

                  <View
                    style={[
                      styles.selectionDot,
                      {
                        borderColor: isSelected ? palette.primary : palette.border,
                        backgroundColor: isSelected ? palette.primary : 'transparent',
                      },
                    ]}
                  >
                    {isSelected ? <Check size={12} color="#FFFFFF" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.family.bold },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: 10,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkleBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: Typography.xs,
    fontFamily: Typography.family.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  heroTitle: {
    fontSize: Typography.md,
    fontFamily: Typography.family.bold,
    lineHeight: 22,
  },
  cardGroup: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  activeCopy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeLabel: {
    fontSize: Typography.xs,
  },
  activeHint: {
    fontSize: Typography.xs,
  },
  themeList: {
    gap: 10,
  },
  themeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: Spacing.md,
  },
  themeIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeCopy: {
    flex: 1,
    gap: 2,
  },
  themeTitle: {
    fontSize: Typography.md,
    fontFamily: Typography.family.bold,
  },
  themeSubtitle: {
    fontSize: Typography.xs,
    lineHeight: 16,
  },
  selectionDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
