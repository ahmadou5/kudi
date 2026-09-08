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
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { useAuthStore } from '../store/auth.store';
import { sdk } from '../src/lib/sdk';
import { AppModal, useAppModal } from '../components/ui/AppModal';

export default function KYCScreen() {
  const palette = useAppPalette();
  const user = useAuthStore(s => s.user);
  const modal = useAppModal();

  const [idType, setIdType] = useState<'BVN' | 'NIN'>('BVN');
  const [idNumber, setIdNumber] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dob, setDob] = useState('1998-05-12');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!idNumber || idNumber.length < 10) {
      modal.alert('Invalid ID Number', `Please enter a valid 11-digit ${idType} number.`, 'warning');
      return;
    }
    if (!user?.id) {
      modal.alert('Authentication Error', 'Please log in to complete KYC verification.', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await sdk.verifyKYCID({
        userId: user.id,
        idNumber,
        idType,
        firstName: firstName || 'Ahmadou',
        lastName: lastName || 'Shuaibu',
        dob
      });

      setIsSubmitting(false);
      if (res && res.success) {
        modal.show({
          title: 'Verification Successful! 🎉',
          description: `Your ${idType} has been verified. Tier 2 limits (₦5,000,000 / day) and Virtual Bank Account activated!`,
          type: 'success',
          primaryText: 'Continue to Deposit',
          onPrimaryPress: () => {
            modal.hide();
            router.replace('/(tabs)/deposit');
          }
        });
      } else {
        const errorMsg = res?.error?.message || res?.message || 'KYC verification failed';
        modal.alert('Verification Failed', errorMsg, 'error');
      }
    } catch (err: any) {
      setIsSubmitting(false);
      modal.alert('Connection Error', err?.message || 'Could not verify ID.', 'error');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={[styles.container, { backgroundColor: palette.bg }]}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>KYC Identity Verification</Text>
      </View>

      <Text style={[Typography.body, { color: palette.textSecondary, marginTop: 8 }]}>
        Verify your identity to unlock higher daily limits and receive your dedicated local virtual bank account.
      </Text>

      {/* ID Type Selector */}
      <View style={{ marginTop: 24 }}>
        <Text style={[Typography.bodyBold, { color: palette.text, marginBottom: 8 }]}>Select Document Type</Text>
        <View style={styles.tabGroup}>
          <TouchableOpacity
            onPress={() => setIdType('BVN')}
            style={[
              styles.tabBtn,
              { backgroundColor: idType === 'BVN' ? palette.card : 'transparent', borderColor: idType === 'BVN' ? palette.text : palette.border }
            ]}
          >
            <Text style={[Typography.bodyBold, { color: idType === 'BVN' ? palette.text : palette.textSecondary }]}>
              BVN (Bank Verification No.)
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setIdType('NIN')}
            style={[
              styles.tabBtn,
              { backgroundColor: idType === 'NIN' ? palette.card : 'transparent', borderColor: idType === 'NIN' ? palette.text : palette.border }
            ]}
          >
            <Text style={[Typography.bodyBold, { color: idType === 'NIN' ? palette.text : palette.textSecondary }]}>
              NIN (National Identity No.)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Form Fields */}
      <View style={{ gap: 16, marginTop: 24 }}>
        <View>
          <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>
            {idType} Number (11 Digits)
          </Text>
          <TextInput
            placeholder={`Enter your 11-digit ${idType}`}
            placeholderTextColor={palette.textSecondary}
            value={idNumber}
            onChangeText={setIdNumber}
            keyboardType="number-pad"
            maxLength={11}
            style={[styles.input, { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }]}
          />
        </View>

        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>First Name</Text>
            <TextInput
              placeholder="First Name"
              placeholderTextColor={palette.textSecondary}
              value={firstName}
              onChangeText={setFirstName}
              style={[styles.input, { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }]}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Last Name</Text>
            <TextInput
              placeholder="Last Name"
              placeholderTextColor={palette.textSecondary}
              value={lastName}
              onChangeText={setLastName}
              style={[styles.input, { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }]}
            />
          </View>
        </View>

        <View>
          <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Date of Birth (YYYY-MM-DD)</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            placeholderTextColor={palette.textSecondary}
            value={dob}
            onChangeText={setDob}
            style={[styles.input, { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }]}
          />
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        onPress={handleSubmit}
        disabled={isSubmitting}
        style={[styles.submitBtn, { backgroundColor: palette.text, marginTop: 32 }]}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator color={palette.bg} />
        ) : (
          <Text style={[Typography.bodyBold, { color: palette.bg }]}>Submit Verification</Text>
        )}
      </TouchableOpacity>
      <AppModal config={modal.config} onClose={modal.hide} />
    </ScrollView>
  </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  tabGroup: { flexDirection: 'row', gap: 8 },
  tabBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  input: { height: 52, borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  submitBtn: { height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' }
});
