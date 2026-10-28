import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Edit3,
  Gift,
  Settings,
  Shield,
  ShieldCheck,
  Trash2
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPalette, hexToRgba, mixColors } from '../src/lib/theme';
import { useAuthStore, AuthState } from '../src/store/auth.store';
import { Typography } from '../src/constants/typography';
import { Spacing } from '../src/constants/spacing';
import { AppModal, useAppModal } from '../src/components/ui/AppModal';
import { Avatar, userAvatarSeed } from '../src/components/Avatar';
import { EnterSection } from '../src/lib/animations';

export default function ProfileScreen() {
  const palette = useAppPalette();
  const user = useAuthStore((s: AuthState) => s.user);
  const deleteAccount = useAuthStore((s: AuthState) => s.deleteAccount);
  const modal = useAppModal();

  const userEmail = user?.email || '';
  const fullName = user?.fullName || '';
  const username = user?.username || (userEmail ? `@${userEmail.split('@')[0]}` : '');
  const userDisplayName = fullName || username || userEmail.split('@')[0] || 'Kudi User';

  const rawTier = user?.kycTier;
  const kycTierNum =
    rawTier === '2' || rawTier === 'TIER_2'
      ? 2
      : rawTier === '1' || rawTier === 'TIER_1' || user?.kycStatus === 'VERIFIED'
        ? 1
        : 0;
  const kycVerified = kycTierNum > 0;
  const kycLabel = kycTierNum === 2 ? 'Tier 2 (Pro)' : kycTierNum === 1 ? 'Tier 1 (Basic)' : 'Unverified';

  const insetBg = mixColors(palette.bg, palette.text, 0.04);

  const handleDeleteAccount = () => {
    modal.show({
      title: 'Delete Account Permanently',
      description:
        'Are you sure you want to delete your Kudi account? All your profile data, local settings, and wallet keys will be permanently erased. This action CANNOT be undone.',
      type: 'error',
      primaryText: 'Delete Account',
      onPrimaryPress: async () => {
        modal.hide();
        await deleteAccount();
        router.replace('/(auth)/welcome');
      },
      secondaryText: 'Cancel',
      onSecondaryPress: modal.hide,
    });
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibility-label="Go back"
          hitSlop={12}
          style={({ pressed }) => [
            styles.backButton,
            { backgroundColor: palette.card, borderColor: palette.border },
            pressed && { opacity: 0.6 }
          ]}
        >
          <ArrowLeft size={20} color={palette.text} />
        </Pressable>
        <Text style={[Typography.title1, { color: palette.text }]}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Profile card ── */}
        <EnterSection index={0}>
          <View style={[styles.profileCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.avatarWrap}>
              <Avatar avatarUrl={user?.avatarUrl} seed={userAvatarSeed(user)} size={88} />
              {kycVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: palette.success, borderColor: palette.card }]}>
                  <Check size={11} color="#FFFFFF" strokeWidth={3} />
                </View>
              )}
            </View>

            <Text
              style={[Typography.title1, { color: palette.text, marginTop: 14 }]}
              numberOfLines={1}
              accessibilityLabel={`Display name ${userDisplayName}`}
            >
              {userDisplayName}
            </Text>

            {!!username && (
              <Text
                style={[Typography.bodyBold, { color: hexToRgba(palette.text, 0.5), fontSize: 13, marginTop: 3 }]}
                numberOfLines={1}
              >
                {username}
              </Text>
            )}

            {/* KYC status pill */}
            <Pressable
              onPress={() => router.push('/kyc')}
              accessibilityRole="button"
              accessibilityLabel={`KYC status: ${kycLabel}. Open verification.`}
              style={({ pressed }) => [
                styles.kycPill,
                { backgroundColor: hexToRgba(kycVerified ? palette.success : palette.warning, 0.14) },
                pressed && { opacity: 0.75 }
              ]}
            >
              {kycVerified ? (
                <ShieldCheck size={14} color={palette.success} />
              ) : (
                <Shield size={14} color={palette.warning} />
              )}
              <Text
                style={[
                  Typography.caption,
                  { color: kycVerified ? palette.success : palette.warning, fontWeight: '800' }
                ]}
              >
                KYC {kycLabel}
              </Text>
              {!kycVerified && <ChevronRight size={12} color={palette.warning} />}
            </Pressable>
          </View>
        </EnterSection>

        {/* ── Edit profile (primary) ── */}
        <EnterSection index={1}>
          <Pressable
            onPress={() => router.push('/settings/edit-profile')}
            accessibilityRole="button"
            accessibility-label="Edit profile"
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: palette.text },
              pressed && { opacity: 0.9 }
            ]}
          >
            <Edit3 size={18} color={palette.bg} />
            <Text style={[Typography.currencySub, { color: palette.bg }]}>Edit Profile</Text>
          </Pressable>
        </EnterSection>

        {/* ── Settings + Referrals ── */}
        <EnterSection index={2}>
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => router.push('/settings')}
              accessibilityRole="button"
              accessibility-label="Open settings"
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: insetBg, borderColor: palette.border },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Settings size={17} color={palette.text} />
              <Text style={[Typography.currencySub, { color: palette.text, fontSize: 14 }]}>Settings</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push('/referral')}
              accessibilityRole="button"
              accessibility-label="Open referrals"
              style={({ pressed }) => [
                styles.secondaryBtn,
                { backgroundColor: insetBg, borderColor: palette.border },
                pressed && { opacity: 0.7 }
              ]}
            >
              <Gift size={17} color={palette.text} />
              <Text style={[Typography.currencySub, { color: palette.text, fontSize: 14 }]}>Referrals</Text>
            </Pressable>
          </View>
        </EnterSection>

        {/* ── Delete account ── */}
        <EnterSection index={3}>
          <Pressable
            onPress={handleDeleteAccount}
            accessibilityRole="button"
            accessibility-label="Delete account"
            style={({ pressed }) => [
              styles.deleteBtn,
              {
                backgroundColor: hexToRgba(palette.error, 0.08),
                borderColor: hexToRgba(palette.error, 0.28)
              },
              pressed && { opacity: 0.7 }
            ]}
          >
            <Trash2 size={18} color={palette.error} />
            <Text style={[styles.deleteText, { color: palette.error }]}>Delete Account</Text>
          </Pressable>
        </EnterSection>

        <AppModal config={modal.config} onClose={modal.hide} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingTop: 12,
    paddingBottom: 40,
    gap: 14
  },
  profileCard: {
    alignItems: 'center',
    padding: 24,
    paddingBottom: 26,
    borderRadius: 24,
    borderWidth: 1
  },
  avatarWrap: {
    position: 'relative'
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3
  },
  kycPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginTop: 14
  },
  primaryBtn: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12
  },
  secondaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  deleteBtn: {
    marginTop: 10,
    height: 54,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  deleteText: {
    fontFamily: Typography.family.sans,
    fontSize: 15
  }
});
