import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Switch
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette, isLight } from '../../lib/theme';
import { Typography } from '../../constants/typography';

export default function NotificationsScreen() {
  const palette = useAppPalette();
  const light = isLight(palette.bg);

  const [pushAlerts, setPushAlerts] = useState(true);
  const [transactionAlerts, setTransactionAlerts] = useState(true);
  const [securityAlerts, setSecurityAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={[Typography.subhead, styles.sectionSubtitle, { color: palette.textSecondary }]}>
          Manage how Kudi notifies you of activity
        </Text>

        <View style={[styles.cardGroup, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.rowItem, { borderBottomColor: palette.border }]}>
            <View style={styles.itemLeft}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Push Notifications</Text>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                Receive instant alerts on your mobile device
              </Text>
            </View>
            <Switch
              value={pushAlerts}
              onValueChange={setPushAlerts}
              trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.rowItem, { borderBottomColor: palette.border }]}>
            <View style={styles.itemLeft}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Transaction Activity</Text>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                Alerts for deposits, transfers, and card spending
              </Text>
            </View>
            <Switch
              value={transactionAlerts}
              onValueChange={setTransactionAlerts}
              trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={[styles.rowItem, { borderBottomColor: palette.border }]}>
            <View style={styles.itemLeft}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Security Alerts</Text>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                Critical alerts when logins or PIN changes occur
              </Text>
            </View>
            <Switch
              value={securityAlerts}
              onValueChange={setSecurityAlerts}
              trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.rowItem}>
            <View style={styles.itemLeft}>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Promotions & Updates</Text>
              <Text style={[Typography.subhead, { color: palette.textSecondary }]}>
                Product news, features, and partner offers
              </Text>
            </View>
            <Switch
              value={marketingEmails}
              onValueChange={setMarketingEmails}
              trackColor={{ false: light ? '#CBD5E1' : '#3A3A3C', true: '#10B981' }}
              thumbColor="#FFFFFF"
            />
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
    flex: 1,
    paddingRight: 16
  }
});
