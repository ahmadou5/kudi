import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../constants/typography';
import { useAppPalette } from '../../lib/theme';
import { useAuthStore, AuthState } from '../../store/auth.store';

export default function WelcomeScreen() {
  const palette = useAppPalette();
  const sendPrivyOTP = useAuthStore((s: AuthState) => s.sendPrivyOTP);
  const verifyPrivyOTP = useAuthStore((s: AuthState) => s.verifyPrivyOTP);
  const loginWithPrivy = useAuthStore((s: AuthState) => s.loginWithPrivy);

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSendOTP = async () => {
    setErrorMsg(null);
    const targetEmail = email.trim().toLowerCase();

    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    console.log(`[Privy Auth] Sending OTP code to ${targetEmail}...`);

    const res = await sendPrivyOTP(targetEmail);
    setIsLoading(false);

    if (res.success) {
      setStep('otp');
    } else {
      setErrorMsg(res.error || 'Failed to send verification code. Please try again.');
    }
  };

  const handleVerifyOTP = async () => {
    setErrorMsg(null);
    const code = otpCode.trim();

    if (!code || code.length < 4) {
      setErrorMsg('Please enter the verification code sent to your email');
      return;
    }

    setIsLoading(true);
    console.log(`[Privy Auth] Verifying OTP code for ${email}...`);

    const res = await verifyPrivyOTP(email, code);
    setIsLoading(false);

    if (res.success) {
      console.log('[Auth] Privy Email OTP authentication successful. Navigating to main dashboard...');
      router.replace('/(tabs)');
    } else {
      setErrorMsg(res.error || 'Invalid verification code. Please check and try again.');
    }
  };

  const handleDemoSkip = async () => {
    setErrorMsg(null);
    setIsLoading(true);
    const demoEmail = `demo_${Date.now()}@kudi.app`;
    const privyUserId = `privy_usr_demo_${Date.now()}`;

    const res = await loginWithPrivy({
      privyUserId,
      email: demoEmail,
      name: 'Demo User'
    });
    setIsLoading(false);

    if (res.success) {
      router.replace('/(tabs)');
    } else {
      setErrorMsg('Demo sign in failed');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        {step === 'otp' ? (
          <TouchableOpacity
            onPress={() => {
              setStep('email');
              setErrorMsg(null);
            }}
            style={[styles.backPill, { backgroundColor: palette.card, borderColor: palette.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={16} color={palette.text} />
            <Text style={[Typography.bodyBold, { color: palette.text }]}>Back</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleDemoSkip}
            style={[styles.skipPill, { backgroundColor: palette.card, borderColor: palette.border }]}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <Text style={[Typography.bodyBold, { color: palette.text }]}>Skip Login</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Main Headline & Hero Visual */}
      <View style={styles.content}>
        <Text style={[Typography.displayLarge, styles.title, { color: palette.text }]}>
          Money,{"\n"}forever yours
        </Text>
        <Text style={[Typography.body, styles.subtitle, { color: palette.textSecondary }]}>
          Self-custodied via Privy. Instant Naira payouts to any Nigerian bank.
        </Text>

        {/* Hero Visual Phone Illustration */}
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.phoneFrame}>
            <View style={styles.phoneNotch} />
            <Text style={[Typography.caption, { color: '#CBD5E1' }]}>Kudi Wallet</Text>
            <Text style={[Typography.currencyDisplay, { color: '#FFFFFF', fontSize: 20, marginVertical: 8 }]}>$343,287.81</Text>
            <View style={styles.phonePillRow}>
              <View style={styles.phonePill} />
              <View style={styles.phonePill} />
            </View>
          </View>
        </View>
      </View>

      {/* Auth Section — Email OTP */}
      <View style={styles.authSection}>
        {errorMsg && (
          <Text style={[Typography.caption, { color: '#EF4444', textAlign: 'center', marginBottom: 4 }]}>
            {errorMsg}
          </Text>
        )}

        {step === 'email' ? (
          <View style={{ gap: 12 }}>
            <Text style={[Typography.caption, { color: palette.textSecondary, textAlign: 'center' }]}>
              Enter your email to receive a 6-digit Privy verification code
            </Text>

            {/* Email Input */}
            <View style={[styles.inputWrapper, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Ionicons name="mail-outline" size={20} color={palette.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Enter your email (e.g. name@example.com)"
                placeholderTextColor={palette.textSecondary}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[Typography.body, styles.inputField, { color: palette.text }]}
              />
            </View>

            {/* Continue with Email OTP Button */}
            <TouchableOpacity
              onPress={handleSendOTP}
              style={[styles.authBtn, { backgroundColor: palette.text, borderColor: palette.text }]}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={palette.bg} />
              ) : (
                <>
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>Send Verification Code</Text>
                  <Ionicons name="arrow-forward" size={18} color={palette.bg} />
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={[Typography.caption, { color: palette.textSecondary, textAlign: 'center' }]}>
              Enter the 6-digit code sent to <Text style={{ color: palette.text, fontWeight: '700' }}>{email}</Text>
            </Text>

            {/* OTP Code Input */}
            <View style={[styles.inputWrapper, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Ionicons name="key-outline" size={20} color={palette.textSecondary} style={{ marginRight: 10 }} />
              <TextInput
                placeholder="Enter 6-digit OTP code"
                placeholderTextColor={palette.textSecondary}
                value={otpCode}
                onChangeText={(val) => {
                  setOtpCode(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                style={[Typography.body, styles.inputField, { color: palette.text, letterSpacing: 4, fontWeight: '600' }]}
              />
            </View>

            {/* Verify OTP Code Button */}
            <TouchableOpacity
              onPress={handleVerifyOTP}
              style={[styles.authBtn, { backgroundColor: palette.text, borderColor: palette.text }]}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={palette.bg} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={20} color={palette.bg} />
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>Verify & Sign In</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Resend / Change Email Controls */}
            <View style={styles.footerRow}>
              <TouchableOpacity onPress={handleSendOTP} disabled={isLoading}>
                <Text style={[Typography.caption, { color: palette.text, textDecorationLine: 'underline' }]}>
                  Resend code
                </Text>
              </TouchableOpacity>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>•</Text>
              <TouchableOpacity onPress={() => { setStep('email'); setErrorMsg(null); }}>
                <Text style={[Typography.caption, { color: palette.textSecondary, textDecorationLine: 'underline' }]}>
                  Change email
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, paddingVertical: 20, justifyContent: 'space-between' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 16 },
  skipPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  backPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  content: { alignItems: 'center', marginVertical: 10 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 10, maxWidth: 320 },
  heroCard: {
    width: '100%',
    height: 180,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  phoneFrame: {
    width: 160,
    height: 160,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#334155',
    padding: 12,
    alignItems: 'center'
  },
  phoneNotch: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#475569', marginBottom: 12 },
  phonePillRow: { flexDirection: 'row', gap: 6, marginTop: 8 },
  phonePill: { width: 36, height: 16, borderRadius: 8, backgroundColor: '#334155' },
  authSection: { gap: 12, paddingBottom: 20 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    paddingHorizontal: 20
  },
  inputField: {
    flex: 1,
    height: '100%'
  },
  authBtn: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 20
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 6
  }
});
