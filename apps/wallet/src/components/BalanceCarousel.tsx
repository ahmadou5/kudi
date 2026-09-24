import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCodeSVG from 'react-native-qrcode-svg';
import { Copy, Check, ShieldCheck, Sparkles, Building2, Globe2, ArrowRight, X, QrCode, Share2 } from 'lucide-react-native';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { useVirtualAccounts, VirtualAccount } from '../hooks/useVirtualAccounts';
import { useAuthStore } from '../store/auth.store';
import { ChainLogo } from './ui/ChainLogo';
import { GorhomBottomSheet } from './ui/GorhomBottomSheet';
import { BalanceCardSkeleton } from './ui/AnimatedSkeleton';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CONTAINER_PADDING = 14;
const CARD_GAP = 28;
const CARD_WIDTH = SCREEN_WIDTH - CONTAINER_PADDING * 2;

interface BalanceCarouselProps {
  balanceUSDC: string;
  rateNGN: number;
  depositNotification?: { amountUSDC: number; chain: string } | null;
  isLoading?: boolean;
}

export const BalanceCarousel: React.FC<BalanceCarouselProps> = ({
  balanceUSDC,
  rateNGN,
  depositNotification,
  isLoading = false
}) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const user = useAuthStore(s => s.user);
  const wallets = useAuthStore(s => s.wallets);
  const { data: virtualAccounts = [] } = useVirtualAccounts();

  const [activeIndex, setActiveIndex] = useState<number>(0);
  const scrollViewRef = useRef<ScrollView>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Addresses for Solana and Monad
  const solanaAddress = wallets.find(w => w.chain === 'solana')?.address || 'Loading Solana address...';
  const monadAddress = wallets.find(w => w.chain?.includes('monad'))?.address || 'Loading Monad address...';

  // Bottom Sheet Modal State
  const [activeBottomSheet, setActiveBottomSheet] = useState<{
    type: 'crypto' | 'bank';
    cryptoChain?: 'solana' | 'monad';
    bankData?: {
      currency: string;
      title: string;
      flag: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      extraDetails?: string;
      transferType: string;
    };
  } | null>(null);

  const [selectedCryptoChain, setSelectedCryptoChain] = useState<'solana' | 'monad'>('solana');

  // User KYC tier check
  const rawTier = user?.kycTier;
  const kycTierNum =
    rawTier === '2' || rawTier === 'TIER_2'
      ? 2
      : rawTier === '1' || rawTier === 'TIER_1' || user?.kycStatus === 'VERIFIED'
        ? 1
        : 0;

  // On-Chain balance calculations & deposit pulse animation
  const numericBalance = parseFloat(balanceUSDC) || 0;
  const ngnEquivalent = numericBalance * rateNGN;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const badgeYAnim = useRef(new Animated.Value(20)).current;
  const badgeOpacityAnim = useRef(new Animated.Value(0)).current;
  const prevBalanceRef = useRef<number>(numericBalance);
  const [depositDelta, setDepositDelta] = useState<number | null>(null);

  useEffect(() => {
    const prev = prevBalanceRef.current;
    if (numericBalance > prev && prev !== 0) {
      const diff = numericBalance - prev;
      setDepositDelta(diff);

      Animated.parallel([
        Animated.sequence([
          Animated.spring(scaleAnim, { toValue: 1.03, friction: 5, tension: 140, useNativeDriver: true }),
          Animated.spring(scaleAnim, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0, duration: 1200, useNativeDriver: true })
        ]),
        Animated.sequence([
          Animated.parallel([
            Animated.spring(badgeYAnim, { toValue: 0, friction: 6, tension: 120, useNativeDriver: true }),
            Animated.timing(badgeOpacityAnim, { toValue: 1, duration: 250, useNativeDriver: true })
          ]),
          Animated.delay(4000),
          Animated.parallel([
            Animated.timing(badgeYAnim, { toValue: -15, duration: 300, useNativeDriver: true }),
            Animated.timing(badgeOpacityAnim, { toValue: 0, duration: 300, useNativeDriver: true })
          ])
        ])
      ]).start(() => {
        badgeYAnim.setValue(20);
      });
    }
    prevBalanceRef.current = numericBalance;
  }, [numericBalance]);

  // Strict lookup of real virtual accounts without fallback demo mock data
  const ngnAccount: VirtualAccount | undefined = virtualAccounts.find(
    a => a.currency === 'NGN' || (a.bankName && a.bankName.toLowerCase().includes('gtb'))
  );

  const usdAccount: VirtualAccount | undefined = virtualAccounts.find(
    a => a.currency === 'USD'
  );

  const eurAccount: VirtualAccount | undefined = virtualAccounts.find(
    a => a.currency === 'EUR'
  );

  const cardsData = [
    { id: 'onchain', title: 'On-Chain', icon: '⚡' },
    { id: 'ngn', title: 'NGN Account', icon: '🇳🇬' },
    { id: 'usd', title: 'USD Account', icon: '🇺🇸' },
    { id: 'eur', title: 'EUR Account', icon: '🇪🇺' }
  ];

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / (CARD_WIDTH + CARD_GAP));
    if (index >= 0 && index < cardsData.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  const scrollToIndex = (index: number) => {
    setActiveIndex(index);
    scrollViewRef.current?.scrollTo({ x: index * (CARD_WIDTH + CARD_GAP), animated: true });
    Haptics.selectionAsync().catch(() => { });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
      setCopiedField(label);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Ignore transient clipboard errors
    }
  };

  const openCryptoDepositSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setActiveBottomSheet({ type: 'crypto', cryptoChain: selectedCryptoChain });
  };

  const openBankDepositSheet = (account: VirtualAccount, flag: string, transferType: string, extraDetails?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    setActiveBottomSheet({
      type: 'bank',
      bankData: {
        currency: account.currency,
        title: `${account.currency} Virtual Bank Account`,
        flag,
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        extraDetails,
        transferType
      }
    });
  };

  const currentCryptoAddress = selectedCryptoChain === 'solana' ? solanaAddress : monadAddress;
  const currentTokenSymbol = selectedCryptoChain === 'solana' ? 'USDC' : 'AUSD';
  const currentChainName = selectedCryptoChain === 'solana' ? 'Solana Devnet' : 'Monad Testnet';

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingHorizontal: CONTAINER_PADDING }]}>
        <BalanceCardSkeleton />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Horizontal Cards ScrollView */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        snapToInterval={CARD_WIDTH + CARD_GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        {/* CARD 1: On-Chain Wallet Balance */}
        <Animated.View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              marginRight: CARD_GAP,
              backgroundColor: palette.card,
              borderColor: palette.border,
              transform: [{ scale: scaleAnim }]
            }
          ]}
        >
          <Animated.View
            style={[
              styles.glowOverlay,
              {
                backgroundColor: palette.success,
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.18]
                })
              }
            ]}
            pointerEvents="none"
          />

          <View style={styles.patternContainer} pointerEvents="none">
            <View style={[styles.patternRingOuter, { borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)' }]} />
            <View style={[styles.patternRingInner, { borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)' }]} />
            <View style={[styles.patternGlow, { backgroundColor: isDark ? 'rgba(52, 211, 153, 0.06)' : 'rgba(16, 185, 129, 0.05)' }]} />
          </View>

          <View style={styles.cardHeaderRow}>
            <View style={styles.badgeRow}>

              <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                Available On-Chain Balance
              </Text>
            </View>

            {depositDelta !== null && (
              <Animated.View
                style={[
                  styles.depositBadge,
                  {
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    borderColor: palette.success,
                    opacity: badgeOpacityAnim,
                    transform: [{ translateY: badgeYAnim }]
                  }
                ]}
              >
                <Text style={[Typography.caption, { color: palette.success, fontWeight: '700' }]}>
                  +${depositDelta.toFixed(2)} USDC
                </Text>
              </Animated.View>
            )}
          </View>

          <Text style={[Typography.currencyDisplay, styles.balanceValue, { color: palette.text }]}>
            ${balanceUSDC} <Text style={[Typography.title2, { color: palette.textSecondary }]}>USDC</Text>
          </Text>

          <Text style={[Typography.bodyBold, styles.subBalance, { color: palette.success }]}>
            ₦{ngnEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN{' '}
            <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
              (1 USDC = ₦{rateNGN})
            </Text>
          </Text>

          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={openCryptoDepositSheet}
              style={[styles.actionBtn, { backgroundColor: palette.text, borderColor: palette.border }]}
              activeOpacity={0.8}
            >
              <Text style={[Typography.bodyBold, { color: palette.bg }]}>Deposit</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push('/(tabs)/spend')}
              style={[styles.actionBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
              activeOpacity={0.8}
            >
              <Text style={[Typography.bodyBold, { color: palette.text }]}>Spend</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* CARD 2: NGN Virtual Account Card */}
        <View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              marginRight: CARD_GAP,
              backgroundColor: palette.card,
              borderColor: palette.border
            }
          ]}
        >
          <View style={styles.patternContainer} pointerEvents="none">
            <View style={[styles.patternRingOuter, { borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)' }]} />
            <View style={[styles.patternRingInner, { borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)' }]} />
            <View style={[styles.patternGlow, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.07)' : 'rgba(16, 185, 129, 0.05)' }]} />
          </View>

          <View style={styles.cardHeaderRow}>
            <View style={styles.badgeRow}>
              <Text style={{ fontSize: 14 }}>🇳🇬</Text>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                NGN Virtual Account
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: ngnAccount ? 'rgba(16, 185, 129, 0.12)' : 'rgba(234, 179, 8, 0.12)', borderColor: ngnAccount ? palette.success : '#EAB308' }]}>
              <Text style={[Typography.caption, { color: ngnAccount ? palette.success : '#EAB308', fontWeight: '700' }]}>
                {ngnAccount ? 'Active NUBAN' : 'Requires KYC'}
              </Text>
            </View>
          </View>

          {ngnAccount ? (
            <>
              <View style={styles.accountNumberContainer}>
                <Text style={[Typography.currencySub, styles.accountNumText, { color: palette.text }]}>
                  {ngnAccount.accountNumber}
                </Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(ngnAccount.accountNumber, 'ngn')}
                  style={[styles.copyBtn, { backgroundColor: palette.bg, borderColor: palette.border }]}
                  activeOpacity={0.7}
                >
                  {copiedField === 'ngn' ? (
                    <Check size={16} color={palette.success} />
                  ) : (
                    <Copy size={16} color={palette.textSecondary} />
                  )}
                  <Text style={[Typography.caption, { color: copiedField === 'ngn' ? palette.success : palette.textSecondary, fontWeight: '600' }]}>
                    {copiedField === 'ngn' ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 4 }]}>
                {ngnAccount.bankName}
              </Text>
              <Text style={[Typography.footnote, { color: palette.textSecondary, marginBottom: 14 }]}>
                Account Name: {ngnAccount.accountName}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => openBankDepositSheet(ngnAccount, '🇳🇬', 'Instant Local Bank Transfer')}
                  style={[styles.actionBtn, { backgroundColor: palette.text, borderColor: palette.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                    Deposit NGN
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/spend')}
                  style={[styles.actionBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.bodyBold, { color: palette.text }]}>
                    Spend / Payout
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.kycPromptContainer}>
              <View style={styles.kycPromptHeader}>
                <Building2 size={24} color={palette.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bodyBold, { color: palette.text }]}>
                    Activate NGN Bank Account
                  </Text>
                  <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                    Zero-fee deposits & payouts in Naira via GTBank NUBAN
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/settings/limits')}
                style={[styles.kycCtaBtn, { backgroundColor: palette.text }]}
                activeOpacity={0.85}
              >
                <ShieldCheck size={18} color={palette.bg} />
                <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                  {kycTierNum >= 1 ? 'Generate Account' : 'Complete Tier 1 KYC'}
                </Text>
                <ArrowRight size={16} color={palette.bg} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CARD 3: USD Virtual Account Card */}
        <View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              marginRight: CARD_GAP,
              backgroundColor: palette.card,
              borderColor: palette.border
            }
          ]}
        >
          <View style={styles.patternContainer} pointerEvents="none">
            <View style={[styles.patternRingOuter, { borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)' }]} />
            <View style={[styles.patternRingInner, { borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)' }]} />
            <View style={[styles.patternGlow, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.07)' : 'rgba(59, 130, 246, 0.05)' }]} />
          </View>

          <View style={styles.cardHeaderRow}>
            <View style={styles.badgeRow}>
              <Text style={{ fontSize: 14 }}>🇺🇸</Text>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                USD Virtual Account
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: usdAccount ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)', borderColor: usdAccount ? palette.success : '#3B82F6' }]}>
              <Text style={[Typography.caption, { color: usdAccount ? palette.success : '#3B82F6', fontWeight: '700' }]}>
                {usdAccount ? 'Active ACH' : 'Tier 2 KYC'}
              </Text>
            </View>
          </View>

          {usdAccount ? (
            <>
              <View style={styles.accountNumberContainer}>
                <Text style={[Typography.currencySub, styles.accountNumText, { color: palette.text }]}>
                  {usdAccount.accountNumber}
                </Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(usdAccount.accountNumber, 'usd')}
                  style={[styles.copyBtn, { backgroundColor: palette.bg, borderColor: palette.border }]}
                  activeOpacity={0.7}
                >
                  {copiedField === 'usd' ? (
                    <Check size={16} color={palette.success} />
                  ) : (
                    <Copy size={16} color={palette.textSecondary} />
                  )}
                  <Text style={[Typography.caption, { color: copiedField === 'usd' ? palette.success : palette.textSecondary, fontWeight: '600' }]}>
                    {copiedField === 'usd' ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 4 }]}>
                {usdAccount.bankName}
              </Text>
              <Text style={[Typography.footnote, { color: palette.textSecondary, marginBottom: 14 }]}>
                Account Name: {usdAccount.accountName}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => openBankDepositSheet(usdAccount, '🇺🇸', 'ACH & Domestic Wire Transfer', 'Routing Number: 021000021')}
                  style={[styles.actionBtn, { backgroundColor: palette.text, borderColor: palette.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                    Deposit USD
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/spend')}
                  style={[styles.actionBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.bodyBold, { color: palette.text }]}>
                    Spend / Payout
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.kycPromptContainer}>
              <View style={styles.kycPromptHeader}>
                <Globe2 size={24} color={palette.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bodyBold, { color: palette.text }]}>
                    Get USD Virtual Account
                  </Text>
                  <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                    Receive domestic ACH & Wire transfers directly from US accounts
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/settings/limits')}
                style={[styles.kycCtaBtn, { backgroundColor: palette.text }]}
                activeOpacity={0.85}
              >
                <Sparkles size={18} color={palette.bg} />
                <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                  Upgrade to Tier 2 KYC
                </Text>
                <ArrowRight size={16} color={palette.bg} />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* CARD 4: EUR Virtual Account Card */}
        <View
          style={[
            styles.card,
            {
              width: CARD_WIDTH,
              marginRight: 0,
              backgroundColor: palette.card,
              borderColor: palette.border
            }
          ]}
        >
          <View style={styles.patternContainer} pointerEvents="none">
            <View style={[styles.patternRingOuter, { borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.05)' }]} />
            <View style={[styles.patternRingInner, { borderColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.04)' }]} />
            <View style={[styles.patternGlow, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.07)' : 'rgba(139, 92, 246, 0.05)' }]} />
          </View>

          <View style={styles.cardHeaderRow}>
            <View style={styles.badgeRow}>
              <Text style={{ fontSize: 14 }}>🇪🇺</Text>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                EUR Virtual IBAN
              </Text>
            </View>
            <View style={[styles.statusPill, { backgroundColor: eurAccount ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)', borderColor: eurAccount ? palette.success : '#3B82F6' }]}>
              <Text style={[Typography.caption, { color: eurAccount ? palette.success : '#3B82F6', fontWeight: '700' }]}>
                {eurAccount ? 'Active SEPA' : 'Tier 2 KYC'}
              </Text>
            </View>
          </View>

          {eurAccount ? (
            <>
              <View style={styles.accountNumberContainer}>
                <Text style={[Typography.currencySub, styles.accountNumText, { color: palette.text, fontSize: 16 }]} numberOfLines={1}>
                  {eurAccount.accountNumber}
                </Text>
                <TouchableOpacity
                  onPress={() => copyToClipboard(eurAccount.accountNumber, 'eur')}
                  style={[styles.copyBtn, { backgroundColor: palette.bg, borderColor: palette.border }]}
                  activeOpacity={0.7}
                >
                  {copiedField === 'eur' ? (
                    <Check size={16} color={palette.success} />
                  ) : (
                    <Copy size={16} color={palette.textSecondary} />
                  )}
                  <Text style={[Typography.caption, { color: copiedField === 'eur' ? palette.success : palette.textSecondary, fontWeight: '600' }]}>
                    {copiedField === 'eur' ? 'Copied' : 'Copy'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 4 }]}>
                {eurAccount.bankName}
              </Text>
              <Text style={[Typography.footnote, { color: palette.textSecondary, marginBottom: 14 }]}>
                Account Name: {eurAccount.accountName}
              </Text>

              <View style={styles.actionRow}>
                <TouchableOpacity
                  onPress={() => openBankDepositSheet(eurAccount, '🇪🇺', 'SEPA Instant Transfer', 'BIC / SWIFT: BNCKBEBB')}
                  style={[styles.actionBtn, { backgroundColor: palette.text, borderColor: palette.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                    Deposit EUR
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push('/(tabs)/spend')}
                  style={[styles.actionBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
                  activeOpacity={0.8}
                >
                  <Text style={[Typography.bodyBold, { color: palette.text }]}>
                    Spend / Payout
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <View style={styles.kycPromptContainer}>
              <View style={styles.kycPromptHeader}>
                <Globe2 size={24} color={palette.text} />
                <View style={{ flex: 1 }}>
                  <Text style={[Typography.bodyBold, { color: palette.text }]}>
                    Get EUR Virtual IBAN
                  </Text>
                  <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                    Receive Euro instantly across Europe via SEPA instant transfers
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => router.push('/settings/limits')}
                style={[styles.kycCtaBtn, { backgroundColor: palette.text }]}
                activeOpacity={0.85}
              >
                <Sparkles size={18} color={palette.bg} />
                <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                  Upgrade to Tier 2 KYC
                </Text>
                <ArrowRight size={16} color={palette.bg} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Pagination Pill Bar Indicator */}
      <View style={styles.paginationBar}>
        <View style={styles.dotsRow}>
          {cardsData.map((card, idx) => {
            const isActive = idx === activeIndex;
            return (
              <TouchableOpacity
                key={card.id}
                onPress={() => scrollToIndex(idx)}
                activeOpacity={0.7}
                style={[
                  styles.dotCap,
                  {
                    backgroundColor: isActive ? palette.text : (isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)'),
                    width: isActive ? 24 : 8
                  }
                ]}
              />
            );
          })}
        </View>
      </View>

      {/* GORHOM GESTURE BOTTOM SHEET DEPOSIT MODAL */}
      <GorhomBottomSheet
        visible={!!activeBottomSheet}
        onClose={() => setActiveBottomSheet(null)}
        snapPoints={['55%', '88%']}
      >
        {activeBottomSheet && (
          <View style={{ flex: 1 }}>
            <View style={styles.sheetHeader}>
              <Text style={[Typography.title2, { color: palette.text }]}>
                {activeBottomSheet.type === 'crypto' ? 'On-Chain Crypto Deposit' : activeBottomSheet.bankData?.title}
              </Text>
              <TouchableOpacity onPress={() => setActiveBottomSheet(null)} style={styles.closeBtn}>
                <X size={20} color={palette.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* MODE 1: ON-CHAIN CRYPTO BOTTOM SHEET */}
            {activeBottomSheet.type === 'crypto' && (
              <View style={styles.sheetContent}>
                {/* Network Selector Tabs */}
                <View style={styles.networkTabRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCryptoChain('solana');
                      Haptics.selectionAsync().catch(() => { });
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.networkTab,
                      {
                        backgroundColor: selectedCryptoChain === 'solana' ? palette.text : palette.bg,
                        borderColor: palette.border
                      }
                    ]}
                  >
                    <ChainLogo chain="solana" size={16} />
                    <Text style={[Typography.footnote, { color: selectedCryptoChain === 'solana' ? palette.bg : palette.text, fontWeight: '700' }]}>
                      USDC (Solana)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCryptoChain('monad');
                      Haptics.selectionAsync().catch(() => { });
                    }}
                    activeOpacity={0.8}
                    style={[
                      styles.networkTab,
                      {
                        backgroundColor: selectedCryptoChain === 'monad' ? palette.text : palette.bg,
                        borderColor: palette.border
                      }
                    ]}
                  >
                    <ChainLogo chain="monad" size={16} />
                    <Text style={[Typography.footnote, { color: selectedCryptoChain === 'monad' ? palette.bg : palette.text, fontWeight: '700' }]}>
                      AUSD (Monad)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* QR Code Container */}
                <View style={[styles.qrContainer, { backgroundColor: '#FFFFFF', borderColor: palette.border }]}>
                  <QRCodeSVG
                    value={currentCryptoAddress}
                    size={140}
                    color="#000000"
                    backgroundColor="#FFFFFF"
                  />
                </View>

                <Text style={[Typography.footnote, { color: palette.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                  Deposit only <Text style={{ fontWeight: '700', color: palette.text }}>{currentTokenSymbol}</Text> via <Text style={{ fontWeight: '700', color: palette.text }}>{currentChainName}</Text>
                </Text>

                {/* Address Box */}
                <View style={[styles.addressBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 2 }]}>
                    Your Wallet Address ({currentTokenSymbol})
                  </Text>
                  <Text style={[Typography.currencySub, { color: palette.text, fontSize: 13 }]} numberOfLines={2} selectable>
                    {currentCryptoAddress}
                  </Text>
                </View>

                {/* Copy Address Button */}
                <TouchableOpacity
                  onPress={() => copyToClipboard(currentCryptoAddress, 'sheet_crypto_addr')}
                  style={[styles.sheetPrimaryBtn, { backgroundColor: palette.text }]}
                  activeOpacity={0.85}
                >
                  {copiedField === 'sheet_crypto_addr' ? (
                    <Check size={18} color={palette.bg} />
                  ) : (
                    <Copy size={18} color={palette.bg} />
                  )}
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                    {copiedField === 'sheet_crypto_addr' ? 'Address Copied!' : 'Copy Wallet Address'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {/* MODE 2: VIRTUAL BANK ACCOUNT BOTTOM SHEET */}
            {activeBottomSheet.type === 'bank' && activeBottomSheet.bankData && (
              <View style={styles.sheetContent}>
                <View style={[styles.bankDetailsBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <View style={styles.sheetDetailRow}>
                    <Text style={[Typography.caption, { color: palette.textSecondary }]}>Bank Name</Text>
                    <Text style={[Typography.bodyBold, { color: palette.text }]}>
                      {activeBottomSheet.bankData.bankName}
                    </Text>
                  </View>

                  <View style={styles.sheetDetailRow}>
                    <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                      {activeBottomSheet.bankData.currency === 'EUR' ? 'IBAN Number' : 'Account Number'}
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[Typography.currencySub, { color: palette.text, fontSize: 16 }]}>
                        {activeBottomSheet.bankData.accountNumber}
                      </Text>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(activeBottomSheet.bankData!.accountNumber, 'sheet_bank_acc')}
                      >
                        {copiedField === 'sheet_bank_acc' ? (
                          <Check size={16} color={palette.success} />
                        ) : (
                          <Copy size={16} color={palette.textSecondary} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  {activeBottomSheet.bankData.extraDetails && (
                    <View style={styles.sheetDetailRow}>
                      <Text style={[Typography.caption, { color: palette.textSecondary }]}>Code / Routing</Text>
                      <Text style={[Typography.bodyBold, { color: palette.text }]}>
                        {activeBottomSheet.bankData.extraDetails}
                      </Text>
                    </View>
                  )}

                  <View style={styles.sheetDetailRow}>
                    <Text style={[Typography.caption, { color: palette.textSecondary }]}>Account Name</Text>
                    <Text style={[Typography.bodyBold, { color: palette.text }]}>
                      {activeBottomSheet.bankData.accountName}
                    </Text>
                  </View>
                </View>

                <Text style={[Typography.footnote, { color: palette.textSecondary, textAlign: 'center', marginVertical: 8 }]}>
                  Transfers sent to this virtual account credit your balance instantly.
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    const data = activeBottomSheet.bankData!;
                    const fullText = `Bank: ${data.bankName}\nAccount: ${data.accountNumber}\nName: ${data.accountName}${data.extraDetails ? `\n${data.extraDetails}` : ''}`;
                    copyToClipboard(fullText, 'sheet_bank_all');
                  }}
                  style={[styles.sheetPrimaryBtn, { backgroundColor: palette.text }]}
                  activeOpacity={0.85}
                >
                  <Copy size={18} color={palette.bg} />
                  <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                    {copiedField === 'sheet_bank_all' ? 'All Details Copied!' : 'Copy All Bank Details'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </GorhomBottomSheet>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 14,
    marginBottom: 6
  },
  scrollContent: {
    paddingHorizontal: CONTAINER_PADDING,
    paddingRight: CONTAINER_PADDING
  },
  card: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    height: 196,
    justifyContent: 'space-between'
  },
  glowOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: 24
  },
  patternContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden'
  },
  patternRingOuter: {
    position: 'absolute',
    right: -40,
    top: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1
  },
  patternRingInner: {
    position: 'absolute',
    right: -10,
    top: -10,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 1
  },
  patternGlow: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 80,
    height: 80,
    borderRadius: 40
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  depositBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1
  },
  balanceValue: {
    marginTop: 2,
    marginBottom: 2
  },
  subBalance: {
    marginBottom: 10
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4
  },
  actionBtn: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1
  },
  accountNumberContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4
  },
  accountNumText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1
  },
  kycPromptContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 4
  },
  kycPromptHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4
  },
  kycCtaBtn: {
    height: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8
  },
  paginationBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: CONTAINER_PADDING,
    marginTop: 12
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  dotCap: {
    height: 6,
    borderRadius: 3
  },
  bottomSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end'
  },
  bottomSheetCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderWidth: 1,
    borderBottomWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.25,
    shadowRadius: 16
  },
  dragHandleRow: {
    alignItems: 'center',
    paddingVertical: 10
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12
  },
  sheetContent: {
    gap: 12
  },
  networkTabRow: {
    flexDirection: 'row',
    gap: 10
  },
  networkTab: {
    flex: 1,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  qrContainer: {
    alignSelf: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    marginVertical: 4
  },
  addressBox: {
    borderRadius: 16,
    padding: 14,
    borderWidth: 1
  },
  bankDetailsBox: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    gap: 12
  },
  sheetDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sheetPrimaryBtn: {
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4
  }
});
