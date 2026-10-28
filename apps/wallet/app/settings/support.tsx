import React, { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { ArrowLeft, ChevronDown, ExternalLink, Mail, MessageCircle } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppPalette, hexToRgba } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { Spacing } from '../../src/constants/spacing';
import { EnterSection } from '../../src/lib/animations';
import { AppVersionFooter } from '../../src/components/AppVersionFooter';
import { haptics } from '../../src/lib/haptics';

const FAQS = [
  {
    q: 'How fast are crypto deposits processed?',
    a: 'Solana deposits process in under 10 seconds. Monad devnet deposits process within 1-2 minutes after blockchain confirmation.'
  },
  {
    q: 'How does spending/off-ramping to NGN work?',
    a: 'When you spend or send NGN to a bank account, Kudi converts your selected token (USDC, AUSD, or NGNC) into Naira at live rates and sends NGN straight to the destination bank.'
  },
  {
    q: 'Are my crypto funds secure?',
    a: 'Yes! Kudi uses Privy embedded non-custodial wallets. Your keys are securely encrypted and only accessible through your authenticated session.'
  },
  {
    q: 'What should I do if a bank transfer is delayed?',
    a: 'Bank transfers usually process in seconds. If delayed beyond 5 minutes, check your transaction history for status updates or reach out to support via WhatsApp.'
  }
];

const CHEVRON_SPRING = { stiffness: 400, damping: 25, mass: 0.6 };
const HEIGHT_DURATION = 220;

function FaqItem({
  q,
  a,
  isOpen,
  onToggle,
  isFirst
}: {
  q: string;
  a: string;
  isOpen: boolean;
  onToggle: () => void;
  isFirst: boolean;
}) {
  const palette = useAppPalette();
  const progress = useSharedValue(0);
  const chevron = useSharedValue(0);
  const contentHeight = useSharedValue(0);

  useEffect(() => {
    progress.set(withTiming(isOpen ? 1 : 0, { duration: HEIGHT_DURATION }));
    chevron.set(withSpring(isOpen ? 1 : 0, CHEVRON_SPRING));
  }, [isOpen, progress, chevron]);

  const answerStyle = useAnimatedStyle(() => ({
    height: contentHeight.value * progress.value,
    opacity: progress.value,
    overflow: 'hidden' as const
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: `${interpolate(chevron.value, [0, 1], [0, 180], Extrapolation.CLAMP)}deg`
      }
    ]
  }));

  return (
    <>
      {!isFirst && <View style={[styles.divider, { backgroundColor: palette.border }]} />}
      <Pressable
        onPress={() => {
          haptics.tap();
          onToggle();
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        style={({ pressed }) => [styles.faqRow, pressed && { backgroundColor: hexToRgba(palette.text, 0.04) }]}
      >
        <View style={styles.faqHeader}>
          <Text style={[Typography.currencySub, { color: palette.text, flex: 1, paddingRight: 12 }]}>{q}</Text>
          <Animated.View style={chevronStyle}>
            <ChevronDown size={18} color={palette.textSecondary} />
          </Animated.View>
        </View>
        <Animated.View style={answerStyle}>
          <View
            onLayout={(e) => {
              contentHeight.value = e.nativeEvent.layout.height;
            }}
            style={styles.faqAnswerWrap}
          >
            <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.6), lineHeight: 20 }]}>
              {a}
            </Text>
          </View>
        </Animated.View>
      </Pressable>
    </>
  );
}

export default function HelpSupportScreen() {
  const palette = useAppPalette();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleOpenWhatsApp = () => {
    Linking.openURL('https://wa.me/2348000000000?text=Hello%20Kudi%20Support%2C%20I%20need%20assistance');
  };

  const handleOpenEmail = () => {
    Linking.openURL('mailto:support@kudi.app?subject=Kudi%20Support%20Request');
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
        <Text style={[Typography.title1, { color: palette.text }]}>Support</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Contact ── */}
        <EnterSection index={0}>
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>CONTACT</Text>
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Pressable
                onPress={handleOpenWhatsApp}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: hexToRgba(palette.text, 0.05) }]}
              >
                <View style={[styles.iconTile, { backgroundColor: hexToRgba('#25D366', 0.14) }]}>
                  <MessageCircle size={19} color="#25D366" strokeWidth={1.9} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>Chat on WhatsApp</Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    Instant support (Mon – Sun, 8am – 10pm)
                  </Text>
                </View>
                <ExternalLink size={16} color={hexToRgba(palette.text, 0.35)} />
              </Pressable>

              <View style={[styles.divider, { backgroundColor: palette.border }]} />

              <Pressable
                onPress={handleOpenEmail}
                accessibilityRole="button"
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: hexToRgba(palette.text, 0.05) }]}
              >
                <View style={[styles.iconTile, { backgroundColor: tileTint }]}>
                  <Mail size={19} color={palette.textSecondary} strokeWidth={1.9} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[Typography.currencySub, { color: palette.text }]}>Email Support</Text>
                  <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.5) }]}>
                    support@kudi.app • Response within 2 hrs
                  </Text>
                </View>
                <ExternalLink size={16} color={hexToRgba(palette.text, 0.35)} />
              </Pressable>
            </View>
          </View>
        </EnterSection>

        {/* ── FAQ ── */}
        <EnterSection index={1}>
          <View style={styles.group}>
            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>
              FREQUENTLY ASKED QUESTIONS
            </Text>
            <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
              {FAQS.map((faq, idx) => (
                <FaqItem
                  key={faq.q}
                  q={faq.q}
                  a={faq.a}
                  isOpen={openFaq === idx}
                  onToggle={() => setOpenFaq(openFaq === idx ? null : idx)}
                  isFirst={idx === 0}
                />
              ))}
            </View>
          </View>
        </EnterSection>

        <AppVersionFooter />
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
    paddingTop: 6,
    paddingBottom: 40,
    gap: 20
  },
  group: { gap: 8 },
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4
  },
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 13
  },
  divider: {
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
  faqRow: {
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  faqAnswerWrap: {
    paddingTop: 10,
    paddingRight: 8
  }
});
