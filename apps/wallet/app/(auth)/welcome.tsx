import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../../lib/theme';
import { useAuthStore, AuthState } from '../../store/auth.store';
import { Typography } from '../../constants/typography';

export default function WelcomeScreen() {
  const palette = useAppPalette();
  const loginWithPrivy = useAuthStore((s: AuthState) => s.loginWithPrivy);

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  const handleAuth = async (provider: string) => {
    setLoadingProvider(provider);
    const privyUserId = `privy_usr_${provider.toLowerCase()}_${Date.now()}`;
    const userEmail = email || `user_${provider.toLowerCase()}@kudi.app`;

    const res = await loginWithPrivy({
      privyUserId,
      email: userEmail,
      name: `${provider} User`
    });

    setLoadingProvider(null);
    if (res.success) {
      router.replace('/(tabs)');
    }
  };

  const handleEmailAuth = async () => {
    if (!email) return;
    await handleAuth('Email');
  };


  return (
    <View style={[styles.screen, { backgroundColor: palette.bg }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => handleAuth('Demo')}
          style={[styles.skipPill, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
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

      {/* Auth Options */}
      <View style={styles.authSection}>
        {showEmail ? (
          <View style={{ gap: 10 }}>
            <TextInput
              placeholder="Enter your email address"
              placeholderTextColor={palette.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              style={[
                Typography.body,
                styles.emailInput,
                { backgroundColor: palette.card, color: palette.text, borderColor: palette.border }
              ]}
            />
            <TouchableOpacity
              onPress={handleEmailAuth}
              style={[styles.authBtn, { backgroundColor: palette.text, borderColor: palette.text }]}
              activeOpacity={0.8}
            >
              <Text style={[Typography.bodyBold, { color: palette.bg }]}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={palette.bg} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={() => handleAuth('Apple')}
              style={[styles.authBtn, { backgroundColor: palette.text, borderColor: palette.text }]}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={20} color={palette.bg} />
              <Text style={[Typography.bodyBold, { color: palette.bg }]}>Continue with Apple</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleAuth('Google')}
              style={[styles.authBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={18} color={palette.text} />
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Continue with Google</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowEmail(true)}
              style={[styles.authBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="mail-outline" size={18} color={palette.text} />
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Continue with Email</Text>
            </TouchableOpacity>
          </View>
        )}
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
  }
});
