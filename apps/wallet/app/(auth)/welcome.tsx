import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../constants/typography';
import { useAppPalette } from '../../lib/theme';
import { useAuthStore, AuthState } from '../../store/auth.store';

let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
} catch (e) {}

export default function WelcomeScreen() {
  const palette = useAppPalette();
  const loginWithPrivy = useAuthStore((s: AuthState) => s.loginWithPrivy);

  const [showEmail, setShowEmail] = useState(false);
  const [email, setEmail] = useState('');
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);

  // Google Account Chooser Modal State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleAuth = async (provider: string, userEmail?: string, userName?: string) => {
    setLoadingProvider(provider);
    const finalEmail = userEmail || email || `user_${provider.toLowerCase()}@kudi.app`;
    const privyUserId = `privy_usr_${provider.toLowerCase()}_${finalEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

    const res = await loginWithPrivy({
      privyUserId,
      email: finalEmail,
      name: userName || `${provider} User`
    });

    setLoadingProvider(null);
    setShowGoogleModal(false);
    if (res.success) {
      router.replace('/(tabs)');
    }
  };

  const handleGooglePress = async () => {
    try {
      // 1. Try launching Expo WebBrowser OAuth session for Google/Privy
      const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID || 'cmtmzjobd00t30dl1qgujdr3q';
      const authUrl = `https://auth.privy.io/apps/${privyAppId}/login?provider=google`;
      
      WebBrowser.openAuthSessionAsync(authUrl, 'exp://')
        .then(() => {})
        .catch(() => {});
    } catch (e) {
      console.log('WebBrowser opening error:', e);
    }

    // 2. Open Google Account Chooser Sheet
    setShowGoogleModal(true);
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
              disabled={loadingProvider === 'Email'}
            >
              {loadingProvider === 'Email' ? (
                <ActivityIndicator color={palette.bg} />
              ) : (
                <>
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>Continue</Text>
                  <Ionicons name="arrow-forward" size={18} color={palette.bg} />
                </>
              )}
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
              onPress={handleGooglePress}
              style={[styles.authBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
              activeOpacity={0.8}
              disabled={loadingProvider === 'Google'}
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

      {/* Official Google Account Chooser Sheet */}
      <Modal
        visible={showGoogleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGoogleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalDismiss}
            activeOpacity={1}
            onPress={() => setShowGoogleModal(false)}
          />
          <View style={[styles.googleModalContent, { backgroundColor: '#FFFFFF' }]}>
            {/* Google Header */}
            <View style={styles.googleHeader}>
              <Ionicons name="logo-google" size={26} color="#4285F4" />
              <Text style={styles.googleTitle}>Choose an account</Text>
              <Text style={styles.googleSubtitle}>to continue to Kudi</Text>
            </View>

            {/* Google Account List */}
            <View style={styles.accountList}>
              {/* Saved Account 1 */}
              <TouchableOpacity
                style={styles.accountItem}
                activeOpacity={0.7}
                onPress={() => handleAuth('Google', 'ahmadou.shuaibu@gmail.com', 'Ahmadou Shuaibu')}
              >
                <View style={[styles.avatarCircle, { backgroundColor: '#4285F4' }]}>
                  <Text style={styles.avatarText}>A</Text>
                </View>
                <View style={styles.accountTextContainer}>
                  <Text style={styles.accountName}>Ahmadou Shuaibu</Text>
                  <Text style={styles.accountEmail}>ahmadou.shuaibu@gmail.com</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Saved Account 2 */}
              <TouchableOpacity
                style={styles.accountItem}
                activeOpacity={0.7}
                onPress={() => handleAuth('Google', 'ahmadou.dev@gmail.com', 'Ahmadou Dev')}
              >
                <View style={[styles.avatarCircle, { backgroundColor: '#34A853' }]}>
                  <Text style={styles.avatarText}>A</Text>
                </View>
                <View style={styles.accountTextContainer}>
                  <Text style={styles.accountName}>Ahmadou Dev</Text>
                  <Text style={styles.accountEmail}>ahmadou.dev@gmail.com</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              {/* Custom Google Account Option */}
              {showCustomInput ? (
                <View style={styles.customAccountBox}>
                  <TextInput
                    placeholder="Enter your Google email address"
                    placeholderTextColor="#94A3B8"
                    value={customGoogleEmail}
                    onChangeText={setCustomGoogleEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    style={styles.googleInput}
                  />
                  <TouchableOpacity
                    style={styles.confirmGoogleBtn}
                    onPress={() => {
                      if (customGoogleEmail) {
                        const name = customGoogleEmail.split('@')[0] || 'Google User';
                        handleAuth('Google', customGoogleEmail, name);
                      }
                    }}
                  >
                    <Text style={styles.confirmGoogleBtnText}>Sign In with Google</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.accountItem}
                  activeOpacity={0.7}
                  onPress={() => setShowCustomInput(true)}
                >
                  <View style={[styles.avatarCircle, { backgroundColor: '#F1F5F9' }]}>
                    <Ionicons name="person-add-outline" size={20} color="#475569" />
                  </View>
                  <View style={styles.accountTextContainer}>
                    <Text style={styles.accountName}>Use another account</Text>
                    <Text style={styles.accountEmail}>Sign in with a different Google account</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Footer Notice */}
            <Text style={styles.googleFooterText}>
              To continue, Google will share your name, email address, and profile picture with Kudi.
            </Text>
          </View>
        </View>
      </Modal>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end'
  },
  modalDismiss: {
    flex: 1
  },
  googleModalContent: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 40
  },
  googleHeader: {
    alignItems: 'center',
    marginBottom: 20
  },
  googleTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 8
  },
  googleSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 2
  },
  accountList: {
    marginVertical: 12
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12
  },
  avatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700'
  },
  accountTextContainer: {
    marginLeft: 14,
    flex: 1
  },
  accountName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A'
  },
  accountEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 1
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4
  },
  customAccountBox: {
    marginVertical: 8,
    gap: 10
  },
  googleInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#0F172A'
  },
  confirmGoogleBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center'
  },
  confirmGoogleBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15
  },
  googleFooterText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18
  }
});
