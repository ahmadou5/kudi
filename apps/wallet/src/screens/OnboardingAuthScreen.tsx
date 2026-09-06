import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator
} from 'react-native';
import { useAuthStore } from '../store/authStore';

interface OnboardingAuthScreenProps {
  mode?: 'light' | 'dark';
}

export const OnboardingAuthScreen: React.FC<OnboardingAuthScreenProps> = ({ mode = 'dark' }) => {
  const isLight = mode === 'light';
  const { login } = useAuthStore();

  const [email, setEmail] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuthenticate = (provider: string, userEmail?: string, name?: string) => {
    setErrorMsg(null);
    setLoadingProvider(provider);

    const targetEmail = (userEmail || email || `user_${provider.toLowerCase()}@kudi.app`).trim().toLowerCase();
    
    if (provider === 'Email' && (!targetEmail || !targetEmail.includes('@'))) {
      setErrorMsg('Please enter a valid email address');
      setLoadingProvider(null);
      return;
    }

    login({
      id: `usr_${Date.now()}`,
      email: targetEmail,
      fullName: name || targetEmail.split('@')[0] || `${provider} User`
    });

    setLoadingProvider(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F' }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => handleAuthenticate('Demo', `demo_${Date.now()}@kudi.app`, 'Demo User')}
          style={[
            styles.skipPill,
            {
              backgroundColor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.1)',
              borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
            }
          ]}
        >
          <Text style={[styles.skipText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
            Skip Login
          </Text>
        </TouchableOpacity>
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

        <View style={{ gap: 12 }}>
          <TextInput
            placeholder="Enter your email (e.g. name@example.com)"
            placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
            value={email}
            onChangeText={(val) => {
              setEmail(val);
              if (errorMsg) setErrorMsg(null);
            }}
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
            onPress={() => handleAuthenticate('Email')}
            style={[
              styles.authBtn,
              {
                backgroundColor: isLight ? '#0F172A' : '#FFFFFF',
                borderColor: isLight ? '#0F172A' : '#FFFFFF'
              }
            ]}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'Email' ? (
              <ActivityIndicator color={isLight ? '#FFFFFF' : '#0F172A'} />
            ) : (
              <Text style={[styles.authBtnText, { color: isLight ? '#FFFFFF' : '#0F172A' }]}>
                Continue with Email
              </Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)' }]} />
            <Text style={{ color: isLight ? '#64748B' : '#94A3B8', fontSize: 12 }}>or social sign in</Text>
            <View style={[styles.line, { backgroundColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)' }]} />
          </View>

          <TouchableOpacity
            onPress={() => handleAuthenticate('Google', email || `user_google_${Date.now()}@gmail.com`, 'Google User')}
            style={[
              styles.authBtn,
              {
                backgroundColor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
              }
            ]}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'Google' ? (
              <ActivityIndicator color={isLight ? '#0F172A' : '#FFFFFF'} />
            ) : (
              <>
                <Text style={styles.authIcon}>🌐</Text>
                <Text style={[styles.authBtnText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
                  Continue with Google
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleAuthenticate('Apple', email || `user_apple_${Date.now()}@icloud.com`, 'Apple User')}
            style={[
              styles.authBtn,
              {
                backgroundColor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
              }
            ]}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'Apple' ? (
              <ActivityIndicator color={isLight ? '#0F172A' : '#FFFFFF'} />
            ) : (
              <>
                <Text style={[styles.authIcon, { color: isLight ? '#0F172A' : '#FFFFFF' }]}></Text>
                <Text style={[styles.authBtnText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
                  Continue with Apple
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
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
