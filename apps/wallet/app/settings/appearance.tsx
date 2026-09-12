import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Monitor, Sun, Moon, Check, LucideIcon } from 'lucide-react-native';
import { useAppPalette, isLight } from '../../lib/theme';
import { usePreferencesStore, PreferencesState, ThemeMode } from '../../store/preferences.store';
import { Typography } from '../../constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AppearanceScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const light = isLight(palette.bg);
  const themeMode = usePreferencesStore((s: PreferencesState) => s.themeMode);
  const setThemeMode = usePreferencesStore((s: PreferencesState) => s.setThemeMode);

  const options: { mode: ThemeMode; title: string; subtitle: string; Icon: LucideIcon }[] = [
    {
      mode: 'system',
      title: 'System',
      subtitle: 'Automatically match your device system settings',
      Icon: Monitor
    },
    {
      mode: 'light',
      title: 'Light',
      subtitle: 'Always use light theme',
      Icon: Sun
    },
    {
      mode: 'dark',
      title: 'Dark',
      subtitle: 'Always use dark theme',
      Icon: Moon
    }
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Appearance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[Typography.subhead, styles.sectionSubtitle, { color: palette.textSecondary }]}>
          Choose how Kudi looks to you
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {options.map((opt, idx) => {
            const isSelected = themeMode === opt.mode;
            const isLast = idx === options.length - 1;
            const OptIcon = opt.Icon;

            return (
              <TouchableOpacity
                key={opt.mode}
                style={[
                  styles.rowItem,
                  !isLast && { borderBottomWidth: 1, borderBottomColor: palette.border }
                ]}
                onPress={() => setThemeMode(opt.mode)}
                activeOpacity={0.7}
              >
                <View style={styles.itemLeft}>
                  <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                    <OptIcon size={20} color={palette.text} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Typography.bodyBold, { color: palette.text }]}>{opt.title}</Text>
                    <Text style={[Typography.subhead, { color: palette.textSecondary }]}>{opt.subtitle}</Text>
                  </View>
                </View>

                {/* Custom Radio Dot */}
                <View
                  style={[
                    styles.radioOuter,
                    isSelected
                      ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                      : { borderColor: palette.border, backgroundColor: 'transparent' }
                  ]}
                >
                  {isSelected && <Check size={12} color="#FFFFFF" />}
                </View>
              </TouchableOpacity>
            );
          })}
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
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    padding: 20
  },
  sectionSubtitle: {
    marginBottom: 16
  },
  cardGroup: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16
  },
  itemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
    paddingRight: 12
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
