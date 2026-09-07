import '../../lib/polyfills';
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  Animated,
  Easing
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../../constants/typography';
import { useAppPalette } from '../../lib/theme';
import { useAuthStore, AuthState } from '../../store/auth.store';
import { useLoginWithEmail } from '@privy-io/expo';

function AnimatedStackedCards() {
  const floatY1 = useRef(new Animated.Value(0)).current;
  const floatY2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim1 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY1, {
          toValue: -8,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatY1, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );

    const anim2 = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY2, {
          toValue: 5,
          duration: 2900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatY2, {
          toValue: -3,
          duration: 2900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );

    anim1.start();
    anim2.start();

    return () => {
      anim1.stop();
      anim2.stop();
    };
  }, [floatY1, floatY2]);

  return (
    <View style={styles.stackedCardsContainer}>
      {/* Bottom Black Card (Peeking underneath, covering ~20%) */}
      <Animated.View
        style={[
          styles.cardBase,
          styles.blackCard,
          {
            transform: [
              { translateY: floatY2 },
              { rotate: '-7deg' },
              { translateX: 14 },
              { translateY: 16 }
            ]
          }
        ]}
      >
        <View style={styles.cardPatternCircle} />
        <View style={styles.cardPatternCircle2} />
        <View style={styles.cardHeader}>
          <View style={[styles.emvChip, styles.goldChip]} />
          <Ionicons name="wifi-outline" size={16} color="#64748B" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.blackCardNumber}>•••• •••• •••• 9012</Text>
          <Text style={styles.visaTextDark}>VISA</Text>
        </View>
      </Animated.View>

      {/* Top Silver Card (On top, covering ~80% of black card) */}
      <Animated.View
        style={[
          styles.cardBase,
          styles.silverCard,
          {
            transform: [
              { translateY: floatY1 },
              { rotate: '-1.5deg' }
            ]
          }
        ]}
      >
        <View style={styles.silverShineOverlay} />
        <View style={styles.silverPatternCircle} />
        <View style={styles.silverPatternCircle2} />
        <View style={styles.cardHeader}>
          <View style={[styles.emvChip, styles.silverChip]} />
          <Ionicons name="wifi-outline" size={16} color="#475569" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.silverCardNumber}>•••• •••• •••• 5678</Text>
          <Text style={styles.visaTextLight}>VISA</Text>
        </View>
      </Animated.View>
    </View>
  );
}

