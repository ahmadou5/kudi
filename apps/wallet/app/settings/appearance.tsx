import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme as useDeviceColorScheme
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPalette, hexToRgba, mixColors, readableInk } from '../../src/lib/theme';
import { Colors, ACCENTS, SURFACES, CARD_TINTS, AccentId, SurfaceId, CardTintId } from '../../src/constants/palette';
import { usePreferencesStore, PreferencesState, ThemeMode } from '../../src/store/preferences.store';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { IconTile } from '../../src/components/ui/IconTile';
import { haptics } from '../../src/lib/haptics';

const MODE_OPTIONS: Array<{ mode: ThemeMode; title: string; glyph: string }> = [
  { mode: 'light', title: 'Light', glyph: 'white-balance-sunny' },
  { mode: 'dark', title: 'Dark', glyph: 'weather-night' },
  { mode: 'system', title: 'System', glyph: 'cellphone-cog' }
];

const tintColor = (tintId: CardTintId, scheme: 'dark' | 'light') =>
  (CARD_TINTS.find((option) => option.id === tintId) || CARD_TINTS[0])[scheme];

const accentColor = (id: AccentId, scheme: 'dark' | 'light') =>
  (ACCENTS.find((option) => option.id === id) || ACCENTS[0])[scheme];

const surfaceEntry = (id: SurfaceId, scheme: 'dark' | 'light') =>
  (SURFACES.find((option) => option.id === id) || SURFACES[0])[scheme];

function MiniScreen({
  scheme,
  accentId,
  cardTint,
  style
}: {
  scheme: 'dark' | 'light';
  accentId: AccentId;
  cardTint: CardTintId;
  style?: any;
}) {
  const bg = Colors[scheme].bg;
  const contrast = scheme === 'dark' ? '#FFFFFF' : '#0F172A';
  const card = mixColors(bg, contrast, tintColor(cardTint, scheme));
  const accent = accentColor(accentId, scheme);

  return (
    <View style={[styles.mini, { backgroundColor: bg }, style]}>
      <View style={[styles.miniBar, { backgroundColor: card, width: '100%' }]} />
      <View style={[styles.miniBar, { backgroundColor: card, width: '62%' }]} />
      <View style={[styles.miniPill, { backgroundColor: accent }]} />
    </View>
  );
}

function GroupLabel({ children, right, color }: { children: string; right?: string; color: string }) {
  return (
    <View style={styles.groupLabelRow}>
      <Text style={[styles.groupLabel, { color }]}>{children}</Text>
      {right && <Text style={[styles.groupLabelRight, { color }]}>{right}</Text>}
    </View>
  );
}

