import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Linking
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette, isLight } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HelpSupportScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const light = isLight(palette.bg);

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  const faqs = [
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

  const handleOpenWhatsApp = () => {
    Linking.openURL('https://wa.me/2348000000000?text=Hello%20Kudi%20Support%2C%20I%20need%20assistance');
  };

  const handleOpenEmail = () => {
    Linking.openURL('mailto:support@kudi.app?subject=Kudi%20Support%20Request');
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title2, { color: palette.text }]}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Support Direct Contact Options */}
        <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 8, letterSpacing: 0.5 }]}>
          GET IN TOUCH WITH US
        </Text>

        <TouchableOpacity
          style={[styles.contactCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={handleOpenWhatsApp}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#25D36620' }]}>
            <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
          </View>
          <View style={styles.contactText}>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>Chat on WhatsApp</Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
              Instant support (Mon - Sun, 8am - 10pm)
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color={palette.textSecondary} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.contactCard, { backgroundColor: palette.card, borderColor: palette.border }]}
          onPress={handleOpenEmail}
          activeOpacity={0.7}
        >
          <View style={[styles.iconBox, { backgroundColor: '#3B82F620' }]}>
            <Ionicons name="mail-outline" size={24} color="#3B82F6" />
          </View>
          <View style={styles.contactText}>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>Email Support</Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>
              support@kudi.app • Response within 2 hrs
            </Text>
          </View>
          <Ionicons name="open-outline" size={18} color={palette.textSecondary} />
        </TouchableOpacity>

        {/* FAQs */}
        <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 24, marginBottom: 8, letterSpacing: 0.5 }]}>
          FREQUENTLY ASKED QUESTIONS
        </Text>

        {faqs.map((faq, idx) => {
          const isExpanded = expandedFaq === idx;
          return (
            <TouchableOpacity
              key={idx}
              style={[styles.faqCard, { backgroundColor: palette.card, borderColor: palette.border }]}
              onPress={() => setExpandedFaq(isExpanded ? null : idx)}
              activeOpacity={0.8}
            >
              <View style={styles.faqHeader}>
                <Text style={[Typography.bodyBold, { color: palette.text, flex: 1, paddingRight: 8 }]}>
                  {faq.q}
                </Text>
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={palette.textSecondary}
                />
              </View>
              {isExpanded && (
                <Text style={[Typography.subhead, { color: palette.textSecondary, marginTop: 10, lineHeight: 20 }]}>
                  {faq.a}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}

        {/* App Version Info */}
        <View style={styles.footerInfo}>
          <Ionicons name="heart" size={16} color="#EF4444" />
          <Text style={[Typography.caption, { color: palette.textSecondary, marginLeft: 6 }]}>
            Kudi Wallet v1.0.0 • Built for fast off-ramping
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center'
  },
  contactText: {
    flex: 1,
    marginLeft: 12
  },
  faqCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32
  }
});
