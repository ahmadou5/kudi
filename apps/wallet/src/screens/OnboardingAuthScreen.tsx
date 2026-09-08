import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';

interface OnboardingAuthScreenProps {
  mode?: 'light' | 'dark';
}

type AuthStep = 'email' | 'otp';

export const OnboardingAuthScreen: React.FC<OnboardingAuthScreenProps> = ({ mode = 'dark' }) => {
  const isLight = mode === 'light';
  const { sendPrivyOTP, verifyPrivyOTP } = useAuthStore();

  const [step, setStep] = useState<AuthStep>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Step 1: send OTP to the user's email
  const handleSendOTP = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    const result = await sendPrivyOTP(cleanEmail);
    setLoading(false);
    if (result.success) {
      setStep('otp');
    } else {
      setErrorMsg(result.error || 'Failed to send OTP. Please try again.');
    }
  };

  // Step 2: verify OTP — the store handles persisting user/tokens
  const handleVerifyOTP = async () => {
    const cleanCode = otp.trim();
    if (cleanCode.length < 4) {
      setErrorMsg('Please enter the 6-digit code sent to your email');
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    const result = await verifyPrivyOTP(email.trim().toLowerCase(), cleanCode);
    setLoading(false);
    if (!result.success) {
      setErrorMsg(result.error || 'Incorrect code. Please try again.');
    }
    // On success, the store sets isAuthenticated=true → App.tsx re-renders to main screen
  };

  return (
    <View style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F' }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        {step === 'otp' ? (
          <TouchableOpacity
            onPress={() => { setStep('email'); setOtp(''); setErrorMsg(null); }}
            style={[
              styles.skipPill,
              { backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.1)', borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.2)' }
            ]}
          >
            <Text style={[styles.skipText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>← Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        <Text style={[styles.title, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
          Money,{"\n"}forever yours
        </Text>
        <Text style={[styles.subtitle, { color: isLight ? '#475569' : '#94A3B8' }]}>
          Deposit crypto. Spend instant Naira to any bank.
        </Text>

        {/* Hero Visual Mockup */}
        <View
          style={[
            styles.heroIllustration,
            {
              backgroundColor: isLight ? '#F8FAFC' : 'rgba(255, 255, 255, 0.04)',
              borderColor: isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.1)'
            }
          ]}
        >
          <View style={styles.mockupPhone}>
            <View style={styles.mockupNotch} />
            <Text style={styles.mockupBrand}>Kudi</Text>
            <Text style={styles.mockupBalance}>$343,287.81</Text>
            <View style={styles.mockupPills}>
              <View style={styles.mockupPill} />
              <View style={styles.mockupPill} />
            </View>
          </View>
        </View>
      </View>

      {/* Auth Form Section */}
      <View style={styles.authSection}>
        {errorMsg && (
          <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>
            {errorMsg}
          </Text>
        )}

        {step === 'email' ? (
          <View style={{ gap: 12 }}>
            <TextInput
              placeholder="Enter your email (e.g. name@example.com)"
              placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
              value={email}
              onChangeText={(val) => { setEmail(val); if (errorMsg) setErrorMsg(null); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.emailInput,
                {
                  backgroundColor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.08)',
                  color: isLight ? '#0F172A' : '#FFFFFF',
                  borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
                }
              ]}
            />

            <TouchableOpacity
              onPress={handleSendOTP}
              style={[styles.authBtn, { backgroundColor: isLight ? '#0F172A' : '#FFFFFF', borderColor: isLight ? '#0F172A' : '#FFFFFF' }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={isLight ? '#FFFFFF' : '#0F172A'} />
              ) : (
                <Text style={[styles.authBtnText, { color: isLight ? '#FFFFFF' : '#0F172A' }]}>Continue with Email</Text>
              )}
            </TouchableOpacity>

            <View style={styles.dividerRow}>
              <View style={[styles.line, { backgroundColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)' }]} />
              <Text style={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: 12 }}>or social sign in</Text>
              <View style={[styles.line, { backgroundColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)' }]} />
            </View>

            <TouchableOpacity
              style={[styles.authBtn, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.05)', borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.2)', opacity: 0.5 }]}
              disabled
            >
              <Text style={styles.authIcon}>🌐</Text>
              <Text style={[styles.authBtnText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.authBtn, { backgroundColor: isLight ? '#FFFFFF' : 'rgba(255,255,255,0.05)', borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.2)', opacity: 0.5 }]}
              disabled
            >
              <Text style={[styles.authIcon, { color: isLight ? '#0F172A' : '#FFFFFF' }]}></Text>
              <Text style={[styles.authBtnText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>Continue with Apple</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ color: isLight ? '#475569' : '#94A3B8', fontSize: 14, textAlign: 'center' }}>
              Enter the 6-digit code sent to{' '}
              <Text style={{ fontWeight: '700', color: isLight ? '#0F172A' : '#FFFFFF' }}>{email}</Text>
            </Text>

            <TextInput
              placeholder="000000"
              placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
              value={otp}
              onChangeText={(val) => { setOtp(val.replace(/[^0-9]/g, '').slice(0, 6)); if (errorMsg) setErrorMsg(null); }}
              keyboardType="number-pad"
              maxLength={6}
              textAlign="center"
              style={[
                styles.emailInput,
                {
                  backgroundColor: isLight ? '#F1F5F9' : 'rgba(255,255,255,0.08)',
                  color: isLight ? '#0F172A' : '#FFFFFF',
                  borderColor: isLight ? '#CBD5E1' : 'rgba(255,255,255,0.2)',
                  fontSize: 28,
                  letterSpacing: 12,
                  fontWeight: '700'
                }
              ]}
            />

            <TouchableOpacity
              onPress={handleVerifyOTP}
              style={[styles.authBtn, { backgroundColor: isLight ? '#0F172A' : '#FFFFFF', borderColor: isLight ? '#0F172A' : '#FFFFFF' }]}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={isLight ? '#FFFFFF' : '#0F172A'} />
              ) : (
                <Text style={[styles.authBtnText, { color: isLight ? '#FFFFFF' : '#0F172A' }]}>Verify Code</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSendOTP} disabled={loading} style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Text style={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: 13 }}>
                Didn't receive it?{' '}
                <Text style={{ fontWeight: '700', color: isLight ? '#0F172A' : '#FFFFFF' }}>Resend code</Text>
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24, paddingVertical: 20, justifyContent: 'space-between' },
  topBar: { alignItems: 'flex-end', paddingTop: 10 },
  skipPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  skipText: { fontSize: 13, fontWeight: '700' },
  content: { alignItems: 'center', marginVertical: 10 },
  title: { fontSize: 42, fontWeight: '900', textAlign: 'center', lineHeight: 46, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 10, maxWidth: 300, lineHeight: 22 },
  heroIllustration: {
    width: '100%',
    height: 180,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  mockupPhone: {
    width: 160,
    height: 160,
    borderRadius: 20,
    backgroundColor: '#0F172A',
    borderWidth: 2,
    borderColor: '#334155',
    padding: 12,
    alignItems: 'center'
  },
  mockupNotch: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#475569', marginBottom: 12 },
  mockupBrand: { color: '#CBD5E1', fontSize: 12, fontWeight: '800' },
  mockupBalance: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginVertical: 8, fontFamily: 'monospace' },
  mockupPills: { flexDirection: 'row', gap: 6, marginTop: 8 },
  mockupPill: { width: 36, height: 16, borderRadius: 8, backgroundColor: '#334155' },
  authSection: { gap: 12, paddingBottom: 20 },
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
  authIcon: { fontSize: 18 },
  authBtnText: { fontSize: 16, fontWeight: '700' },
  emailInput: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    paddingHorizontal: 20,
    fontSize: 15
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 4
  },
  line: {
    flex: 1,
    height: 1
  }
});
