import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, KeyRound, ChevronRight, Key } from 'lucide-react-native';
import { useAppPalette, isLight } from '../../lib/theme';
import { usePreferencesStore, PreferencesState } from '../../store/preferences.store';
import { Typography } from '../../constants/typography';
import { AppModal, useAppModal } from '../../components/ui/AppModal';

export default function SecurityScreen() {
  const palette = useAppPalette();
  const light = isLight(palette.bg);
  const appLockEnabled = usePreferencesStore((s: PreferencesState) => s.appLockEnabled);
  const setAppLockEnabled = usePreferencesStore((s: PreferencesState) => s.setAppLockEnabled);
  const modal = useAppModal();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Security</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[Typography.subhead, styles.sectionSubtitle, { color: palette.textSecondary }]}>
          Protect your account and transactions
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <TouchableOpacity
            style={[styles.rowItem, { borderBottomColor: palette.border }]}
            onPress={() => modal.alert('Change PIN', 'Enter your current 4-digit PIN to set a new one.', 'info')}
            activeOpacity={0.7}
          >
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <KeyRound size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Change 4-Digit PIN</Text>
                <Text style={[Typography.subhead, { color: palette.textSecondary }]}>Used to confirm transactions</Text>
              </View>
            </View>
            <ChevronRight size={18} color={palette.textSecondary} />
          </TouchableOpacity>

          <View style={styles.rowItem}>
            <View style={styles.itemLeft}>
              <View style={[styles.iconBadge, { backgroundColor: light ? '#E2E8F0' : 'rgba(255,255,255,0.08)' }]}>
                <Key size={18} color={palette.text} />
              </View>
              <View>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Require Passcode on Launch</Text>
                <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                  Lock app when sent to background
                </Text>
              </View>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={setAppLockEnabled}
              trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>
        <AppModal config={modal.config} onClose={modal.hide} />
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
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
