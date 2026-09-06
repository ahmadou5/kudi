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
import { useAuthStore } from '../store/authStore';

let WebBrowser: any = null;
try {
  WebBrowser = require('expo-web-browser');
} catch (e) {}

interface OnboardingAuthScreenProps {
  mode?: 'light' | 'dark';
}

export const OnboardingAuthScreen: React.FC<OnboardingAuthScreenProps> = ({ mode = 'dark' }) => {
  const isLight = mode === 'light';
  const { login } = useAuthStore();

  const [showEmailInput, setShowEmailInput] = useState(false);
  const [email, setEmail] = useState('');

  // Google Account Chooser State
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSocialAuth = (provider: string, userEmail?: string, fullName?: string) => {
    setLoading(true);
    const chosenEmail = userEmail || email || `user_${provider.toLowerCase()}@kudi.app`;
    login({
      id: `usr_${Date.now()}`,
      email: chosenEmail,
      fullName: fullName || `${provider} User`
    });
    setLoading(false);
    setShowGoogleModal(false);
  };

  const handleGooglePress = async () => {
    try {
      const privyAppId = process.env.EXPO_PUBLIC_PRIVY_APP_ID || 'cmtmzjobd00t30dl1qgujdr3q';
      const authUrl = `https://auth.privy.io/apps/${privyAppId}/login?provider=google`;
      WebBrowser.openAuthSessionAsync(authUrl, 'exp://')
        .then(() => {})
        .catch(() => {});
    } catch (e) {
      console.log('WebBrowser error:', e);
    }
    setShowGoogleModal(true);
  };

  const handleEmailSubmit = () => {
    if (!email) return;
    handleSocialAuth('Email', email, email.split('@')[0] || 'Kudi User');
  };

  return (
    <View style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F' }]}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={() => handleSocialAuth('Demo')}
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

      {/* Privy Auth Buttons Section */}
      <View style={styles.authSection}>
        {showEmailInput ? (
          <View style={{ gap: 10 }}>
            <TextInput
              placeholder="Enter your email address"
              placeholderTextColor={isLight ? '#94A3B8' : '#64748B'}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
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
              onPress={handleEmailSubmit}
              style={[
                styles.authBtn,
                {
                  backgroundColor: isLight ? '#0F172A' : '#FFFFFF',
                  borderColor: isLight ? '#0F172A' : '#FFFFFF'
                }
              ]}
            >
              <Text style={[styles.authBtnText, { color: isLight ? '#FFFFFF' : '#0F172A' }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {/* Apple */}
            <TouchableOpacity
              onPress={() => handleSocialAuth('Apple')}
              style={[
                styles.authBtn,
                {
                  backgroundColor: isLight ? '#0F172A' : '#FFFFFF',
                  borderColor: isLight ? '#0F172A' : '#FFFFFF'
                }
              ]}
            >
              <Text style={[styles.authIcon, { color: isLight ? '#FFFFFF' : '#0F172A' }]}></Text>
              <Text style={[styles.authBtnText, { color: isLight ? '#FFFFFF' : '#0F172A' }]}>
                Continue with Apple
              </Text>
            </TouchableOpacity>

            {/* Google */}
            <TouchableOpacity
              onPress={handleGooglePress}
              style={[
                styles.authBtn,
                {
                  backgroundColor: isLight ? '#FFFFFF' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
                }
              ]}
            >
              <Text style={styles.authIcon}>🌐</Text>
              <Text style={[styles.authBtnText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
                Continue with Google
              </Text>
            </TouchableOpacity>

            {/* Email */}
            <TouchableOpacity
              onPress={() => setShowEmailInput(true)}
              style={[
                styles.authBtn,
                {
                  backgroundColor: isLight ? '#F1F5F9' : 'rgba(255, 255, 255, 0.05)',
                  borderColor: isLight ? '#CBD5E1' : 'rgba(255, 255, 255, 0.2)'
                }
              ]}
            >
              <Text style={styles.authIcon}>✉️</Text>
              <Text style={[styles.authBtnText, { color: isLight ? '#0F172A' : '#FFFFFF' }]}>
                Continue with Email
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Google Account Selection Sheet */}
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
            <View style={styles.googleHeader}>
              <Text style={{ fontSize: 24 }}>🌐</Text>
              <Text style={styles.googleTitle}>Choose an account</Text>
              <Text style={styles.googleSubtitle}>to continue to Kudi</Text>
            </View>

            <View style={styles.accountList}>
              <TouchableOpacity
                style={styles.accountItem}
                activeOpacity={0.7}
                onPress={() => handleSocialAuth('Google', 'ahmadou.shuaibu@gmail.com', 'Ahmadou Shuaibu')}
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

              <TouchableOpacity
                style={styles.accountItem}
                activeOpacity={0.7}
                onPress={() => handleSocialAuth('Google', 'ahmadou.dev@gmail.com', 'Ahmadou Dev')}
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
                        handleSocialAuth('Google', customGoogleEmail, customGoogleEmail.split('@')[0]);
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
                    <Text style={{ fontSize: 18 }}>➕</Text>
                  </View>
                  <View style={styles.accountTextContainer}>
                    <Text style={styles.accountName}>Use another account</Text>
                    <Text style={styles.accountEmail}>Sign in with a different Google account</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.googleFooterText}>
              To continue, Google will share your name, email address, and profile picture with Kudi.
            </Text>
          </View>
        </View>
      </Modal>
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
