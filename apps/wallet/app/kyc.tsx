import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { WebView } from 'react-native-webview';
import {
  AlertCircle,
  BadgeInfo,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Copy,
  CreditCard,
  RefreshCw,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react-native';

import { useAppPalette, hexToRgba, readableInk } from '../src/lib/theme';
import { Typography } from '../src/constants/typography';
import { Spacing } from '../src/constants/spacing';
import { useAuthStore } from '../src/store/auth.store';
import { useUserProfile } from '../src/hooks/useUserProfile';
import { sdk } from '../src/lib/sdk';
import { AppModal, useAppModal } from '../src/components/ui/AppModal';
import { AnimatedSkeleton } from '../src/components/ui/AnimatedSkeleton';
import { EnterSection } from '../src/lib/animations';

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const [firstName = '', ...rest] = parts;
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

type KycFlowPhase = 'intro' | 'webview' | 'polling';

type SessionStatusResponse = {
  status: 'none' | 'pending' | 'approved' | 'rejected' | 'abandoned';
  provider?: string;
  message?: string;
  name?: string | null;
  tier?: string;
  virtualAccount?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    provider: string;
  } | null;
  vaProvisioningFailed?: boolean;
  vaMessage?: string;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default function KYCScreen() {
  const palette = useAppPalette();
  const ink = readableInk(palette.primary);
  const inkSoft = hexToRgba(ink, 0.7);
  const inkFaint = hexToRgba(ink, 0.9);
  const inkPill = hexToRgba(ink, 0.2);
  const modal = useAppModal();
  const user = useAuthStore((s) => s.user);
  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();

  // Hosted verification flow state
  const [flowPhase, setFlowPhase] = useState<KycFlowPhase>('intro');
  const [sessionUrl, setSessionUrl] = useState<string | null>(null);
  const [sessionProvider, setSessionProvider] = useState<string | null>(null);
  const [webviewKey, setWebviewKey] = useState(0);
  const [webviewLoading, setWebviewLoading] = useState(true);
  const [webviewError, setWebviewError] = useState<string | null>(null);
  const [startingSession, setStartingSession] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkTimedOut, setCheckTimedOut] = useState(false);
  const [statusHint, setStatusHint] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const firstName = splitFullName(user?.fullName || '').firstName;
  const lastName = splitFullName(user?.fullName || '').lastName;

  // NIN Upgrade modal state (typed NIN fast-path for already-verified users)
  const [nin, setNin] = useState('');
  const [ninSubmitting, setNinSubmitting] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [forceEdit, setForceEdit] = useState(false);

  // Loop guards
  const pollCancelRef = useRef(false);
  const pollRunningRef = useRef(false);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => () => {
    pollCancelRef.current = true;
  }, []);

  // Prefer fresh profile data over the auth store — the store is only
  // refreshed at login, so after a successful verification it stays stale.
  const kycTier = profileData?.user?.kycTier || user?.kycTier || 'UNVERIFIED';
  const kycStatus = profileData?.user?.kycStatus || user?.kycStatus || 'NOT_STARTED';

  const kycComplete = kycTier === 'TIER_2' || kycStatus === 'VERIFIED';
  const verificationPending = (kycStatus === 'PENDING' || submitted) && !kycComplete && !forceEdit;
  const verificationRejected = kycStatus === 'REJECTED' || kycStatus === 'SUSPENDED';

  // Write freshly fetched KYC state back into the auth store so every screen
  // (limits, profile, settings) sees the upgrade without a re-login.
  const syncUserKyc = (kyc: { kycStatus?: string; kycTier?: string }) => {
    const current = useAuthStore.getState().user;
    if (!current) return;
    useAuthStore.setState({ user: { ...current, ...kyc } });
  };

  // Auto-polling when pending
  useEffect(() => {
    if (!verificationPending) return;
    const interval = setInterval(() => {
      void refetchProfile();
    }, 4000);
    return () => clearInterval(interval);
  }, [verificationPending, refetchProfile]);

  useEffect(() => {
    if (kycComplete || verificationRejected) {
      setSubmitted(false);
      setForceEdit(false);
    }
  }, [kycComplete, verificationRejected]);

  // Verified animation
  useEffect(() => {
    if (kycComplete) {
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [kycComplete, scaleAnim]);

  // Pending pulse loop
  useEffect(() => {
    if (verificationPending) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            easing: Easing.ease,
            useNativeDriver: true,
          }),
        ])
      );
      const rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      pulseLoop.start();
      rotateLoop.start();
      return () => {
        pulseLoop.stop();
        rotateLoop.stop();
      };
    }
  }, [verificationPending, pulseAnim, rotateAnim]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      modal.alert(`${label} Copied!`, `${text} has been copied to your clipboard.`, 'success');
    } catch {
      modal.alert(label, text, 'info');
    }
  };

  const providerLabel = (provider?: string | null) =>
    provider === 'SUMSUB' ? 'Sumsub' : provider === 'DOJAH' ? 'Dojah' : null;

  async function finalizeApproved(data: SessionStatusResponse) {
    syncUserKyc({ kycStatus: 'VERIFIED', kycTier: data.tier || 'TIER_2' });
    setSubmitted(false);
    setSessionUrl(null);
    setFlowPhase('intro');
    await refetchProfile();
    const label = providerLabel(data.provider);
    const accountPart = data.virtualAccount
      ? 'Your Tier 2 limits and dedicated NGN account are now active.'
      : 'Your dedicated NGN account is being provisioned and will appear in a moment.';
    modal.show({
      title: 'Verification Complete! 🎉',
      description: `${label ? `Your identity has been verified via ${label}. ` : 'Your identity has been verified. '}${accountPart}`,
      type: 'success',
      primaryText: 'View Account',
      onPrimaryPress: () => {
        modal.hide();
      },
    });
  }

  /**
   * Polls the backend until it confirms the hosted-flow result with the
   * provider. The provider decides — the app only waits and reacts.
   */
  async function runPollingLoop(maxAttempts = 10, delayMs = 2500) {
    if (pollRunningRef.current) return;
    pollRunningRef.current = true;
    pollCancelRef.current = false;
    setChecking(true);
    setCheckTimedOut(false);
    try {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (pollCancelRef.current) return;
        try {
          const res = await sdk.getKycSessionStatus();
          if (pollCancelRef.current) return;
          if (res?.success && res.data) {
            const data = res.data as SessionStatusResponse;
            if (data.status === 'approved') {
              await finalizeApproved(data);
              return;
            }
            if (data.status === 'rejected') {
              setFlowPhase('intro');
              modal.alert('Verification Failed', data.message || 'Your identity could not be verified. Please try again.', 'error');
              return;
            }
            if (data.status === 'abandoned') {
              setFlowPhase('intro');
              modal.alert('Verification Exited', data.message || 'You left the verification before finishing. Start again when you are ready.', 'info');
              return;
            }
            if (data.status === 'none') {
              setFlowPhase('intro');
              return;
            }
            setStatusHint(data.message || null);
          }
        } catch {
          // transient network/API error — keep polling
        }
        await sleep(delayMs);
      }
      if (!pollCancelRef.current) {
        setCheckTimedOut(true);
        setFlowPhase('polling');
      }
    } finally {
      pollRunningRef.current = false;
      if (!pollCancelRef.current) setChecking(false);
    }
  }

  const startVerification = async () => {
    if (!consent) {
      modal.alert('Consent required', 'Please tick the consent box to start verification.', 'warning');
      return;
    }
    setStartingSession(true);
    setWebviewError(null);
    setCheckTimedOut(false);
    setStatusHint(null);
    try {
      const res = await sdk.startKycSession({
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        email: profileData?.user?.email || user?.email || undefined,
        phone: profileData?.user?.phoneNumber || undefined,
      });
      const data = res?.data as { provider?: string; url?: string | null } | undefined;
      if (!res?.success || !data) {
        modal.alert(
          'Could not start verification',
          res?.error?.message || res?.message || 'Please try again in a moment.',
          'error'
        );
        return;
      }
      setSessionProvider(data.provider || null);
      if (data.url) {
        setSessionUrl(data.url);
        setWebviewKey((k) => k + 1);
        setWebviewLoading(true);
        setFlowPhase('webview');
      } else {
        setFlowPhase('polling');
        void runPollingLoop();
      }
    } catch (err: any) {
      modal.alert('Connection Error', err?.message || 'Failed to start verification.', 'error');
    } finally {
      setStartingSession(false);
    }
  };

  const closeWebviewToPolling = () => {
    setFlowPhase('polling');
    void runPollingLoop(8, 2000);
  };

  const handleWebviewMessage = (event: any) => {
    try {
      const msg = JSON.parse(event?.nativeEvent?.data ?? 'null');
      if (!msg?.type) return;
      if (msg.type === 'approved' || msg.type === 'declined' || msg.type === 'error') {
        if (typeof msg.message === 'string' && msg.message) setStatusHint(msg.message);
        // Backend confirmation is the source of truth — close and poll.
        closeWebviewToPolling();
      }
    } catch {
      // non-JSON messages are ignored
    }
  };

  // While the WebView is open, quietly confirm with the backend so hosted
  // flows that report out-of-band (Dojah) auto-complete without extra taps.
  useEffect(() => {
    if (flowPhase !== 'webview') return;
    let cancelled = false;
    const check = async () => {
      try {
        const res = await sdk.getKycSessionStatus();
        if (cancelled || flowPhase !== 'webview' || !res?.success || !res.data) return;
        const data = res.data as SessionStatusResponse;
        if (data.status === 'approved') {
          setFlowPhase('polling');
          await finalizeApproved(data);
        } else if (data.status === 'rejected') {
          setFlowPhase('intro');
          modal.alert('Verification Failed', data.message || 'Your identity could not be verified.', 'error');
        } else if (data.status === 'abandoned') {
          setFlowPhase('intro');
          modal.alert('Verification Exited', data.message || 'The verification was exited before completion.', 'info');
        }
      } catch {
        // ignore — the explicit polling loop handles hard failures
      }
    };
    const first = setTimeout(() => void check(), 4000);
    const interval = setInterval(() => void check(), 6000);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flowPhase]);

  // Resume an in-flight session (e.g. app was reopened mid-verification).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await sdk.getKycSessionStatus();
        if (cancelled || !res?.success || !res.data) return;
        const data = res.data as SessionStatusResponse;
        if (data.status === 'approved') {
          await finalizeApproved(data);
        } else if (data.status === 'pending') {
          setSessionProvider(data.provider || null);
          setFlowPhase('polling');
          void runPollingLoop();
        }
      } catch {
        // no session / network issue — normal intro screen
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Spinner rotation while the hosted screen loads / result polling runs
  // (the pending view has its own loop for the same value).
  useEffect(() => {
    if (flowPhase !== 'webview' && !checking) return;
    const rotateLoop = Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    rotateLoop.start();
    return () => rotateLoop.stop();
  }, [flowPhase, checking, rotateAnim]);

  const handleNinUpgrade = async () => {
    if (!/^\d{11}$/.test(nin.trim())) {
      modal.alert('Invalid NIN', 'Please enter a valid 11-digit NIN number.', 'warning');
      return;
    }

    setNinSubmitting(true);
    try {
      const parsed = user?.fullName ? splitFullName(user.fullName) : { firstName: '', lastName: '' };
      const res = await sdk.verifyKYCID({
        userId: user?.id || '',
        idNumber: nin.trim(),
        idType: 'NIN',
        firstName: firstName || parsed.firstName || 'User',
        lastName: lastName || parsed.lastName,
        dob: '',
      });

      setNinSubmitting(false);
      if (res && res.success) {
        syncUserKyc({ kycStatus: 'VERIFIED', kycTier: res.data?.tier || 'TIER_2' });
        setUpgradeModalVisible(false);
        setNin('');
        await refetchProfile();
        const ninProvider = res.data?.provider === 'SUMSUB' ? 'Sumsub' : res.data?.provider === 'DOJAH' ? 'Dojah' : null;
        modal.alert(
          'NIN Verified! 🚀',
          ninProvider
            ? `Your NIN was verified via ${ninProvider}. Your account has been upgraded to Tier 2 with a ₦5,000,000 daily transfer limit!`
            : 'Your account has been upgraded to Tier 2 with a ₦5,000,000 daily transfer limit!',
          'success'
        );
      } else {
        modal.alert('NIN Upgrade Failed', res?.error?.message || 'Could not verify NIN.', 'error');
      }
    } catch (err: any) {
      setNinSubmitting(false);
      modal.alert('Error', err?.message || 'Failed to submit NIN verification.', 'error');
    }
  };

  if (profileLoading) {
    return <KycSkeleton palette={palette} />;
  }

  // 1. VERIFIED STATE VIEW
  if (kycComplete) {
    const virtualAcc = profileData?.virtualAccounts?.[0];

    const isTier2 = kycTier === 'TIER_2' || kycComplete;
    const tierLabel = isTier2 ? 'Tier 2' : 'Tier 1';
    const tierLimit = isTier2 ? '₦5,000,000' : '₦50,000';
    const tierColor = isTier2 ? palette.success : palette.primary;

    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: palette.bg }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>KYC Verification</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Verified Badge Card */}
        <Animated.View style={[styles.verifiedCard, { backgroundColor: palette.card, borderColor: palette.border, transform: [{ scale: scaleAnim }] }]}>
          <View style={[styles.verifiedBadgeGlow, { backgroundColor: 'rgba(48,209,88,0.14)', borderColor: palette.success }]}>
            <ShieldCheck size={48} color={palette.success} />
          </View>
          <Text style={[styles.verifiedTitle, { color: palette.text }]}>Identity Verified</Text>
          <Text style={[styles.verifiedSub, { color: palette.textSecondary }]}>
            Your dedicated virtual bank account is fully active for instant NGN deposits and transfers.
          </Text>

          {/* Tier Status Badge */}
          <View style={[styles.tierBadgeRow, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.tierBadgeLabel, { color: palette.textSecondary }]}>Current Tier</Text>
              <Text style={[styles.tierBadgeValue, { color: palette.text }]}>{tierLabel} — {tierLimit} daily limit</Text>
            </View>
            <View style={[styles.tierBadgePill, { backgroundColor: hexToRgba(tierColor, 0.16), borderColor: tierColor }]}>
              <Text style={[styles.tierBadgePillText, { color: tierColor }]}>{tierLabel}</Text>
            </View>
          </View>

          {/* NUBAN Account Card */}
          {virtualAcc ? (
            <View style={[styles.nubanCard, { backgroundColor: palette.primary, borderColor: palette.primary }]}>
              <View style={styles.nubanCardHeader}>
                <Text style={styles.nubanProviderLabel}>{virtualAcc.bankName}</Text>
                <View style={styles.activePill}>
                  <Text style={styles.activePillText}>ACTIVE</Text>
                </View>
              </View>
              <View style={styles.nubanBody}>
                <Text style={styles.nubanLabel}>ACCOUNT NUMBER</Text>
                <View style={styles.nubanRow}>
                  <Text style={styles.nubanNumber}>{virtualAcc.accountNumber}</Text>
                  <Pressable onPress={() => copyToClipboard(virtualAcc.accountNumber, 'Account Number')} style={styles.copyBtn}>
                    <Copy size={18} color="#FFFFFF" />
                  </Pressable>
                </View>
                <Text style={styles.accountNameLabel}>Beneficiary: {virtualAcc.accountName || user?.fullName || 'Kudi User'}</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.nubanCard, { backgroundColor: palette.card, borderColor: palette.border, borderStyle: 'dashed' }]}>
              <Text style={[styles.verifiedSub, { color: palette.textSecondary }]}>
                Your dedicated account number is being provisioned. It will appear here automatically.
              </Text>
              <Pressable
                onPress={() => void refetchProfile()}
                style={({ pressed }) => [styles.secondaryAction, { backgroundColor: palette.bg, borderColor: palette.border }, pressed && { opacity: 0.85 }]}
              >
                <Text style={[styles.secondaryActionText, { color: palette.text }]}>Refresh</Text>
              </Pressable>
            </View>
          )}

          {/* Action buttons */}
          {!isTier2 && (
            <Pressable
              onPress={() => setUpgradeModalVisible(true)}
              style={({ pressed }) => [
                styles.primaryAction,
                { width: '100%', backgroundColor: palette.primary },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Zap size={18} color="#FFF" />
              <Text style={styles.primaryActionText}>Upgrade to Tier 2 (₦5,000,000/day)</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.secondaryAction,
              { width: '100%', backgroundColor: palette.bg, borderColor: palette.border },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={[styles.secondaryActionText, { color: palette.text }]}>Back to Settings</Text>
          </Pressable>
        </Animated.View>

        {/* Upgrade Bottom Sheet Modal */}
        {!isTier2 && (
          <Modal
            visible={upgradeModalVisible}
            transparent
            animationType="slide"
            onRequestClose={() => setUpgradeModalVisible(false)}
          >
            <View style={styles.bottomSheetBackdrop}>
              <Pressable style={StyleSheet.absoluteFill} onPress={() => setUpgradeModalVisible(false)} />
              <View style={[styles.bottomSheetContainer, { backgroundColor: palette.card, borderColor: palette.border }]}>
                <View style={styles.dragHandle} />

                <View style={styles.sheetHeaderRow}>
                  <View style={[styles.upgradeIconWrap, { backgroundColor: hexToRgba(palette.primary, 0.14) }]}>
                    <Zap size={22} color={palette.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.upgradeTitle, { color: palette.text }]}>Upgrade to Tier 2</Text>
                    <Text style={[styles.upgradeSub, { color: palette.textSecondary }]}>
                      Submit your 11-digit NIN to unlock a daily limit of ₦5,000,000.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setUpgradeModalVisible(false)}
                    style={[styles.closeIconButton, { backgroundColor: palette.bg, borderColor: palette.border }]}
                  >
                    <X size={16} color={palette.text} />
                  </Pressable>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={[Typography.caption, { color: palette.textSecondary }]}>National Identity Number (NIN)</Text>
                  <TextInput
                    value={nin}
                    onChangeText={setNin}
                    placeholder="Enter 11-digit NIN"
                    placeholderTextColor={palette.textSecondary}
                    keyboardType="number-pad"
                    maxLength={11}
                    style={[styles.input, { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }]}
                  />
                  <Text style={[Typography.caption, { color: palette.textSecondary }]}>Found on your National ID slip or dial *346#.</Text>
                </View>

                <Pressable
                  onPress={handleNinUpgrade}
                  disabled={ninSubmitting || nin.trim().length !== 11}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    {
                      width: '100%',
                      backgroundColor: nin.trim().length === 11 ? palette.primary : palette.border,
                      marginTop: 6,
                    },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={styles.primaryActionText}>{ninSubmitting ? 'Verifying NIN…' : 'Verify & Upgrade'}</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}

        <AppModal config={modal.config} onClose={modal.hide} />
      </ScrollView>
    );
  }

  // 2. PENDING VERIFICATION STATE VIEW
  if (verificationPending) {
    return (
      <ScrollView
        style={[styles.screen, { backgroundColor: palette.bg }]}
        contentContainerStyle={{ flexGrow: 1, padding: Spacing.lg, paddingBottom: Spacing.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Verification Pending</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={[styles.verifiedCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Animated.View
              style={[
                styles.pendingBadgeWrap,
                { backgroundColor: hexToRgba(palette.warning, 0.12), borderColor: palette.warning, transform: [{ scale: pulseAnim }] },
              ]}
            >
              <BadgeInfo size={44} color={palette.warning} />
            </Animated.View>

            <Text style={[styles.verifiedTitle, { color: palette.text }]}>Verification in Progress</Text>
            <Text style={[styles.verifiedSub, { color: palette.textSecondary }]}>
              Our partner is validating your BVN and bank account details. Your dedicated NUBAN will be assigned automatically once complete.
            </Text>

            <Pressable
              onPress={async () => {
                const res = await refetchProfile();
                const fresh = res.data?.user;
                if (fresh?.kycStatus === 'VERIFIED' || fresh?.kycTier === 'TIER_1' || fresh?.kycTier === 'TIER_2') {
                  syncUserKyc({ kycStatus: fresh.kycStatus, kycTier: fresh.kycTier });
                  modal.alert('Verification Complete!', 'Your identity has been verified successfully.', 'success');
                } else {
                  modal.alert('Verification Pending', 'Your details are still being processed. Please check back shortly.', 'info');
                }
              }}
              style={({ pressed }) => [styles.primaryAction, { width: '100%', backgroundColor: palette.primary, marginBottom: 8 }, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.primaryActionText}>Check Verification Status</Text>
            </Pressable>

            <Pressable
              onPress={() => {
                setForceEdit(true);
                setSubmitted(false);
                setFlowPhase('intro');
              }}
              style={({ pressed }) => [styles.secondaryAction, { width: '100%', backgroundColor: palette.bg, borderColor: palette.border, marginBottom: 8 }, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.secondaryActionText, { color: palette.text }]}>Start New Verification</Text>
            </Pressable>

            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [styles.secondaryAction, { width: '100%', backgroundColor: palette.bg, borderColor: palette.border }, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.secondaryActionText, { color: palette.text }]}>Back to Settings</Text>
            </Pressable>
          </View>
        </View>

        <AppModal config={modal.config} onClose={modal.hide} />
      </ScrollView>
    );
  }

  // 3. HOSTED VERIFICATION FLOW — intro/consent -> provider WebView -> polling

  // --- Result confirmation (server-side check with the provider) ---
  if (flowPhase === 'polling') {
    return (
      <View
        style={[
          styles.screen,
          { backgroundColor: palette.bg, paddingHorizontal: Spacing.lg, paddingTop: 48, paddingBottom: 40 },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.border }]}
            onPress={() => {
              pollCancelRef.current = true;
              setFlowPhase('intro');
            }}
          >
            <ArrowLeft size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Confirming Result</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={[styles.verifiedCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Animated.View
              style={[
                styles.pendingBadgeWrap,
                {
                  backgroundColor: hexToRgba(palette.primary, 0.12),
                  borderColor: palette.primary,
                  transform: [
                    { rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) },
                  ],
                },
              ]}
            >
              <RefreshCw size={40} color={palette.primary} />
            </Animated.View>

            <Text style={[styles.verifiedTitle, { color: palette.text }]}>
              {checkTimedOut ? 'Still Processing' : 'Confirming your verification\u2026'}
            </Text>
            <Text style={[styles.verifiedSub, { color: palette.textSecondary }]}>
              {statusHint ||
                (checkTimedOut
                  ? 'The provider has not returned a final decision yet. Check again — most results land within a minute.'
                  : 'Checking securely with the verification provider. This only takes a few seconds.')}
            </Text>

            {checkTimedOut ? (
              <View style={{ width: '100%', gap: 8 }}>
                <Pressable
                  onPress={() => void runPollingLoop(10, 2500)}
                  disabled={checking}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    { backgroundColor: checking ? palette.border : palette.primary },
                    pressed && !checking ? { opacity: 0.9 } : null,
                  ]}
                >
                  <Text style={styles.primaryActionText}>{checking ? 'Checking\u2026' : 'Check Again'}</Text>
                </Pressable>
                <Pressable
                  onPress={() => void startVerification()}
                  disabled={startingSession}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    { backgroundColor: palette.bg, borderColor: palette.border },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.secondaryActionText, { color: palette.text }]}>
                    {startingSession ? 'Restarting\u2026' : 'Restart Verification'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    pollCancelRef.current = true;
                    setFlowPhase('intro');
                  }}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    { backgroundColor: palette.bg, borderColor: palette.border },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.secondaryActionText, { color: palette.text }]}>Not Now</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => {
                  pollCancelRef.current = true;
                  setFlowPhase('intro');
                }}
                style={({ pressed }) => [
                  styles.secondaryAction,
                  { width: '100%', backgroundColor: palette.bg, borderColor: palette.border },
                  pressed && { opacity: 0.85 },
                ]}
              >
                <Text style={[styles.secondaryActionText, { color: palette.text }]}>Cancel</Text>
              </Pressable>
            )}
          </View>
        </View>

        <AppModal config={modal.config} onClose={modal.hide} />
      </View>
    );
  }

  // --- Intro / consent screen (opens the provider-hosted flow) ---
  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable
          style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={() => router.back()}
        >
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Identity Verification</Text>
        <View style={styles.headerSpacer} />
      </View>

      {verificationRejected && (
        <View style={[styles.errorCard, { backgroundColor: hexToRgba(palette.error, 0.12), borderColor: palette.error }]}>
          <AlertCircle size={20} color={palette.error} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.errorTitle, { color: palette.error }]}>Verification Attempt Failed</Text>
            <Text style={[styles.errorSub, { color: palette.text }]}>
              Your previous attempt did not pass. Double-check your details in the secure screen and try again.
            </Text>
          </View>
        </View>
      )}

      {/* Hero Banner */}
      <EnterSection index={0}>
        <View style={[styles.hero, { backgroundColor: palette.primary }]}>
          <View style={styles.heroTop}>
            <View>
              <Text style={[styles.heroLabel, { color: inkSoft }]}>IDENTITY CHECK</Text>
              <Text style={[styles.heroValue, { color: ink }]}>One secure step</Text>
            </View>
            <View style={[styles.heroIcon, { backgroundColor: hexToRgba(ink, 0.18) }]}>
              <ShieldCheck size={24} color={ink} />
            </View>
          </View>
          <Text style={[styles.heroBody, { color: inkFaint }]}>
            Verify yourself inside a secure screen hosted by our verification partner. Once approved, your dedicated NGN
            account and higher daily limits activate automatically.
          </Text>
        </View>
      </EnterSection>

      {/* What to expect + consent + start */}
      <EnterSection index={1}>
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepPill, { backgroundColor: hexToRgba(palette.primary, 0.12), borderColor: palette.primary }]}>
              <Camera size={16} color={palette.primary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>How it works</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                You will continue in a secure screen managed by the verification provider (Dojah or Sumsub).
              </Text>
            </View>
          </View>

          {[
            {
              Icon: CreditCard,
              title: 'BVN or NIN database check',
              body: 'Your identity is matched against the national registry — no paperwork, no branch visit.',
            },
            {
              Icon: Camera,
              title: 'Selfie & liveness check',
              body: 'A quick face scan confirms you are really you.',
            },
            {
              Icon: Zap,
              title: 'Done in about 2 minutes',
              body: 'Most decisions are instant, and your dedicated NGN account activates right after.',
            },
          ].map(({ Icon, title, body }) => (
            <View key={title} style={styles.expectRow}>
              <View
                style={[
                  styles.expectIcon,
                  { backgroundColor: hexToRgba(palette.primary, 0.12), borderColor: hexToRgba(palette.primary, 0.3) },
                ]}
              >
                <Icon size={18} color={palette.primary} />
              </View>
              <View style={styles.expectCopy}>
                <Text style={[styles.expectTitle, { color: palette.text }]}>{title}</Text>
                <Text style={[styles.expectBody, { color: palette.textSecondary }]}>{body}</Text>
              </View>
            </View>
          ))}

          {/* Consent Checkbox */}
          <Pressable
            onPress={() => setConsent((c) => !c)}
            style={[
              styles.consentRow,
              {
                borderColor: consent ? palette.primary : palette.border,
                backgroundColor: consent ? hexToRgba(palette.primary, 0.08) : palette.bg,
              },
            ]}
          >
            <View
              style={[
                styles.checkbox,
                {
                  borderColor: consent ? palette.primary : palette.border,
                  backgroundColor: consent ? palette.primary : 'transparent',
                },
              ]}
            >
              {consent ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <View style={styles.consentCopy}>
              <Text style={[styles.consentTitle, { color: palette.text }]}>I consent to identity verification</Text>
              <Text style={[styles.consentBody, { color: palette.textSecondary }]}>
                I authorize Kudi and its verification partner to process my identity data (BVN/NIN details and selfie) to
                verify me and issue a dedicated account in my name.
              </Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => void startVerification()}
            disabled={!consent || startingSession}
            style={({ pressed }) => [
              styles.primaryAction,
              { backgroundColor: consent && !startingSession ? palette.primary : palette.border },
              pressed && consent && !startingSession ? { opacity: 0.9 } : null,
            ]}
          >
            {startingSession ? <RefreshCw size={18} color="#FFF" /> : <ShieldCheck size={18} color="#FFF" />}
            <Text style={styles.primaryActionText}>
              {startingSession ? 'Opening secure screen\u2026' : 'Start Verification'}
            </Text>
          </Pressable>

          <Text style={[styles.smallPrint, { color: palette.textSecondary }]}>
            Your data is shared only with the provider running this check and is never sold. You can retry anytime if a
            check does not pass.
          </Text>
        </View>
      </EnterSection>

      {/* Global App Modal */}
      <AppModal config={modal.config} onClose={modal.hide} />

      {/* Provider-hosted verification WebView */}
      <Modal
        visible={flowPhase === 'webview'}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeWebviewToPolling}
      >
        <View style={[styles.webviewRoot, { backgroundColor: palette.bg }]}>
          <View style={[styles.webviewHeader, { backgroundColor: palette.card, borderBottomColor: palette.border }]}>
            <Pressable
              onPress={closeWebviewToPolling}
              style={[styles.closeIconButton, { backgroundColor: palette.bg, borderColor: palette.border }]}
            >
              <X size={16} color={palette.text} />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'center' }}>
              <Text style={[styles.webviewTitle, { color: palette.text }]}>
                {sessionProvider === 'SUMSUB' ? 'Sumsub' : 'Dojah'} Verification
              </Text>
              <Text style={[styles.webviewSubtitle, { color: palette.textSecondary }]}>Secure hosted screen</Text>
            </View>
            <View style={{ width: 32 }} />
          </View>

          <View style={{ flex: 1 }}>
            {sessionUrl ? (
              <WebView
                key={webviewKey}
                source={{ uri: sessionUrl }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                allowsInlineMediaPlayback
                mediaPlaybackRequiresUserAction={false}
                mediaCapturePermissionGrantType="grant"
                setSupportMultipleWindows={false}
                onLoadStart={() => {
                  setWebviewLoading(true);
                  setWebviewError(null);
                }}
                onLoadEnd={() => setWebviewLoading(false)}
                onError={(e) => setWebviewError(e.nativeEvent.description || 'The verification page failed to load.')}
                onHttpError={(e) =>
                  setWebviewError(`The verification page returned an error (${e.nativeEvent.statusCode}).`)
                }
                onMessage={handleWebviewMessage}
                style={{ backgroundColor: palette.bg }}
              />
            ) : null}

            {webviewLoading && !webviewError && sessionUrl ? (
              <View style={[styles.webviewOverlay, { backgroundColor: palette.bg }]}>
                <Animated.View
                  style={{
                    transform: [{ rotate: rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }],
                  }}
                >
                  <RefreshCw size={32} color={palette.primary} />
                </Animated.View>
                <Text style={[styles.webviewOverlayText, { color: palette.textSecondary }]}>
                  Opening secure verification…
                </Text>
              </View>
            ) : null}

            {webviewError ? (
              <View style={[styles.webviewOverlay, { backgroundColor: palette.bg }]}>
                <AlertCircle size={34} color={palette.error} />
                <Text style={[styles.webviewOverlayText, { color: palette.text }]}>Verification screen unavailable</Text>
                <Text style={[styles.webviewOverlaySub, { color: palette.textSecondary }]}>{webviewError}</Text>
                <Pressable
                  onPress={() => {
                    setWebviewError(null);
                    setWebviewLoading(true);
                    setWebviewKey((k) => k + 1);
                  }}
                  style={({ pressed }) => [
                    styles.primaryAction,
                    { backgroundColor: palette.primary, marginTop: 6 },
                    pressed && { opacity: 0.9 },
                  ]}
                >
                  <Text style={styles.primaryActionText}>Try Again</Text>
                </Pressable>
                <Pressable
                  onPress={closeWebviewToPolling}
                  style={({ pressed }) => [
                    styles.secondaryAction,
                    { backgroundColor: palette.bg, borderColor: palette.border },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <Text style={[styles.secondaryActionText, { color: palette.text }]}>Close</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={[styles.webviewFooter, { backgroundColor: palette.card, borderTopColor: palette.border }]}>
            <Text style={[styles.webviewFooterHint, { color: palette.textSecondary }]}>
              {sessionProvider === 'SUMSUB'
                ? 'Your result is delivered automatically when you finish — or tap below.'
                : 'Finished the flow above? Tap below so we can confirm your result.'}
            </Text>
            <Pressable
              onPress={closeWebviewToPolling}
              disabled={checking}
              style={({ pressed }) => [
                styles.primaryAction,
                { backgroundColor: checking ? palette.border : palette.primary },
                pressed && !checking ? { opacity: 0.9 } : null,
              ]}
            >
              <CheckCircle2 size={18} color="#FFF" />
              <Text style={styles.primaryActionText}>
                {checking ? 'Confirming\u2026' : 'I\u2019ve completed verification'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function KycSkeleton({ palette }: { palette: any }) {
  return (
    <View style={[styles.screen, { backgroundColor: palette.bg, paddingHorizontal: Spacing.lg, paddingTop: Spacing.xxl }]}>
      <View style={{ gap: Spacing.lg }}>
        <View style={styles.headerRow}>
          <View style={[styles.backButton, { backgroundColor: palette.border }]} />
          <AnimatedSkeleton width={160} height={24} borderRadius={12} />
          <View style={styles.headerSpacer} />
        </View>
        <AnimatedSkeleton width="100%" height={160} borderRadius={24} />
        <AnimatedSkeleton width="100%" height={320} borderRadius={24} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: 48, gap: Spacing.lg, paddingBottom: 60 },
  headerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 14 },
  headerTitle: { ...Typography.title1 },
  backButton: { width: 40, height: 40, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 42 },
  hero: { borderRadius: 24, padding: Spacing.lg, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroLabel: { fontSize: Typography.xs, fontFamily: Typography.currencySub.fontFamily, letterSpacing: 1 },
  heroValue: { fontSize: Typography.lg, fontFamily: Typography.currencySub.fontFamily, marginTop: 2 },
  heroIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroBody: { fontSize: Typography.sm, lineHeight: 20 },
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.lg, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepPill: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: Typography.md, fontFamily: Typography.currencySub.fontFamily },
  sectionSubtitle: { fontSize: Typography.xs, lineHeight: 17 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameField: { flex: 1 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: Typography.md },
  summaryMini: { borderRadius: 18, borderWidth: 1, padding: Spacing.md, gap: 4 },
  summaryMiniLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: Typography.currencySub.fontFamily },
  summaryMiniValue: { fontSize: Typography.md, fontFamily: Typography.currencySub.fontFamily },
  summaryMiniMeta: { fontSize: Typography.xs },
  bankButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 60, gap: 10 },
  bankButtonCopy: { flex: 1, gap: 2 },
  bankButtonValue: { fontSize: Typography.md, fontFamily: Typography.currencySub.fontFamily },
  consentRow: { borderRadius: 18, borderWidth: 1, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { color: '#FFF', fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  consentCopy: { flex: 1, gap: 2 },
  consentTitle: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  consentBody: { fontSize: Typography.xs, lineHeight: 16 },
  stepActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stepActionFlex: { flex: 1 },
  primaryAction: { minHeight: 54, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryActionText: { color: '#FFF', fontSize: Typography.md, fontFamily: Typography.currencySub.fontFamily, textAlign: 'center' },
  secondaryAction: { minHeight: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondaryActionText: { fontSize: Typography.md, fontFamily: Typography.currencySub.fontFamily, textAlign: 'center' },
  secondary: { minHeight: 54, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryText: { fontSize: Typography.md, fontFamily: Typography.currencySub.fontFamily },
  reviewCard: { borderRadius: 18, borderWidth: 1, padding: Spacing.md, gap: 4 },
  reviewGroupLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: Typography.currencySub.fontFamily, marginBottom: 4 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  reviewLabel: { fontSize: Typography.sm },
  reviewValue: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily, textAlign: 'right', flex: 1 },
  verifiedCard: { borderRadius: 28, borderWidth: 1, padding: Spacing.xl, gap: Spacing.lg, alignItems: 'center', width: '100%' },
  verifiedBadgeGlow: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pendingBadgeWrap: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  verifiedTitle: { fontSize: 24, fontFamily: Typography.currencySub.fontFamily, textAlign: 'center', letterSpacing: -0.5 },
  verifiedSub: { fontSize: Typography.sm, lineHeight: 22, textAlign: 'center' },
  nubanCard: { width: '100%', borderRadius: 20, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  nubanCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nubanProviderLabel: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  activePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activePillText: { fontSize: 10, fontFamily: Typography.currencySub.fontFamily, letterSpacing: 0.8 },
  nubanBody: { gap: 4 },
  nubanLabel: { fontSize: 10, fontFamily: Typography.currencySub.fontFamily, letterSpacing: 1 },
  nubanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nubanNumber: { fontSize: 30, fontFamily: Typography.currencySub.fontFamily, letterSpacing: 2 },
  copyBtn: { padding: 8, borderRadius: 10 },
  accountNameLabel: { fontSize: Typography.xs, fontFamily: Typography.family.medium, marginTop: 4 },
  tierBadgeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 12, borderRadius: 16, borderWidth: 1, padding: Spacing.md },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierBadgeLabel: { fontSize: Typography.xs, fontFamily: Typography.family.medium, textTransform: 'uppercase', letterSpacing: 0.6 },
  tierBadgeValue: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily, marginTop: 2 },
  tierBadgePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  tierBadgePillText: { fontSize: Typography.xs, fontFamily: Typography.currencySub.fontFamily, letterSpacing: 0.4 },
  bottomSheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheetContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: Spacing.xl, gap: Spacing.md },
  dragHandle: { width: 36, height: 5, borderRadius: 2.5, alignSelf: 'center', marginBottom: 4 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  upgradeIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle: { fontSize: Typography.md, fontFamily: Typography.currencySub.fontFamily },
  upgradeSub: { fontSize: Typography.xs, lineHeight: 17, marginTop: 3 },
  closeIconButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: { width: '100%', borderRadius: 18, borderWidth: 1, padding: Spacing.md, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  errorTitle: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  errorSub: { fontSize: Typography.xs, lineHeight: 16, marginTop: 2 },
  expectRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  expectIcon: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  expectCopy: { flex: 1, gap: 2 },
  expectTitle: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  expectBody: { fontSize: Typography.xs, lineHeight: 16 },
  smallPrint: { fontSize: 11, lineHeight: 15, textAlign: 'center' },
  webviewRoot: { flex: 1 },
  webviewHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: Spacing.md, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  webviewTitle: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily },
  webviewSubtitle: { fontSize: 10, letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 1 },
  webviewFooter: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  webviewFooterHint: { fontSize: Typography.xs, lineHeight: 16, textAlign: 'center' },
  webviewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: Spacing.xl, zIndex: 2 },
  webviewOverlayText: { fontSize: Typography.sm, fontFamily: Typography.currencySub.fontFamily, textAlign: 'center' },
  webviewOverlaySub: { fontSize: Typography.xs, lineHeight: 16, textAlign: 'center' },
});