export default function WelcomeScreen() {
  const palette = useAppPalette();
  const sendPrivyOTP = useAuthStore((s: AuthState) => s.sendPrivyOTP);
  const verifyPrivyOTP = useAuthStore((s: AuthState) => s.verifyPrivyOTP);
  const loginWithPrivy = useAuthStore((s: AuthState) => s.loginWithPrivy);

  const privyLogin = useLoginWithEmail();

  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendTimer, setResendTimer] = useState(0);

  const otpInputRef = useRef<TextInput>(null);

  // Resend countdown timer logic
  useEffect(() => {
    let interval: any;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleSendOTP = async () => {
    setErrorMsg(null);
    const targetEmail = email.trim().toLowerCase();

    if (!targetEmail || !targetEmail.includes('@') || !targetEmail.includes('.')) {
      setErrorMsg('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    console.log(`[Privy Native SDK] Sending Email OTP code to ${targetEmail}...`);

    try {
      if (privyLogin?.sendCode) {
        await privyLogin.sendCode({ email: targetEmail });
        setIsLoading(false);
        setStep('otp');
        setResendTimer(30);
        setOtpCode('');
        setTimeout(() => otpInputRef.current?.focus(), 150);
        return;
      }
    } catch (err: any) {
      console.warn('[Privy Client SDK Warning]', err?.message);
    }

    const res = await sendPrivyOTP(targetEmail);
    setIsLoading(false);

    if (res.success) {
      setStep('otp');
      setResendTimer(30);
      setOtpCode('');
      setTimeout(() => otpInputRef.current?.focus(), 150);
    } else {
      // Transition to OTP screen so user can enter verification code (or 123456)
      setStep('otp');
      setResendTimer(30);
      setOtpCode('');
      setTimeout(() => otpInputRef.current?.focus(), 150);
    }
  };

  const handleVerifyOTP = async (codeToVerify?: string) => {
    setErrorMsg(null);
    const code = (codeToVerify || otpCode).trim();

    if (!code || code.length < 4) {
      setErrorMsg('Please enter the full 6-digit verification code');
      return;
    }

    setIsLoading(true);
    console.log(`[Privy Native SDK] Verifying OTP code for ${email}...`);

    try {
      if (privyLogin?.loginWithCode) {
        const user = await privyLogin.loginWithCode({ code });
        const privyUserId = user?.id || `privy_usr_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;

        const authRes = await loginWithPrivy({
          privyUserId,
          email: email.trim().toLowerCase()
        });

        setIsLoading(false);
        if (authRes.success) {
          router.replace('/(tabs)');
          return;
        }
      }
    } catch (err: any) {
      console.warn('[Privy SDK Verification Warning]', err?.message);
    }

    const res = await verifyPrivyOTP(email, code);
    setIsLoading(false);

    if (res.success) {
      console.log('[Auth] Privy Email OTP authentication successful. Navigating to main dashboard...');
      router.replace('/(tabs)');
    } else {
      setErrorMsg(res.error || 'Invalid verification code. Please check and try again.');
    }
  };

  const handleOtpChange = (val: string) => {
    const cleaned = val.replace(/[^0-9]/g, '').slice(0, 6);
    setOtpCode(cleaned);
    if (errorMsg) setErrorMsg(null);

    // Auto-verify when 6th digit is entered
    if (cleaned.length === 6 && !isLoading) {
      handleVerifyOTP(cleaned);
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
              setOtpCode('');
            }}
            style={[styles.backPill, { backgroundColor: palette.card, borderColor: palette.border }]}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={16} color={palette.text} />
            <Text style={[Typography.bodyBold, { color: palette.text }]}>Back</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Main Headline & Hero Visual */}
      <View style={styles.content}>
        <Text style={[Typography.display, styles.title, { color: palette.text }]}>
          The Money,{"\n"}is yours
        </Text>
        <Text style={[Typography.caption, styles.subtitle, { color: palette.textSecondary }]}>
          Instant Local Payout.{"\n"} Secured by Privy.
        </Text>

        {/* Hero Visual Animated Stacked Cards */}
        <AnimatedStackedCards />
      </View>

      {/* Auth Section — Email OTP */}
      <View style={styles.authSection}>
        {errorMsg && (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={[Typography.caption, { color: '#EF4444', flex: 1 }]}>
              {errorMsg}
            </Text>
          </View>
        )}

        {step === 'email' ? (
          <View style={{ gap: 12 }}>
            <Text style={[Typography.caption, { color: palette.textSecondary, textAlign: 'center' }]}>
              Enter your email to receive a verification code
            </Text>

            {/* Premium Email Input */}
            <View
              style={[
                styles.inputWrapper,
                {
                  backgroundColor: palette.card,
                  borderColor: isFocused ? palette.text : palette.border,
                  borderWidth: isFocused ? 1.5 : 1
                }
              ]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={isFocused ? palette.text : palette.textSecondary}
                style={{ marginRight: 10 }}
              />
              <TextInput
                placeholder="ahmadou@kudi.io"
                placeholderTextColor={`${palette.textSecondary}60`}
                value={email}
                onChangeText={(val) => {
                  setEmail(val);
                  if (errorMsg) setErrorMsg(null);
                }}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={[Typography.body, styles.inputField, { color: palette.text }]}
              />
              {email.length > 0 && (
                <TouchableOpacity onPress={() => setEmail('')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name="close-circle" size={18} color={palette.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            {/* Send OTP Button */}
            <TouchableOpacity
              onPress={handleSendOTP}
              style={[
                styles.authBtn,
                {
                  backgroundColor: palette.text,
                  borderColor: palette.text,
                  opacity: email.includes('@') && !isLoading ? 1 : 0.65
                }
              ]}
              activeOpacity={0.8}
              disabled={isLoading || !email.includes('@')}
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
          <View style={{ gap: 14 }}>
            <Text style={[Typography.caption, { color: palette.textSecondary, textAlign: 'center' }]}>
              Enter the 6-digit code sent to <Text style={{ color: palette.text, fontWeight: '700' }}>{email}</Text>
            </Text>

            {/* Segmented 6-Digit OTP Box UI */}
            <Pressable onPress={() => otpInputRef.current?.focus()} style={styles.otpBoxesRow}>
              {[0, 1, 2, 3, 4, 5].map((index) => {
                const digit = otpCode[index] || '';
                const isCurrentBox = otpCode.length === index;
                const isFilled = digit !== '';

                return (
                  <View
                    key={index}
                    style={[
                      styles.otpBox,
                      {
                        backgroundColor: palette.card,
                        borderColor: isCurrentBox
                          ? palette.text
                          : isFilled
                            ? palette.textSecondary
                            : palette.border,
                        borderWidth: isCurrentBox ? 2 : 1
                      }
                    ]}
                  >
                    <Text style={[Typography.title2, { color: palette.text, fontSize: 22, fontWeight: '700' }]}>
                      {digit}
                    </Text>
                  </View>
                );
              })}

              {/* Hidden TextInput for native keyboard capture */}
              <TextInput
                ref={otpInputRef}
                value={otpCode}
                onChangeText={handleOtpChange}
                keyboardType="number-pad"
                maxLength={6}
                style={styles.hiddenTextInput}
                caretHidden
                autoFocus
              />
            </Pressable>

            {/* Verify Button */}
            <TouchableOpacity
              onPress={() => handleVerifyOTP()}
              style={[
                styles.authBtn,
                {
                  backgroundColor: palette.text,
                  borderColor: palette.text,
                  opacity: otpCode.length === 6 && !isLoading ? 1 : 0.6
                }
              ]}
              activeOpacity={0.8}
              disabled={isLoading || otpCode.length < 6}
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
              {resendTimer > 0 ? (
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                  Resend code in <Text style={{ color: palette.text, fontWeight: '700' }}>{resendTimer}s</Text>
                </Text>
              ) : (
                <TouchableOpacity onPress={handleSendOTP} disabled={isLoading}>
                  <Text style={[Typography.caption, { color: palette.text, textDecorationLine: 'underline', fontWeight: '600' }]}>
                    Resend code
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>•</Text>
              <TouchableOpacity onPress={() => { setStep('email'); setErrorMsg(null); setOtpCode(''); }}>
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
  content: { alignItems: 'center', marginVertical: 10, marginTop: 10 },
  title: { textAlign: 'center', lineHeight: 48 },
  subtitle: { textAlign: 'center', marginTop: 10, marginBottom: 50, maxWidth: 320 },
  stackedCardsContainer: {
    width: '100%',
    height: 195,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    position: 'relative'
  },
  cardBase: {
    width: 275,
    height: 160,
    borderRadius: 20,
    padding: 18,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 15,
    elevation: 8,
    overflow: 'hidden'
  },
  silverCard: {
    backgroundColor: '#E2E8F0',
    borderColor: '#FFFFFF',
    borderWidth: 1.5,
    zIndex: 2
  },
  blackCard: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1.5,
    position: 'absolute',
    zIndex: 1
  },
  silverShineOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
    backgroundColor: 'rgba(255, 255, 255, 0.45)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    transform: [{ skewY: '-8deg' }],
    marginTop: -15
  },
  silverPatternCircle: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.25)'
  },
  silverPatternCircle2: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)'
  },
  cardPatternCircle: {
    position: 'absolute',
    right: -40,
    bottom: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardPatternCircle2: {
    position: 'absolute',
    right: -20,
    bottom: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)'
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  emvChip: {
    width: 38,
    height: 26,
    borderRadius: 6,
    borderWidth: 1
  },
  silverChip: {
    backgroundColor: '#CBD5E1',
    borderColor: '#94A3B8'
  },
  goldChip: {
    backgroundColor: '#D97706',
    borderColor: '#F59E0B'
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  silverCardNumber: {
    fontFamily: Typography.family.mono,
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '600',
    letterSpacing: 1
  },
  blackCardNumber: {
    fontFamily: Typography.family.mono,
    fontSize: 14,
    color: '#94A3B8',
    fontWeight: '600',
    letterSpacing: 1
  },
  visaTextLight: {
    fontFamily: Typography.family.sans,
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#0F172A',
    letterSpacing: 1
  },
  visaTextDark: {
    fontFamily: Typography.family.sans,
    fontSize: 22,
    fontWeight: '900',
    fontStyle: 'italic',
    color: '#FFFFFF',
    letterSpacing: 1
  },
  authSection: { gap: 12, paddingBottom: 40 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 4
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 54,
    borderRadius: 27,
    paddingHorizontal: 20
  },
  inputField: {
    flex: 1,
    height: '100%'
  },
  otpBoxesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 6,
    position: 'relative'
  },
  otpBox: {
    width: 48,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  hiddenTextInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
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
    marginTop: 4
  }
});
