import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { useAuthStore } from '../../store/auth.store';
import { sdk } from '../../src/lib/sdk';
import { AppModal, useAppModal } from '../../components/ui/AppModal';

const NETWORKS = [
  { id: 'MTN', name: 'MTN Nigeria', logo: require('../../assets/logos/mtn.png') },
  { id: 'AIRTEL', name: 'Airtel', logo: require('../../assets/logos/airtel.png') },
  { id: 'GLO', name: 'Glo Mobile', logo: require('../../assets/logos/glo.png') },
  { id: '9MOBILE', name: '9mobile', logo: require('../../assets/logos/9mobile.png') }
];

export default function AirtimeBillScreen() {
  const palette = useAppPalette();
  const user = useAuthStore(s => s.user);
  const modal = useAppModal();

  const [selectedNetwork, setSelectedNetwork] = useState('MTN');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amountNGN, setAmountNGN] = useState('1000');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePurchase = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      modal.alert('Invalid Phone Number', 'Please enter a valid recipient phone number.', 'warning');
      return;
    }
    const amount = parseFloat(amountNGN);
    if (!amount || amount < 100) {
      modal.alert('Invalid Amount', 'Minimum airtime purchase is ₦100 NGN.', 'warning');
      return;
    }
    if (!user?.id) {
      modal.alert('Authentication Required', 'Please log in to purchase airtime.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sdk.payBill({
        userId: user.id,
        billType: 'AIRTIME',
        billerName: selectedNetwork,
        recipientIdentifier: phoneNumber,
        amountNGN: amount
      });

      setIsSubmitting(false);
      if (res && res.success) {
        modal.show({
          title: 'Airtime Sent! 📱⚡',
          description: `Successfully recharged ₦${amount.toLocaleString()} NGN airtime to ${phoneNumber} (${selectedNetwork}).`,
          type: 'success',
          primaryText: 'Done',
          onPrimaryPress: () => {
            modal.hide();
            router.replace('/(tabs)');
          }
        });
      } else {
        const errorMsg = res?.error?.message || res?.message || 'Bill payment failed';
        modal.alert('Purchase Failed', errorMsg, 'error');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      modal.alert('Connection Error', err?.message || 'Could not process airtime purchase.', 'error');
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Buy Airtime</Text>
      </View>

      <Text style={[Typography.body, { color: palette.textSecondary, marginTop: 8 }]}>
        Instantly top up mobile credit for any network in Nigeria using your USDC balance.
      </Text>

      {/* Network Picker */}
      <View style={{ marginTop: 24 }}>
        <Text style={[Typography.bodyBold, { color: palette.text, marginBottom: 12 }]}>Select Network</Text>
        <View style={styles.networkGrid}>
          {NETWORKS.map(net => {
            const isSelected = selectedNetwork === net.id;
            return (
              <TouchableOpacity
                key={net.id}
                onPress={() => setSelectedNetwork(net.id)}
                style={[
                  styles.networkCard,
                  {
                    backgroundColor: isSelected ? palette.card : 'transparent',
                    borderColor: isSelected ? palette.text : palette.border
                  }
                ]}
                activeOpacity={0.7}
              >
                <Image source={net.logo} style={styles.logoImage} resizeMode="contain" />
                <Text style={[Typography.caption, { color: palette.text }]}>{net.id}</Text>

              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Input Fields */}
      <View style={{ gap: 16, marginTop: 24 }}>
        <View>
          <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Mobile Number</Text>
          <TextInput
            placeholder="e.g. 08031234567"
            placeholderTextColor={palette.textSecondary}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            style={[styles.input, { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }]}
          />
        </View>

        <View>
          <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Amount (NGN)</Text>
          <TextInput
            placeholder="1000"
            placeholderTextColor={palette.textSecondary}
            value={amountNGN}
            onChangeText={setAmountNGN}
            keyboardType="number-pad"
            style={[styles.input, { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }]}
          />
        </View>

        {/* Quick Amount Chips */}
        <View style={styles.chipRow}>
          {['500', '1000', '2000', '5000'].map(val => (
            <TouchableOpacity
              key={val}
              onPress={() => setAmountNGN(val)}
              style={[styles.chip, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[Typography.caption, { color: palette.text }]}>₦{val}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Pay Button */}
      <TouchableOpacity
        onPress={handlePurchase}
        disabled={isSubmitting}
        style={[styles.submitBtn, { backgroundColor: palette.text, marginTop: 32 }]}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color={palette.bg} />
        ) : (
          <Text style={[Typography.bodyBold, { color: palette.bg }]}>Purchase Airtime</Text>
        )}
      </TouchableOpacity>
      <AppModal config={modal.config} onClose={modal.hide} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  networkGrid: { flexDirection: 'row', gap: 10 },
  networkCard: {
    flex: 1,
    height: 72,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4
  },
  logoImage: { width: 32, height: 32, borderRadius: 8 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { flex: 1, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  submitBtn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }
});