export default function AppearanceScreen() {
  const palette = useAppPalette();
  const deviceScheme = (useDeviceColorScheme() ?? 'dark') as 'light' | 'dark';
  const themeMode = usePreferencesStore((s: PreferencesState) => s.themeMode);
  const accentId = usePreferencesStore((s: PreferencesState) => s.accentId);
  const surfaceId = usePreferencesStore((s: PreferencesState) => s.surfaceId);
  const cardTint = usePreferencesStore((s: PreferencesState) => s.cardTint);
  const setThemeMode = usePreferencesStore((s: PreferencesState) => s.setThemeMode);
  const setAccent = usePreferencesStore((s: PreferencesState) => s.setAccent);
  const setSurface = usePreferencesStore((s: PreferencesState) => s.setSurface);
  const setCardTint = usePreferencesStore((s: PreferencesState) => s.setCardTint);

  const scheme = themeMode === 'system' ? deviceScheme : (themeMode as 'dark' | 'light');
  const isCustom = accentId !== 'slate' || surfaceId !== 'neutral' || cardTint !== 'flat';

  const activeAccentLabel = (ACCENTS.find((a) => a.id === accentId) || ACCENTS[0]).label;
  const activeTintLabel = (CARD_TINTS.find((t) => t.id === cardTint) || CARD_TINTS[0]).label;

  const summary = useMemo(() => {
    const modeLabel =
      themeMode === 'system'
        ? `System ${scheme === 'dark' ? 'Dark' : 'Light'}`
        : scheme === 'dark'
          ? 'Dark'
          : 'Light';
    return [modeLabel, surfaceEntry(surfaceId, scheme).label, activeAccentLabel, activeTintLabel]
      .join(' · ')
      .toUpperCase();
  }, [themeMode, scheme, surfaceId, activeAccentLabel, activeTintLabel]);

  const tap = () => {
    haptics.tap();
  };

  const labelColor = hexToRgba(palette.text, 0.45);
  const ink = readableInk(palette.primary);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibility-label="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.6 }
          ]}
        >
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[Typography.title1, { color: palette.text }]}>Appearance</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Compact live preview */}
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <MiniScreen scheme={scheme} accentId={accentId} cardTint={cardTint} style={styles.previewMini} />
          <View style={styles.previewCopy}>
            <Text style={[styles.summary, { color: hexToRgba(palette.text, 0.55) }]} numberOfLines={2}>
              {summary}
            </Text>
          </View>
          {isCustom && (
            <View style={[styles.customChip, { backgroundColor: hexToRgba(palette.primary, 0.16) }]}>
              <Text style={[styles.customChipText, { color: palette.primary }]}>Custom</Text>
            </View>
          )}
        </View>

        {/* Mode */}
        <View style={styles.group}>
          <GroupLabel color={labelColor}>Mode</GroupLabel>
          <View style={styles.modeRow}>
            {MODE_OPTIONS.map((option) => {
              const isSelected = themeMode === option.mode;
              return (
                <Pressable
                  key={option.mode}
                  onPress={() => {
                    tap();
                    setThemeMode(option.mode);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.modeTile,
                    {
                      backgroundColor: palette.card,
                      borderColor: isSelected ? palette.primary : palette.border
                    },
                    pressed && { opacity: 0.8 }
                  ]}
                >
                  {option.mode === 'system' ? (
                    <View style={styles.miniSplit}>
                      <MiniScreen scheme="light" accentId={accentId} cardTint={cardTint} style={styles.miniHalf} />
                      <MiniScreen scheme="dark" accentId={accentId} cardTint={cardTint} style={styles.miniHalf} />
                    </View>
                  ) : (
                    <MiniScreen
                      scheme={option.mode}
                      accentId={accentId}
                      cardTint={cardTint}
                      style={styles.miniFull}
                    />
                  )}
                  <Text
                    style={[
                      styles.modeLabel,
                      { color: isSelected ? palette.text : hexToRgba(palette.text, 0.6) }
                    ]}
                  >
                    {option.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Accent */}
        <View style={styles.group}>
          <GroupLabel color={labelColor} right={activeAccentLabel}>
            Accent
          </GroupLabel>
          <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.swatchRow}>
              {ACCENTS.map((option) => {
                const color = option[scheme];
                const isSelected = accentId === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => {
                      tap();
                      setAccent(option.id);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${option.label} accent`}
                    style={({ pressed }) => [styles.swatchCell, pressed && { opacity: 0.75 }]}
                  >
                    <View
                      style={[
                        styles.swatchRing,
                        { borderColor: isSelected ? palette.primary : 'transparent' }
                      ]}
                    >
                      <View
                        style={[
                          styles.swatch,
                          {
                            backgroundColor: color,
                            borderColor: hexToRgba(readableInk(color), 0.18)
                          }
                        ]}
                      >
                        {isSelected && <Check size={13} color={readableInk(color)} />}
                      </View>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.swatchLabel,
                        { color: isSelected ? palette.text : hexToRgba(palette.text, 0.55) }
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* Surface */}
        <View style={styles.group}>
          <GroupLabel color={labelColor}>Surface</GroupLabel>
          <View style={styles.segment}>
            {SURFACES.map((option) => {
              const entry = option[scheme];
              const isSelected = surfaceId === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    tap();
                    setSurface(option.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.segmentItem,
                    isSelected && { backgroundColor: palette.primary },
                    pressed && { opacity: 0.85 }
                  ]}
                >
                  <View
                    style={[
                      styles.surfaceDot,
                      { backgroundColor: entry.bg, borderColor: palette.border }
                    ]}
                  />
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.segmentText,
                      { color: isSelected ? ink : hexToRgba(palette.text, 0.65) }
                    ]}
                  >
                    {entry.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Card tint */}
        <View style={styles.group}>
          <GroupLabel color={labelColor}>Card tint</GroupLabel>
          <View style={styles.segment}>
            {CARD_TINTS.map((option) => {
              const isSelected = cardTint === option.id;
              return (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    tap();
                    setCardTint(option.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  style={({ pressed }) => [
                    styles.segmentItem,
                    isSelected && { backgroundColor: palette.primary },
                    pressed && { opacity: 0.85 }
                  ]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      { color: isSelected ? ink : hexToRgba(palette.text, 0.65) }
                    ]}
                  >
                    {option.label}
                  </Text>
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
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 32,
    gap: 14
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12
  },
  group: { gap: 7 },
  groupLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4
  },
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase'
  },
  groupLabelRight: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase'
  },
  previewMini: {
    width: 78,
    height: 54
  },
  previewCopy: { flex: 1 },
  summary: {
    fontFamily: Typography.family.mono,
    fontSize: 10,
    letterSpacing: 0.8,
    lineHeight: 15
  },
  customChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999
  },
  customChipText: {
    fontFamily: Typography.family.mono,
    fontSize: 10,
    letterSpacing: 0.8
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8
  },
  modeTile: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 6,
    gap: 6,
    alignItems: 'center'
  },
  miniSplit: {
    flexDirection: 'row',
    gap: 3,
    width: '100%'
  },
  mini: {
    height: 54,
    borderRadius: 8,
    padding: 6,
    gap: 4,
    overflow: 'hidden'
  },
  miniFull: { width: '100%', height: 44 },
  miniHalf: { flex: 1, height: 44 },
  miniBar: {
    height: 6,
    borderRadius: 3
  },
  miniPill: {
    width: 22,
    height: 6,
    borderRadius: 3,
    marginTop: 'auto'
  },
  modeLabel: {
    fontFamily: Typography.family.sans,
    fontSize: 11
  },
  swatchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  swatchCell: {
    alignItems: 'center',
    gap: 4,
    width: 46
  },
  swatchRing: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  },
  swatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  swatchLabel: {
    fontSize: 10
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    padding: 4,
    gap: 4
  },
  segmentItem: {
    flex: 1,
    height: 40,
    borderRadius: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: 'rgba(127,127,127,0.10)'
  },
  surfaceDot: {
    width: 16,
    height: 16,
    borderRadius: 6,
    borderWidth: StyleSheet.hairlineWidth
  },
  segmentText: {
    fontFamily: Typography.family.sans,
    fontSize: 12
  }
});
