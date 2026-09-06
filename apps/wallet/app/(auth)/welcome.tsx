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
  const loginWithPrivy = useAuthStore((s: AuthState) => s.loginWithPrivy);

  const [email, setEmail] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuthenticate = async (provider: string, userEmail?: string, name?: string) => {
    setErrorMsg(null);
    setLoadingProvider(provider);

    const targetEmail = (userEmail || email || `user_${provider.toLowerCase()}@kudi.app`).trim().toLowerCase();
    
    if (provider === 'Email' && (!targetEmail || !targetEmail.includes('@'))) {
      setErrorMsg('Please enter a valid email address');
      setLoadingProvider(null);
      return;
    }

    const privyUserId = `privy_usr_${provider.toLowerCase()}_${targetEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const fullName = name || targetEmail.split('@')[0] || `${provider} User`;

    console.log(`[Auth] Authenticating via ${provider} for ${targetEmail}...`);

    const res = await loginWithPrivy({
      privyUserId,
      email: targetEmail,
      name: fullName
    });

    setLoadingProvider(null);

    if (res && res.success) {
      console.log('[Auth] Authentication successful. Navigating to (tabs)...');
      router.replace('/(tabs)');
    } else {
      setErrorMsg(res.error || 'Authentication failed. Please check network connection.');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => handleAuthenticate('Demo', `demo_${Date.now()}@kudi.app`, 'Demo User')}
          style={[styles.skipPill, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
          disabled={!!loadingProvider}
        >
          <Text style={[Typography.bodyBold, { color: palette.text }]}>Skip Login</Text>
        </TouchableOpacity>
      </View>

      {/* Main Headline & Hero Graphic */}
      <View style={styles.content}>
        <Text style={[Typography.displayLarge, styles.title, { color: palette.text }]}>
          Money,{"\n"}forever yours
        </Text>
        <Text style={[Typography.body, styles.subtitle, { color: palette.textSecondary }]}>
          Deposit crypto. Spend instant Naira to any bank.
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

      {/* Auth Form Section */}
      <View style={styles.authSection}>
        {errorMsg && (
          <Text style={[Typography.caption, { color: '#EF4444', textAlign: 'center', marginBottom: 4 }]}>
            {errorMsg}
          </Text>
        )}

        <View style={{ gap: 12 }}>
          {/* Email Input */}
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
            style={[
              Typography.body,
              styles.emailInput,
              { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }
            ]}
          />

          {/* Continue with Email Button */}
          <TouchableOpacity
            onPress={() => handleAuthenticate('Email')}
            style={[styles.authBtn, { backgroundColor: palette.text, borderColor: palette.text }]}
            activeOpacity={0.8}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'Email' ? (
              <ActivityIndicator color={palette.bg} />
            ) : (
              <>
                <Ionicons name="mail-outline" size={18} color={palette.bg} />
                <Text style={[Typography.bodyBold, { color: palette.bg }]}>Continue with Email</Text>
                <Ionicons name="arrow-forward" size={18} color={palette.bg} />
              </>
            )}
          </TouchableOpacity>

          {/* Social Divider / Alternative Sign-in */}
          <View style={styles.dividerRow}>
            <View style={[styles.line, { backgroundColor: palette.border }]} />
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>or social sign in</Text>
            <View style={[styles.line, { backgroundColor: palette.border }]} />
          </View>

          {/* Continue with Google */}
          <TouchableOpacity
            onPress={() => handleAuthenticate('Google', email || `user_google_${Date.now()}@gmail.com`, 'Google User')}
            style={[styles.authBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
            activeOpacity={0.8}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'Google' ? (
              <ActivityIndicator color={palette.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={palette.text} />
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Continue with Apple */}
          <TouchableOpacity
            onPress={() => handleAuthenticate('Apple', email || `user_apple_${Date.now()}@icloud.com`, 'Apple User')}
            style={[styles.authBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
            activeOpacity={0.8}
            disabled={!!loadingProvider}
          >
            {loadingProvider === 'Apple' ? (
              <ActivityIndicator color={palette.text} />
            ) : (
              <>
                <Ionicons name="logo-apple" size={20} color={palette.text} />
                <Text style={[Typography.bodyBold, { color: palette.text }]}>Continue with Apple</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24, paddingVertical: 20, justifyContent: 'space-between' },
  topBar: { alignItems: 'flex-end', paddingTop: 16 },
  skipPill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  content: { alignItems: 'center', marginVertical: 10 },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginTop: 10, maxWidth: 300 },
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
  emailInput: {
    height: 54,
    borderRadius: 27,
    borderWidth: 1,
    paddingHorizontal: 20
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
