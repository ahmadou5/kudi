import React from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ArrowLeft, Copy, Gift, Link2, RotateCcw, Share2, UserPlus, Users } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPalette, hexToRgba } from '../src/lib/theme';
import { Typography } from '../src/constants/typography';
import { Spacing } from '../src/constants/spacing';
import { AppModal, useAppModal } from '../src/components/ui/AppModal';
import { haptics } from '../src/lib/haptics';
import { useReferral } from '../src/hooks/useReferral';
import { AnimatedSkeleton } from '../src/components/ui/AnimatedSkeleton';
import { Avatar } from '../src/components/Avatar';

const STEPS = [
  {
    Icon: Share2,
    title: 'Share your code',
    subtitle: 'Copy it or send it over any app'
  },
  {
    Icon: UserPlus,
    title: 'A friend signs up',
    subtitle: 'They join Kudi with your code in hand'
  },
  {
    Icon: Link2,
    title: 'You are connected',
    subtitle: 'Send to each other in a couple of taps'
  }
];

const formatJoinedDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return '';
  }
};

export default function ReferralScreen() {
  const palette = useAppPalette();
  const modal = useAppModal();
  const { data, isLoading, isError, refetch, isRefetching } = useReferral();

  const referralCode = data?.code;
  const invited = data?.invited ?? [];
  const invitedCount = data?.invitedCount ?? invited.length;

  const handleCopy = async () => {
    if (!referralCode) return;
    haptics.tap();
    try {
      await Clipboard.setStringAsync(referralCode);
      modal.alert('Copied', `Referral code copied:\n${referralCode}`, 'success');
    } catch {
      modal.alert('Copy failed', 'Could not access the clipboard. Please try again.', 'error');
    }
  };

  const handleShare = async () => {
    if (!referralCode) return;
    haptics.tap();
    try {
      await Share.share({
        message: `Join me on Kudi! Use my referral code ${referralCode} when you sign up.`
      });
    } catch {
      // sharing dismissed or unavailable
    }
  };

  const tileTint = hexToRgba(palette.text, 0.07);

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
        <Text style={[Typography.title1, { color: palette.text }]}>Referrals</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── Referral code card ── */}
        <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>
          YOUR REFERRAL CODE
        </Text>
        <View style={[styles.codeCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={[styles.codeIconTile, { backgroundColor: hexToRgba(palette.primary, 0.14) }]}>
            <Gift size={26} color={palette.primary} />
          </View>
          {isLoading ? (
            <AnimatedSkeleton width={160} height={30} borderRadius={8} />
          ) : referralCode ? (
            <Text style={[styles.codeText, { color: palette.text }]} accessibilityLabel={`Referral code ${referralCode}`}>
              {referralCode}
            </Text>
          ) : (
            <Text style={[styles.codeText, { color: hexToRgba(palette.text, 0.35) }]}>————</Text>
          )}
          <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5), textAlign: 'center' }]}>
            Share it with friends so you can send to each other faster
          </Text>
          {isError && (
            <Pressable onPress={() => refetch()} hitSlop={8} style={styles.retryLink}>
              <RotateCcw size={13} color={palette.textSecondary} />
              <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                {isRefetching ? 'Retrying…' : "Couldn't load your code. Tap to retry."}
              </Text>
            </Pressable>
          )}
        </View>

        {/* ── Copy / Share ── */}
        <View style={styles.actionRow}>
          <Pressable
            onPress={handleCopy}
            disabled={!referralCode}
            accessibilityRole="button"
            accessibility-label="Copy referral code"
            style={({ pressed }) => [
              styles.primaryBtn,
              { backgroundColor: palette.text },
              (!referralCode || pressed) && { opacity: 0.6 }
            ]}
          >
            <Copy size={17} color={palette.bg} />
            <Text style={[Typography.currencySub, { color: palette.bg, fontSize: 14 }]}>Copy Code</Text>
          </Pressable>

          <Pressable
            onPress={handleShare}
            disabled={!referralCode}
            accessibilityRole="button"
            accessibility-label="Share referral code"
            style={({ pressed }) => [
              styles.secondaryBtn,
              { backgroundColor: hexToRgba(palette.text, 0.04), borderColor: palette.border },
              (!referralCode || pressed) && { opacity: 0.6 }
            ]}
          >
            <Share2 size={17} color={palette.text} />
            <Text style={[Typography.currencySub, { color: palette.text, fontSize: 14 }]}>Share</Text>
          </Pressable>
        </View>

        {/* ── Invited friends ── */}
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>
            INVITED FRIENDS{invitedCount > 0 ? ` · ${invitedCount}` : ''}
          </Text>

          {isLoading ? (
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {[0, 1].map((i) => (
                <View key={i} style={[styles.invitedRow, i > 0 && { borderTopWidth: 1, borderTopColor: palette.border }]}>
                  <AnimatedSkeleton width={40} height={40} borderRadius={20} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <AnimatedSkeleton width={120} height={13} borderRadius={4} />
                    <AnimatedSkeleton width={80} height={10} borderRadius={4} />
                  </View>
                  <AnimatedSkeleton width={64} height={12} borderRadius={4} />
                </View>
              ))}
            </View>
          ) : isError ? (
            <View style={[styles.groupCard, styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Pressable onPress={() => refetch()} style={styles.emptyWrap}>
                <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                  <RotateCcw size={19} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <Text style={[styles.rowTitle, { color: palette.text }]}>Couldn't load invites</Text>
                <Text style={[styles.rowSubtitle, { color: hexToRgba(palette.text, 0.5) }]}>
                  Check your connection and try again
                </Text>
              </Pressable>
            </View>
          ) : invited.length === 0 ? (
            <View style={[styles.groupCard, styles.emptyCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                <Users size={19} color={palette.textSecondary} strokeWidth={1.9} />
              </View>
              <Text style={[styles.rowTitle, { color: palette.text }]}>No invites yet</Text>
              <Text style={[styles.rowSubtitle, { color: hexToRgba(palette.text, 0.5), textAlign: 'center' }]}>
                Share your code — friends who join with it will appear here
              </Text>
            </View>
          ) : (
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {invited.map((invite, index) => (
                <React.Fragment key={invite.id}>
                  {index > 0 && <View style={[styles.invitedDivider, { backgroundColor: palette.border }]} />}
                  <View style={styles.invitedRow}>
                    <Avatar avatarUrl={invite.avatarUrl} seed={invite.name} size={40} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>
                        {invite.name}
                      </Text>
                      {invite.username ? (
                        <Text style={[styles.rowSubtitle, { color: hexToRgba(palette.text, 0.5) }]} numberOfLines={1}>
                          {invite.username.startsWith('@') ? invite.username : `@${invite.username}`}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={[styles.joinedDate, { color: hexToRgba(palette.text, 0.4) }]}>
                      {formatJoinedDate(invite.joinedAt)}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </View>

        {/* ── How it works ── */}
        <View style={styles.group}>
          <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>HOW IT WORKS</Text>
          <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {STEPS.map(({ Icon, title, subtitle }, index) => (
              <React.Fragment key={title}>
                {index > 0 && <View style={[styles.divider, { backgroundColor: palette.border }]} />}
                <View style={styles.row}>
                  <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                    <Icon size={19} color={palette.textSecondary} strokeWidth={1.9} />
                  </View>
                  <View style={styles.rowCopy}>
                    <Text style={[styles.rowTitle, { color: palette.text }]}>{title}</Text>
                    <Text style={[styles.rowSubtitle, { color: hexToRgba(palette.text, 0.5) }]}>{subtitle}</Text>
                  </View>
                  <Text style={[styles.stepNumber, { color: hexToRgba(palette.text, 0.3) }]}>
                    0{index + 1}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </View>

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
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4
  },
  codeCard: {
    alignItems: 'center',
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    gap: 8
  },
  codeIconTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4
  },
  codeText: {
    fontFamily: Typography.family.mono,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 4,
    fontVariant: ['tabular-nums']
  },
  retryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12
  },
  primaryBtn: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
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
  group: { gap: 8, marginTop: 6 },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 20,
    gap: 8
  },
  emptyWrap: {
    alignItems: 'center',
    gap: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  invitedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  divider: {
    height: 1,
    marginLeft: 66
  },
  invitedDivider: {
    height: 1,
    marginLeft: 66
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  rowCopy: { flex: 1 },
  rowTitle: {
    fontFamily: Typography.family.sans,
    fontSize: 15,
    lineHeight: 20
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 17,
    marginTop: 1
  },
  joinedDate: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 0.4
  },
  stepNumber: {
    fontFamily: Typography.family.mono,
    fontSize: 12,
    letterSpacing: 1
  }
});
