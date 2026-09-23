import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, Easing } from 'react-native';
import {
  Wifi,
  Copy,
  Check,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Plus,
  ShieldCheck,
  Building2,
  Sparkles,
  Zap
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAppPalette } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { useBalance } from '../../src/hooks/useBalance';
import { useVirtualAccounts } from '../../src/hooks/useVirtualAccounts';
import { AppModal, useAppModal } from '../../src/components/ui/AppModal';

export default function CardTab() {
  const palette = useAppPalette();
  const modal = useAppModal();
  const { data: balanceData } = useBalance();
  const { data: virtualAccounts = [] } = useVirtualAccounts();

  const [selectedCard, setSelectedCard] = useState<0 | 1>(0);
  const [showDetails, setShowDetails] = useState<boolean>(false);
  const [isFrozen, setIsFrozen] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Balance calculations
  const balanceUSDC = balanceData?.balanceUSDC || 0;
  const rateNGN = balanceData?.currentRateNGN || 1585.5;
  const balanceNGN = balanceUSDC * rateNGN;

  // Virtual account lookups
  const ngnAccount = virtualAccounts.find(a => a.currency === 'NGN');
  const usdAccount = virtualAccounts.find(a => a.currency === 'USD');

  // Standard React Native Animated values
  const floatY = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const cardOpacity = useRef(new Animated.Value(1)).current;

  // Continuous floating animation
  useEffect(() => {
    const floatAnim = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, {
          toValue: -6,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        }),
        Animated.timing(floatY, {
          toValue: 0,
          duration: 2500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true
        })
      ])
    );
    floatAnim.start();
    return () => floatAnim.stop();
  }, [floatY]);

  // Handle card switch animation trigger
  const handleSelectCard = (idx: 0 | 1) => {
    if (selectedCard === idx) return;

    Haptics.selectionAsync().catch(() => {});
    cardScale.setValue(0.92);
    cardOpacity.setValue(0.6);

    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 5,
        tension: 100,
        useNativeDriver: true
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      })
    ]).start();

    setSelectedCard(idx);
    setShowDetails(false);
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Ignore transient clipboard errors
    }
  };

  const toggleFreeze = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    const nextState = !isFrozen;
    setIsFrozen(nextState);
    if (nextState) {
      modal.alert('Card Frozen ❄️', 'Your card has been temporaily frozen. All new transactions will be declined until unfrozen.', 'info');
    } else {
      modal.alert('Card Active ⚡', 'Your card is active and ready for online payments.', 'success');
    }
  };

  const handleTopUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    modal.alert(
      'Card Top Up 💳',
      `Your virtual card automatically draws balance from your Metropolis wallet (${currentCard.id === 'ngn' ? `₦${balanceNGN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN` : `$${balanceUSDC.toFixed(2)} USD`}). Deposit USDC or NGN to instantly increase your card limit.`,
      'info'
    );
  };

  const cards = [
    {
      id: 'usd',
      name: 'Kudi USD Virtual Card',
      brand: 'VISA',
      currencySymbol: '$',
      currencyCode: 'USD',
      balanceDisplay: `$${balanceUSDC.toFixed(2)} USD`,
      subBalance: `~₦${balanceNGN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN`,
      maskedNumber: '•••• •••• •••• 5678',
      fullNumber: '4111 2309 5678 9921',
      cvv: '719',
      expires: '08/28',
      type: 'Visa International Debit',
      bgDark: '#1E293B',
      bgLight: '#F1F5F9',
      accentColor: '#34D399',
      linkedBank: usdAccount ? `${usdAccount.bankName} • Acc: ${usdAccount.accountNumber}` : 'Lead Bank • ACH Account: 9876543210'
    },
    {
      id: 'ngn',
      name: 'Kudi NGN Virtual Card',
      brand: 'Mastercard',
      currencySymbol: '₦',
      currencyCode: 'NGN',
      balanceDisplay: `₦${balanceNGN.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN`,
      subBalance: `~$${balanceUSDC.toFixed(2)} USDC equivalent`,
      maskedNumber: '•••• •••• •••• 9012',
      fullNumber: '5399 4812 9012 4410',
      cvv: '482',
      expires: '12/28',
      type: 'Mastercard Domestic',
      bgDark: '#0F172A',
      bgLight: '#E2E8F0',
      accentColor: '#60A5FA',
      linkedBank: ngnAccount ? `${ngnAccount.bankName} • Acc: ${ngnAccount.accountNumber}` : 'GTBank • NUBAN: 0123456789'
    }
  ];

  const currentCard = cards[selectedCard];
  const isDark = palette.text === '#FFFFFF';

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header Title */}
      <View style={styles.headerRow}>
        <View>
          <Text style={[Typography.title1, { color: palette.text }]}>Virtual Cards</Text>
          <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
            Instant global USD & local NGN payment cards
          </Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: isFrozen ? 'rgba(239, 68, 68, 0.12)' : 'rgba(16, 185, 129, 0.12)', borderColor: isFrozen ? '#EF4444' : palette.success }]}>
          <View style={[styles.statusDot, { backgroundColor: isFrozen ? '#EF4444' : palette.success }]} />
          <Text style={[Typography.caption, { color: isFrozen ? '#EF4444' : palette.success, fontWeight: '700' }]}>
            {isFrozen ? 'FROZEN' : 'ACTIVE'}
          </Text>
        </View>
      </View>

      {/* Card Selector Tabs */}
      <View style={styles.cardSelectorRow}>
        {cards.map((card, idx) => (
          <TouchableOpacity
            key={card.id}
            onPress={() => handleSelectCard(idx as 0 | 1)}
            activeOpacity={0.8}
            style={[
              styles.cardSelectTab,
              {
                backgroundColor: selectedCard === idx
                  ? (isDark ? 'rgba(255, 255, 255, 0.15)' : '#0F172A')
                  : palette.card,
                borderColor: palette.border
              }
            ]}
          >
            <Text
              style={[
                Typography.footnote,
                {
                  color: selectedCard === idx ? '#FFFFFF' : palette.textSecondary,
                  fontWeight: selectedCard === idx ? '700' : '500'
                }
              ]}
            >
              {card.id.toUpperCase()} CARD
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* PROMINENT LIVE VIRTUAL CARD BALANCE SECTION */}
      <View style={[styles.balanceSection, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[Typography.caption, { color: palette.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }]}>
          {currentCard.name} Available Balance
        </Text>

        <Text style={[Typography.currencyDisplay, styles.mainBalanceText, { color: palette.text }]}>
          {currentCard.balanceDisplay}
        </Text>

        <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
          {currentCard.subBalance}
        </Text>
      </View>

      {/* Animated Floating Virtual Card Graphic */}
      <View style={styles.cardsWrapper}>
        <Animated.View
          style={[
            styles.metallicCard,
            {
              transform: [
                { translateY: floatY },
                { scale: cardScale }
              ],
              opacity: isFrozen ? 0.65 : cardOpacity,
              backgroundColor: isDark ? currentCard.bgDark : currentCard.bgLight,
              borderColor: isFrozen ? '#EF4444' : currentCard.accentColor,
              borderWidth: 1.5
            }
          ]}
        >
          {/* Subtle Background Pattern Layer */}
          <View style={styles.patternContainer} pointerEvents="none">
            <View
              style={[
                styles.patternRingOuter,
                { borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(15, 23, 42, 0.06)' }
              ]}
            />
            <View
              style={[
                styles.patternRingInner,
                { borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.05)' }
              ]}
            />
            <View
              style={[
                styles.patternGlow,
                { backgroundColor: currentCard.accentColor, opacity: 0.1 }
              ]}
            />
          </View>

          {/* Card Top Row: Brand & Balance Badge */}
          <View style={styles.cardTopRow}>
            <View style={styles.brandGroup}>
              <Text style={[Typography.title2, { color: palette.text, fontWeight: '800' }]}>Kudi</Text>
              <Text style={[Typography.footnote, { color: palette.textSecondary, marginLeft: 6 }]}>
                {currentCard.id.toUpperCase()}
              </Text>
            </View>

            <View style={styles.cardHeaderRight}>
              <Text style={[Typography.bodyBold, { color: currentCard.accentColor }]}>
                {currentCard.balanceDisplay}
              </Text>
            </View>
          </View>

          {/* Card Chip & Wireless Row */}
          <View style={styles.cardChipRow}>
            <View style={[styles.cardChip, { backgroundColor: isDark ? '#475569' : '#CBD5E1' }]}>
              <View style={[styles.chipLine, { backgroundColor: isDark ? '#334155' : '#94A3B8' }]} />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {isFrozen && (
                <View style={[styles.frozenPill, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
                  <Lock size={12} color="#EF4444" />
                  <Text style={{ fontSize: 10, fontWeight: '700', color: '#EF4444' }}>FROZEN</Text>
                </View>
              )}
              <Wifi size={24} color={palette.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
            </View>
          </View>

          {/* Card Bottom Row: Number, Expiry, Brand */}
          <View style={styles.cardBottomRow}>
            <Text style={[Typography.currencyDisplay, { color: palette.text, fontSize: 18, letterSpacing: 2 }]}>
              {showDetails ? currentCard.fullNumber : currentCard.maskedNumber}
            </Text>

            <View style={styles.cardMetaRow}>
              <View>
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>EXPIRES</Text>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>{currentCard.expires}</Text>
              </View>

              <View>
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>CVV</Text>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>{showDetails ? currentCard.cvv : '•••'}</Text>
              </View>

              <View style={{ marginLeft: 'auto' }}>
                <Text style={[Typography.title2, { color: palette.text, fontStyle: 'italic', fontWeight: '900' }]}>
                  {currentCard.brand}
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>
      </View>

      {/* Card Quick Actions */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity
          onPress={() => setShowDetails(!showDetails)}
          style={[styles.actionIconButton, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.8}
        >
          {showDetails ? <EyeOff size={18} color={palette.text} /> : <Eye size={18} color={palette.text} />}
          <Text style={[Typography.caption, { color: palette.text, fontWeight: '600', marginTop: 4 }]}>
            {showDetails ? 'Hide' : 'Details'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => copyToClipboard(showDetails ? currentCard.fullNumber : currentCard.maskedNumber, 'cardNum')}
          style={[styles.actionIconButton, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.8}
        >
          {copiedField === 'cardNum' ? <Check size={18} color={palette.success} /> : <Copy size={18} color={palette.text} />}
          <Text style={[Typography.caption, { color: copiedField === 'cardNum' ? palette.success : palette.text, fontWeight: '600', marginTop: 4 }]}>
            {copiedField === 'cardNum' ? 'Copied' : 'Copy Num'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleTopUp}
          style={[styles.actionIconButton, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.8}
        >
          <Plus size={18} color={palette.text} />
          <Text style={[Typography.caption, { color: palette.text, fontWeight: '600', marginTop: 4 }]}>
            Top Up
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={toggleFreeze}
          style={[styles.actionIconButton, { backgroundColor: palette.card, borderColor: isFrozen ? '#EF4444' : palette.border }]}
          activeOpacity={0.8}
        >
          {isFrozen ? <Unlock size={18} color="#EF4444" /> : <Lock size={18} color={palette.text} />}
          <Text style={[Typography.caption, { color: isFrozen ? '#EF4444' : palette.text, fontWeight: '600', marginTop: 4 }]}>
            {isFrozen ? 'Unfreeze' : 'Freeze'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Linked Bank Account Details Box */}
      <View style={[styles.detailsCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <View style={styles.detailsHeader}>
          <Building2 size={20} color={palette.text} />
          <Text style={[Typography.bodyBold, { color: palette.text, flex: 1 }]}>
            Linked Bank Account Details
          </Text>
        </View>

        <View style={styles.detailsContentRow}>
          <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
            {currentCard.linkedBank}
          </Text>

          <TouchableOpacity
            onPress={() => copyToClipboard(currentCard.linkedBank, 'linkedBank')}
            style={[styles.smallCopyBtn, { backgroundColor: palette.bg, borderColor: palette.border }]}
            activeOpacity={0.7}
          >
            {copiedField === 'linkedBank' ? (
              <Check size={14} color={palette.success} />
            ) : (
              <Copy size={14} color={palette.textSecondary} />
            )}
            <Text style={[Typography.caption, { color: copiedField === 'linkedBank' ? palette.success : palette.textSecondary, fontSize: 11, fontWeight: '600' }]}>
              {copiedField === 'linkedBank' ? 'Copied' : 'Copy'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Card Features Showcase */}
      <View style={[styles.featuresCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        <Text style={[Typography.bodyBold, { color: palette.text, marginBottom: 12 }]}>
          Card Benefits & Security
        </Text>

        <View style={styles.featureItem}>
          <Zap size={16} color={palette.success} />
          <Text style={[Typography.footnote, { color: palette.textSecondary, flex: 1 }]}>
            Zero-fee automated top-ups directly from your wallet balance
          </Text>
        </View>

        <View style={styles.featureItem}>
          <ShieldCheck size={16} color="#60A5FA" />
          <Text style={[Typography.footnote, { color: palette.textSecondary, flex: 1 }]}>
            Instant freeze & unfreeze security controls with 1-tap protection
          </Text>
        </View>

        <View style={styles.featureItem}>
          <Sparkles size={16} color="#8B5CF6" />
          <Text style={[Typography.footnote, { color: palette.textSecondary, flex: 1 }]}>
            Accepted at millions of online merchants globally with no FX markups
          </Text>
        </View>
      </View>

      {/* Modal */}
      <AppModal config={modal.config} onClose={modal.hide} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 110,
    alignItems: 'stretch'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  cardSelectorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 16
  },
  cardSelectTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1
  },
  balanceSection: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16
  },
  mainBalanceText: {
    fontSize: 26,
    marginVertical: 4
  },
  cardsWrapper: {
    alignItems: 'center',
    marginBottom: 16
  },
  metallicCard: {
    width: '100%',
    borderRadius: 22,
    padding: 20,
    height: 215,
    justifyContent: 'space-between',
    position: 'relative',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8
  },
  patternContainer: { ...(StyleSheet.absoluteFill as any) },
  patternRingOuter: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5
  },
  patternRingInner: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1
  },
  patternGlow: {
    position: 'absolute',
    top: -30,
    right: 10,
    width: 150,
    height: 150,
    borderRadius: 75
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'baseline'
  },
  cardHeaderRight: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.08)'
  },
  cardChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8
  },
  cardChip: {
    width: 38,
    height: 28,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 4
  },
  chipLine: {
    height: 1,
    width: '100%'
  },
  frozenPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  cardBottomRow: {
    marginTop: 'auto'
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginTop: 10
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 16
  },
  actionIconButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1
  },
  detailsCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8
  },
  detailsContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  smallCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1
  },
  featuresCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10
  }
});
