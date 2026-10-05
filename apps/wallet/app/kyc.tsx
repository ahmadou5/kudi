import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  AlertCircle,
  BadgeInfo,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Copy,
  CreditCard,
  ShieldCheck,
  Zap,
  X,
} from 'lucide-react-native';

import { useAppPalette, hexToRgba } from '../src/lib/theme';
import { Typography } from '../src/constants/typography';
import { Spacing } from '../src/constants/spacing';
import { useAuthStore } from '../src/store/auth.store';
import { useUserProfile } from '../src/hooks/useUserProfile';
import { sdk } from '../src/lib/sdk';
import { AppModal, useAppModal } from '../src/components/ui/AppModal';
import { DobDatePickerModal } from '../src/components/ui/DobDatePickerModal';
import { BankPickerModal, BankLogo, BankItem } from '../src/components/wallet/BankPickerModal';
import { NIGERIAN_BANKS } from '../src/constants/banks';
import { FlowProgressDots } from '../src/components/wallet/WalletFlowProgress';
import { AnimatedSkeleton } from '../src/components/ui/AnimatedSkeleton';

function isOfAge(dateString: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;
  const birthDate = new Date(dateString);
  if (Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age >= 18;
}

function isValidIdInput(value: string, expectedLength: number) {
  return new RegExp(`^\\d{${expectedLength}}$`).test(value.trim());
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const [firstName = '', ...rest] = parts;
  return {
    firstName,
    lastName: rest.join(' '),
  };
}

type KycStep = 1 | 2 | 3;

export default function KYCScreen() {
  const palette = useAppPalette();
  const modal = useAppModal();
  const user = useAuthStore((s) => s.user);
  const updateUserStore = useAuthStore((s) => s.updateProfile);
  const { data: profileData, isLoading: profileLoading, refetch: refetchProfile } = useUserProfile();

  const [step, setStep] = useState<KycStep>(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [address, setAddress] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [bvn, setBvn] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState(NIGERIAN_BANKS[0]?.code || '058');
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [consent, setConsent] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // NIN Upgrade modal state
  const [nin, setNin] = useState('');
  const [ninSubmitting, setNinSubmitting] = useState(false);
  const [upgradeModalVisible, setUpgradeModalVisible] = useState(false);
  const [forceEdit, setForceEdit] = useState(false);

  // Animations
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  // Derive initial values from profile / store
  useEffect(() => {
    if (user?.fullName) {
      const parsed = splitFullName(user.fullName);
      setFirstName(parsed.firstName);
      setLastName(parsed.lastName);
    }
  }, [user?.fullName]);

  const kycTier = user?.kycTier || profileData?.user?.kycTier || 'UNVERIFIED';
  const kycStatus = user?.kycStatus || profileData?.user?.kycStatus || 'NOT_STARTED';

  const kycComplete = kycTier === 'TIER_2' || kycTier === 'TIER_3' || kycStatus === 'VERIFIED';
  const verificationPending = (kycStatus === 'PENDING' || submitted) && !kycComplete && !forceEdit;
  const verificationRejected = kycStatus === 'REJECTED' || kycStatus === 'SUSPENDED';

  // Selected bank item
  const selectedBank = useMemo(
    () => NIGERIAN_BANKS.find((b) => b.code === bankCode) || NIGERIAN_BANKS[0],
    [bankCode]
  );

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

  // Form validity checks
  const personalInfoComplete =
    firstName.trim().length >= 1 &&
    lastName.trim().length >= 1 &&
    address.trim().length >= 5 &&
    isOfAge(dateOfBirth);

  const identityComplete =
    isValidIdInput(bvn, 11) &&
    isValidIdInput(accountNumber, 10) &&
    Boolean(bankCode) &&
    consent;

  const canSubmit = personalInfoComplete && identityComplete && !submitting;

  const copyToClipboard = async (text: string, label: string) => {
    try {
      const Clipboard = await import('expo-clipboard');
      await Clipboard.setStringAsync(text);
      modal.alert(`${label} Copied!`, `${text} has been copied to your clipboard.`, 'success');
    } catch {
      modal.alert(label, text, 'info');
    }
  };

  const handleNext = () => {
    if (step === 1 && personalInfoComplete) {
      setStep(2);
    } else if (step === 2 && identityComplete) {
      setStep(3);
    }
  };

  const headerBack = () => {
    if (step > 1) {
      setStep((curr) => (curr - 1) as KycStep);
      return;
    }
    router.back();
  };

  const submitKyc = async () => {
    if (!canSubmit) {
      modal.alert(
        'Complete all required fields',
        'Please enter your full name, address, date of birth, 11-digit BVN, account number, bank, and consent.',
        'warning'
      );
      return;
    }

    setSubmitting(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
      await updateUserStore({ fullName });

      const res = await sdk.verifyKYCID({
        userId: user?.id || '',
        idNumber: bvn.trim(),
        idType: 'BVN',
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob: dateOfBirth.trim(),
        accountNumber: accountNumber.trim(),
        bankCode,
        address: address.trim(),
      });

      setSubmitting(false);
      if (res && res.success) {
        setSubmitted(true);
        await refetchProfile();
        modal.show({
          title: 'Verification Submitted! 🎉',
          description: 'Your identity is being verified. Your Tier 2 limits and dedicated NUBAN account will be activated shortly.',
          type: 'success',
          primaryText: 'View Status',
          onPrimaryPress: () => {
            modal.hide();
          },
        });
      } else {
        const errorMsg = res?.error?.message || res?.message || 'Verification submission failed';
        modal.alert('Verification Failed', errorMsg, 'error');
      }
    } catch (err: any) {
      setSubmitting(false);
      modal.alert('Connection Error', err?.message || 'Failed to submit verification.', 'error');
    }
  };

  const handleNinUpgrade = async () => {
    if (!/^\d{11}$/.test(nin.trim())) {
      modal.alert('Invalid NIN', 'Please enter a valid 11-digit NIN number.', 'warning');
      return;
    }

    setNinSubmitting(true);
    try {
      const res = await sdk.verifyKYCID({
        userId: user?.id || '',
        idNumber: nin.trim(),
        idType: 'NIN',
        firstName: firstName.trim() || user?.fullName || 'User',
        lastName: lastName.trim(),
        dob: dateOfBirth || '1998-05-12',
      });

      setNinSubmitting(false);
      if (res && res.success) {
        setUpgradeModalVisible(false);
        setNin('');
        await refetchProfile();
        modal.alert('NIN Verified! 🚀', 'Your account has been upgraded to Tier 3 with a ₦5,000,000 daily transfer limit!', 'success');
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
    const nuban = virtualAcc?.accountNumber || '0123456789';
    const bankName = virtualAcc?.bankName || 'Wema Bank (Kudi Account)';
    const accountName = virtualAcc?.accountName || user?.fullName || 'Kudi User';

    const isTier3 = kycTier === 'TIER_3';
    const isTier2 = kycTier === 'TIER_2' || kycComplete;
    const tierLabel = isTier3 ? 'Tier 3' : (isTier2 ? 'Tier 2' : 'Tier 1');
    const tierLimit = isTier3 ? '₦5,000,000' : (isTier2 ? '₦2,000,000' : '₦50,000');
    const tierColor = isTier3 ? palette.success : palette.primary;

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
            <ChevronLeft size={20} color={palette.text} />
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
          <View style={[styles.nubanCard, { backgroundColor: palette.primary, borderColor: palette.primary }]}>
            <View style={styles.nubanCardHeader}>
              <Text style={styles.nubanProviderLabel}>{bankName}</Text>
              <View style={styles.activePill}>
                <Text style={styles.activePillText}>ACTIVE</Text>
              </View>
            </View>
            <View style={styles.nubanBody}>
              <Text style={styles.nubanLabel}>ACCOUNT NUMBER</Text>
              <View style={styles.nubanRow}>
                <Text style={styles.nubanNumber}>{nuban}</Text>
                <Pressable onPress={() => copyToClipboard(nuban, 'Account Number')} style={styles.copyBtn}>
                  <Copy size={18} color="#FFFFFF" />
                </Pressable>
              </View>
              <Text style={styles.accountNameLabel}>Beneficiary: {accountName}</Text>
            </View>
          </View>

          {/* Action buttons */}
          {!isTier3 && (
            <Pressable
              onPress={() => setUpgradeModalVisible(true)}
              style={({ pressed }) => [
                styles.primaryAction,
                { width: '100%', backgroundColor: palette.primary },
                pressed && { opacity: 0.9 },
              ]}
            >
              <Zap size={18} color="#FFF" />
              <Text style={styles.primaryActionText}>Upgrade to Tier 3 (₦5,000,000/day)</Text>
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
        {!isTier3 && (
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
                    <Text style={[styles.upgradeTitle, { color: palette.text }]}>Upgrade to Tier 3</Text>
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
            <ChevronLeft size={20} color={palette.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: palette.text }]}>Verification Pending</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <View style={[styles.verifiedCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Animated.View
              style={[
                styles.pendingBadgeWrap,
                { backgroundColor: 'rgba(255,159,10,0.12)', borderColor: '#FF9F0A', transform: [{ scale: pulseAnim }] },
              ]}
            >
              <BadgeInfo size={44} color="#FF9F0A" />
            </Animated.View>

            <Text style={[styles.verifiedTitle, { color: palette.text }]}>Verification in Progress</Text>
            <Text style={[styles.verifiedSub, { color: palette.textSecondary }]}>
              Our partner is validating your BVN and bank account details. Your dedicated NUBAN will be assigned automatically once complete.
            </Text>

            <Pressable
              onPress={async () => {
                const res = await refetchProfile();
                if (res.data?.user?.kycStatus === 'VERIFIED' || res.data?.user?.kycTier !== 'UNVERIFIED') {
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
                setStep(1);
              }}
              style={({ pressed }) => [styles.secondaryAction, { width: '100%', backgroundColor: palette.bg, borderColor: palette.border, marginBottom: 8 }, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.secondaryActionText, { color: palette.text }]}>Re-enter / Edit Details</Text>
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

  // 3. MULTI-STEP KYC FORM FLOW
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
          onPress={headerBack}
        >
          <ChevronLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: palette.text }]}>Identity Verification</Text>
        <View style={styles.headerSpacer} />
      </View>

      {verificationRejected && (
        <View style={[styles.errorCard, { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: palette.error }]}>
          <AlertCircle size={20} color={palette.error} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.errorTitle, { color: palette.error }]}>Verification Attempt Failed</Text>
            <Text style={[styles.errorSub, { color: palette.text }]}>
              Please verify your BVN and bank account details carefully before resubmitting.
            </Text>
          </View>
        </View>
      )}

      {/* Hero Banner with Step Tracker */}
      <View style={[styles.hero, { backgroundColor: palette.primary }]}>
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.heroLabel}>IDENTITY CHECK</Text>
            <Text style={styles.heroValue}>{`Step ${step} of 3`}</Text>
          </View>
          <View style={styles.heroIcon}>
            <ShieldCheck size={24} color="#FFF" />
          </View>
        </View>
        <Text style={styles.heroBody}>
          Verifying your BVN creates a dedicated bank account in your name for instant deposits and higher daily limits.
        </Text>
        <FlowProgressDots
          currentStep={step}
          totalSteps={3}
          onStepPress={(targetStep) => {
            if (targetStep < step) setStep(targetStep as KycStep);
          }}
        />
      </View>

      {/* STEP 1: Personal Info */}
      {step === 1 && (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepPill, { backgroundColor: hexToRgba(palette.primary, 0.12), borderColor: palette.primary }]}>
              <CreditCard size={16} color={palette.primary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Personal Information</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                Provide your legal name and residential address as registered with your bank.
              </Text>
            </View>
          </View>

          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>First Name</Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor={palette.textSecondary}
                style={[styles.input, { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }]}
              />
            </View>
            <View style={styles.nameField}>
              <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Last Name</Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor={palette.textSecondary}
                style={[styles.input, { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }]}
              />
            </View>
          </View>

          <View>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Residential Address</Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="Full street address"
              placeholderTextColor={palette.textSecondary}
              style={[styles.input, { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }]}
            />
          </View>

          <View>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Date of Birth</Text>
            <Pressable onPress={() => setDatePickerOpen(true)}>
              <View pointerEvents="none">
                <TextInput
                  value={dateOfBirth}
                  placeholder="Select Date of Birth (YYYY-MM-DD)"
                  placeholderTextColor={palette.textSecondary}
                  editable={false}
                  style={[styles.input, { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }]}
                />
              </View>
            </Pressable>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4 }]}>
              Must be at least 18 years old.
            </Text>
          </View>

          <Pressable
            onPress={handleNext}
            disabled={!personalInfoComplete}
            style={({ pressed }) => [
              styles.primaryAction,
              { backgroundColor: personalInfoComplete ? palette.primary : palette.border },
              pressed && personalInfoComplete ? { opacity: 0.9 } : null,
            ]}
          >
            <Text style={styles.primaryActionText}>Continue to Bank & BVN</Text>
          </Pressable>
        </View>
      )}

      {/* STEP 2: Bank & BVN Details */}
      {step === 2 && (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepPill, { backgroundColor: hexToRgba(palette.primary, 0.12), borderColor: palette.primary }]}>
              <ShieldCheck size={16} color={palette.primary} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Bank & BVN Details</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                Enter your 11-digit BVN and your active bank account number.
              </Text>
            </View>
          </View>

          <View style={[styles.summaryMini, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Text style={[styles.summaryMiniLabel, { color: palette.textSecondary }]}>VERIFIED NAME & DOB</Text>
            <Text style={[styles.summaryMiniValue, { color: palette.text }]}>
              {`${firstName.trim()} ${lastName.trim()}`.trim() || 'Full name pending'}
            </Text>
            <Text style={[styles.summaryMiniMeta, { color: palette.textSecondary }]}>{dateOfBirth || 'DOB pending'}</Text>
          </View>

          <View>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>BVN (11 Digits)</Text>
            <TextInput
              value={bvn}
              onChangeText={setBvn}
              placeholder="Enter 11-digit BVN"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
              maxLength={11}
              style={[styles.input, { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }]}
            />
          </View>

          <View>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Select Bank</Text>
            <Pressable
              onPress={() => setBankPickerOpen(true)}
              style={[styles.bankButton, { backgroundColor: palette.bg, borderColor: palette.border }]}
            >
              <BankLogo name={selectedBank?.name || 'Bank'} bankCode={selectedBank?.code} size={36} />
              <View style={styles.bankButtonCopy}>
                <Text style={[styles.bankButtonValue, { color: palette.text }]}>
                  {selectedBank?.name || 'Choose your bank'}
                </Text>
              </View>
              <ChevronDown size={18} color={palette.textSecondary} />
            </Pressable>
          </View>

          <View>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 6 }]}>Account Number (10 Digits)</Text>
            <TextInput
              value={accountNumber}
              onChangeText={setAccountNumber}
              placeholder="10-digit NUBAN account number"
              placeholderTextColor={palette.textSecondary}
              keyboardType="number-pad"
              maxLength={10}
              style={[styles.input, { backgroundColor: palette.bg, color: palette.text, borderColor: palette.border }]}
            />
          </View>

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
                I authorize Kudi to verify my details with NIBSS and issue a dedicated account number.
              </Text>
            </View>
          </Pressable>

          {/* Actions */}
          <View style={styles.stepActions}>
            <Pressable
              onPress={headerBack}
              style={[styles.secondary, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[styles.secondaryText, { color: palette.text }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={handleNext}
              disabled={!identityComplete}
              style={({ pressed }) => [
                styles.primaryAction,
                styles.stepActionFlex,
                { backgroundColor: identityComplete ? palette.primary : palette.border },
                pressed && identityComplete ? { opacity: 0.9 } : null,
              ]}
            >
              <Text style={styles.primaryActionText}>Review Details</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* STEP 3: Review & Submit */}
      {step === 3 && (
        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.sectionHeader}>
            <View style={[styles.stepPill, { backgroundColor: 'rgba(48,209,88,0.12)', borderColor: palette.success }]}>
              <CheckCircle2 size={16} color={palette.success} />
            </View>
            <View style={styles.sectionCopy}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>Confirm & Submit</Text>
              <Text style={[styles.sectionSubtitle, { color: palette.textSecondary }]}>
                Review your information carefully before submitting.
              </Text>
            </View>
          </View>

          <View style={[styles.reviewCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Text style={[styles.reviewGroupLabel, { color: palette.textSecondary }]}>PERSONAL INFORMATION</Text>
            <ReviewRow label="Full Name" value={`${firstName.trim()} ${lastName.trim()}`.trim()} palette={palette} />
            <ReviewRow label="Address" value={address.trim()} palette={palette} />
            <ReviewRow label="Date of Birth" value={dateOfBirth.trim()} palette={palette} />
          </View>

          <View style={[styles.reviewCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <Text style={[styles.reviewGroupLabel, { color: palette.textSecondary }]}>IDENTITY & BANK</Text>
            <ReviewRow label="BVN" value={bvn.trim()} palette={palette} />
            <ReviewRow label="Bank" value={selectedBank?.name || '—'} palette={palette} />
            <ReviewRow label="Account Number" value={accountNumber.trim()} palette={palette} />
            <ReviewRow label="Consent" value={consent ? 'Authorized' : 'Missing'} palette={palette} />
          </View>

          <View style={styles.stepActions}>
            <Pressable
              onPress={headerBack}
              style={[styles.secondary, { backgroundColor: palette.card, borderColor: palette.border }]}
            >
              <Text style={[styles.secondaryText, { color: palette.text }]}>Back</Text>
            </Pressable>
            <Pressable
              disabled={!canSubmit}
              onPress={submitKyc}
              style={({ pressed }) => [
                styles.primaryAction,
                styles.stepActionFlex,
                { backgroundColor: canSubmit ? palette.primary : palette.border },
                pressed && canSubmit ? { opacity: 0.9 } : null,
              ]}
            >
              <Text style={styles.primaryActionText}>
                {submitting ? 'Verifying Identity…' : 'Submit Verification'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Bank Picker Modal */}
      <BankPickerModal
        visible={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        selectedBankCode={bankCode}
        banks={NIGERIAN_BANKS}
        onSelect={(bank) => setBankCode(bank.code)}
      />

      {/* Date Picker Modal */}
      <DobDatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        onSelect={setDateOfBirth}
        initialValue={dateOfBirth}
      />

      {/* Global App Modal */}
      <AppModal config={modal.config} onClose={modal.hide} />
    </ScrollView>
  );
}

function ReviewRow({ label, value, palette }: { label: string; value: string; palette: any }) {
  return (
    <View style={[styles.reviewRow, { borderBottomColor: palette.border }]}>
      <Text style={[styles.reviewLabel, { color: palette.textSecondary }]}>{label}</Text>
      <Text style={[styles.reviewValue, { color: palette.text }]}>{value || '—'}</Text>
    </View>
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
  headerRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: Typography.lg, fontFamily: Typography.family.bold },
  backButton: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  headerSpacer: { width: 42 },
  hero: { borderRadius: 24, padding: Spacing.lg, gap: 12 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroLabel: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, fontFamily: Typography.family.bold, letterSpacing: 1 },
  heroValue: { color: '#FFF', fontSize: Typography.lg, fontFamily: Typography.family.bold, marginTop: 2 },
  heroIcon: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)' },
  heroBody: { color: 'rgba(255,255,255,0.9)', fontSize: Typography.sm, lineHeight: 20 },
  card: { borderRadius: 24, borderWidth: 1, padding: Spacing.lg, gap: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepPill: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1, gap: 3 },
  sectionTitle: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  sectionSubtitle: { fontSize: Typography.xs, lineHeight: 17 },
  nameRow: { flexDirection: 'row', gap: 10 },
  nameField: { flex: 1 },
  input: { height: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: 16, fontSize: Typography.md },
  summaryMini: { borderRadius: 18, borderWidth: 1, padding: Spacing.md, gap: 4 },
  summaryMiniLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: Typography.family.bold },
  summaryMiniValue: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  summaryMiniMeta: { fontSize: Typography.xs },
  bankButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, minHeight: 60, gap: 10 },
  bankButtonCopy: { flex: 1, gap: 2 },
  bankButtonValue: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  consentRow: { borderRadius: 18, borderWidth: 1, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { color: '#FFF', fontSize: Typography.sm, fontFamily: Typography.family.bold },
  consentCopy: { flex: 1, gap: 2 },
  consentTitle: { fontSize: Typography.sm, fontFamily: Typography.family.bold },
  consentBody: { fontSize: Typography.xs, lineHeight: 16 },
  stepActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  stepActionFlex: { flex: 1 },
  primaryAction: { minHeight: 54, borderRadius: 16, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryActionText: { color: '#FFF', fontSize: Typography.md, fontFamily: Typography.family.bold, textAlign: 'center' },
  secondaryAction: { minHeight: 52, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  secondaryActionText: { fontSize: Typography.md, fontFamily: Typography.family.bold, textAlign: 'center' },
  secondary: { minHeight: 54, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  secondaryText: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  reviewCard: { borderRadius: 18, borderWidth: 1, padding: Spacing.md, gap: 4 },
  reviewGroupLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, fontFamily: Typography.family.bold, marginBottom: 4 },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  reviewLabel: { fontSize: Typography.sm },
  reviewValue: { fontSize: Typography.sm, fontFamily: Typography.family.bold, textAlign: 'right', flex: 1 },
  verifiedCard: { borderRadius: 28, borderWidth: 1, padding: Spacing.xl, gap: Spacing.lg, alignItems: 'center', width: '100%' },
  verifiedBadgeGlow: { width: 96, height: 96, borderRadius: 48, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  pendingBadgeWrap: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  verifiedTitle: { fontSize: 24, fontFamily: Typography.family.bold, textAlign: 'center', letterSpacing: -0.5 },
  verifiedSub: { fontSize: Typography.sm, lineHeight: 22, textAlign: 'center' },
  nubanCard: { width: '100%', borderRadius: 20, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md },
  nubanCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nubanProviderLabel: { color: '#FFFFFF', fontSize: Typography.sm, fontFamily: Typography.family.bold },
  activePill: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  activePillText: { color: '#FFFFFF', fontSize: 10, fontFamily: Typography.family.bold, letterSpacing: 0.8 },
  nubanBody: { gap: 4 },
  nubanLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 10, fontFamily: Typography.family.bold, letterSpacing: 1 },
  nubanRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nubanNumber: { color: '#FFFFFF', fontSize: 30, fontFamily: Typography.family.bold, letterSpacing: 2 },
  copyBtn: { padding: 8, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)' },
  accountNameLabel: { color: 'rgba(255,255,255,0.9)', fontSize: Typography.xs, fontFamily: Typography.family.medium, marginTop: 4 },
  tierBadgeRow: { flexDirection: 'row', alignItems: 'center', width: '100%', gap: 12, borderRadius: 16, borderWidth: 1, padding: Spacing.md },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierBadgeLabel: { fontSize: Typography.xs, fontFamily: Typography.family.medium, textTransform: 'uppercase', letterSpacing: 0.6 },
  tierBadgeValue: { fontSize: Typography.sm, fontFamily: Typography.family.bold, marginTop: 2 },
  tierBadgePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  tierBadgePillText: { fontSize: Typography.xs, fontFamily: Typography.family.bold, letterSpacing: 0.4 },
  bottomSheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  bottomSheetContainer: { borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, padding: Spacing.xl, gap: Spacing.md },
  dragHandle: { width: 36, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(150,150,150,0.4)', alignSelf: 'center', marginBottom: 4 },
  sheetHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  upgradeIconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  upgradeTitle: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  upgradeSub: { fontSize: Typography.xs, lineHeight: 17, marginTop: 3 },
  closeIconButton: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  errorCard: { width: '100%', borderRadius: 18, borderWidth: 1, padding: Spacing.md, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  errorTitle: { fontSize: Typography.sm, fontFamily: Typography.family.bold },
  errorSub: { fontSize: Typography.xs, lineHeight: 16, marginTop: 2 },
});
