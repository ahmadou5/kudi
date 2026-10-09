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
  NativeScrollEvent,
  Share
} from 'react-native';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCodeStyled from 'react-native-qrcode-styled';
import { Rect } from 'react-native-svg';
import { Copy, Check, ShieldCheck, Sparkles, Building2, Globe2, ArrowRight, X, QrCode, Share2, CheckCircle2, ChevronDown, ChevronUp, CopyIcon, LucideShare } from 'lucide-react-native';
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
  const [networkDropdownOpen, setNetworkDropdownOpen] = useState(false);

  const handleShareCryptoAddress = async () => {
    try {
      await Share.share({
        message: `${currentTokenSymbol} Wallet Address (${currentChainName}): ${currentCryptoAddress}`,
      });
    } catch { }
  };

  const handleShareBankDetails = async () => {
    if (!activeBottomSheet?.bankData) return;
    const data = activeBottomSheet.bankData;
    const text = `Bank Name: ${data.bankName}\n${data.currency === 'EUR' ? 'IBAN' : 'Account Number'}: ${data.accountNumber}\nAccount Name: ${data.accountName}${data.extraDetails ? `\n${data.extraDetails}` : ''}`;
    try {
      await Share.share({
        message: `My Kudi ${data.title}:\n\n${text}`,
      });
    } catch { }
  };

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

  const getBankDataForCurrency = (currency: string) => {
    const fullName = user?.fullName || (user?.email?.split('@')[0] || 'Account Holder');

    const account = virtualAccounts.find(a => a.currency?.toUpperCase() === currency.toUpperCase());

    if (currency === 'NGN') {
      return {
        currency: 'NGN',
        title: 'NGN Virtual Bank Account',
        flag: '🇳🇬',
        bankName: account?.bankName || 'GTBank (Guaranty Trust Bank)',
        accountNumber: account?.accountNumber || '0123456789',
        accountName: account?.accountName || fullName,
        transferType: 'Instant NIP Bank Transfer'
      };
    }
    if (currency === 'USD') {
      return {
        currency: 'USD',
        title: 'USD Virtual Bank Account',
        flag: '🇺🇸',
        bankName: account?.bankName || 'Lead Bank',
        accountNumber: account?.accountNumber || '9920184729',
        accountName: account?.accountName || fullName,
        extraDetails: 'Routing Number: 021000021',
        transferType: 'ACH & Domestic Wire Transfer'
      };
    }
    if (currency === 'EUR') {
      return {
        currency: 'EUR',
        title: 'EUR Virtual Bank Account',
        flag: '🇪🇺',
        bankName: account?.bankName || 'Banking Circle S.A.',
        accountNumber: account?.accountNumber || 'LU29384719283741',
        accountName: account?.accountName || fullName,
        extraDetails: 'BIC / SWIFT: BCIRL2L',
        transferType: 'SEPA & SEPA Instant Credit Transfer'
      };
    }
    if (currency === 'GBP') {
      return {
        currency: 'GBP',
        title: 'GBP Virtual Bank Account',
        flag: '🇬🇧',
        bankName: account?.bankName || 'ClearBank Ltd',
        accountNumber: account?.accountNumber || '88392019',
        accountName: account?.accountName || fullName,
        extraDetails: 'Sort Code: 04-00-04',
        transferType: 'FPS (Faster Payments System)'
      };
    }
    return {
      currency,
      title: `${currency} Virtual Bank Account`,
      flag: '🌐',
      bankName: account?.bankName || 'Partner Bank',
      accountNumber: account?.accountNumber || 'N/A',
      accountName: account?.accountName || fullName,
      transferType: 'Bank Transfer'
    };
  };

  const openBankDepositSheet = (accountOrCurrency: VirtualAccount | string | undefined, flag?: string, transferType?: string, extraDetails?: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    const currency = typeof accountOrCurrency === 'string' ? accountOrCurrency : (accountOrCurrency?.currency || 'NGN');
    const bankData = getBankDataForCurrency(currency);
    if (typeof accountOrCurrency === 'object' && accountOrCurrency) {
      if (flag) bankData.flag = flag;
      if (transferType) bankData.transferType = transferType;
      if (extraDetails) bankData.extraDetails = extraDetails;
    }
    setActiveBottomSheet({
      type: 'bank',
      bankData
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
              onPress={() => router.push({ pathname: '/send/onchain', params: { chain: selectedCryptoChain } })}
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
              <Text style={[Typography.currencyDisplay, styles.balanceValue, { color: palette.text }]}>
                ₦{ngnEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                <Text style={[Typography.title2, { color: palette.textSecondary }]}>NGN</Text>
              </Text>

              <Text style={[Typography.bodyBold, styles.subBalance, { color: palette.success }]}>
                ≈ ${numericBalance.toFixed(2)} USDC{' '}
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                  ({ngnAccount.bankName} • {ngnAccount.accountNumber})
                </Text>
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
                  onPress={() => router.push('/send/ngn')}
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
              <Text style={[Typography.currencyDisplay, styles.balanceValue, { color: palette.text }]}>
                ${numericBalance.toFixed(2)}{' '}
                <Text style={[Typography.title2, { color: palette.textSecondary }]}>USD</Text>
              </Text>

              <Text style={[Typography.bodyBold, styles.subBalance, { color: palette.success }]}>
                ≈ ₦{ngnEquivalent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} NGN{' '}
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                  ({usdAccount.bankName} • {usdAccount.accountNumber})
                </Text>
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
              <Text style={[Typography.currencyDisplay, styles.balanceValue, { color: palette.text }]}>
                €{(numericBalance * 0.92).toFixed(2)}{' '}
                <Text style={[Typography.title2, { color: palette.textSecondary }]}>EUR</Text>
              </Text>

              <Text style={[Typography.bodyBold, styles.subBalance, { color: palette.success }]}>
                ≈ ${numericBalance.toFixed(2)} USDC{' '}
                <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                  ({eurAccount.bankName} • IBAN)
                </Text>
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
        onClose={() => {
          setActiveBottomSheet(null);
          setNetworkDropdownOpen(false);
        }}
        snapPoints={['77%']}
      >
        {activeBottomSheet && (
          <View style={{ flex: 1 }}>
            <View style={styles.sheetHeader}>
              {/* Selector pill — crypto networks & bank virtual accounts */}
              <TouchableOpacity
                onPress={() => setNetworkDropdownOpen(prev => !prev)}
                activeOpacity={0.75}
                style={[
                  styles.networkPill,
                  { backgroundColor: palette.border, borderColor: palette.border }
                ]}
              >
                {activeBottomSheet.type === 'crypto' ? (
                  <ChainLogo chain={selectedCryptoChain} size={16} />
                ) : (
                  <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>
                    {activeBottomSheet.bankData?.flag} {activeBottomSheet.bankData?.currency}
                  </Text>
                )}
                {networkDropdownOpen
                  ? <ChevronUp size={14} color={palette.textSecondary} />
                  : <ChevronDown size={14} color={palette.textSecondary} />
                }
              </TouchableOpacity>

              {/* Deposit title — absolutely centered */}
              <Text
                style={[
                  Typography.title2,
                  {
                    color: palette.text,
                    fontSize: 20,
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    textAlign: 'center',
                    pointerEvents: 'none',
                    paddingVertical: 20,
                    paddingHorizontal: 20
                  }
                ]}
              >
                Deposit
              </Text>

              {/* Dropdown menu */}
              {networkDropdownOpen && (
                <View
                  style={[
                    styles.dropdownMenu,
                    {
                      backgroundColor: palette.card,
                      borderColor: palette.border,
                      position: 'absolute',
                      top: 38,
                      left: 0,
                      zIndex: 100,
                      minWidth: 140
                    }
                  ]}
                >
                  {activeBottomSheet.type === 'crypto' ? (
                    <>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCryptoChain('solana');
                          setNetworkDropdownOpen(false);
                          Haptics.selectionAsync().catch(() => { });
                        }}
                        style={[styles.dropdownItem, selectedCryptoChain === 'solana' && { backgroundColor: palette.bg }]}
                      >
                        <ChainLogo chain="solana" size={18} />
                        <Text style={[Typography.bodyBold, { color: palette.text, flex: 1 }]}>Solana</Text>
                        {selectedCryptoChain === 'solana' && <Check size={16} color={palette.success} />}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedCryptoChain('monad');
                          setNetworkDropdownOpen(false);
                          Haptics.selectionAsync().catch(() => { });
                        }}
                        style={[styles.dropdownItem, selectedCryptoChain === 'monad' && { backgroundColor: palette.bg }]}
                      >
                        <ChainLogo chain="monad" size={18} />
                        <Text style={[Typography.bodyBold, { color: palette.text, flex: 1 }]}>Monad</Text>
                        {selectedCryptoChain === 'monad' && <Check size={16} color={palette.success} />}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {[
                        { currency: 'NGN', flag: '🇳🇬' },
                        { currency: 'USD', flag: '🇺🇸' },
                        { currency: 'EUR', flag: '🇪🇺' },
                        { currency: 'GBP', flag: '🇬🇧' }
                      ].map(item => {
                        const isSelected = activeBottomSheet.bankData?.currency === item.currency;
                        return (
                          <TouchableOpacity
                            key={item.currency}
                            onPress={() => {
                              const newBankData = getBankDataForCurrency(item.currency);
                              setActiveBottomSheet({ type: 'bank', bankData: newBankData });
                              setNetworkDropdownOpen(false);
                              Haptics.selectionAsync().catch(() => { });
                            }}
                            style={[
                              styles.dropdownItem,
                              isSelected && { backgroundColor: palette.bg }
                            ]}
                          >
                            <Text style={{ fontSize: 16 }}>{item.flag}</Text>
                            <Text style={[Typography.bodyBold, { color: palette.text, flex: 1, marginLeft: 6 }]}>
                              {item.currency}
                            </Text>
                            {isSelected && <Check size={16} color={palette.success} />}
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  )}
                </View>
              )}
            </View>

            {/* MODE 1: ON-CHAIN CRYPTO BOTTOM SHEET (MATCHING REFERENCE SCREENSHOT) */}
            {activeBottomSheet.type === 'crypto' && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                {/* QR Code Container */}
                <View style={[styles.qrContainer, { borderColor: palette.border }]}>
                  {/* QR + chain logo overlay */}
                  <View style={{ position: 'relative' }}>
                    <QRCodeStyled
                      data={currentCryptoAddress}
                      size={180}
                      color={palette.text}
                      pieceBorderRadius={5}
                      isPiecesGlued={false}
                      outerEyesOptions={{ borderRadius: 14 }}
                      innerEyesOptions={{ borderRadius: 9 }}
                      renderBackground={() => (
                        <>
                          <Rect width="100%" height="100%" fill={palette.bg} rx={8} />
                        </>
                      )}
                    />
                    {/* Chain logo centered over QR */}
                    <View
                      style={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: [{ translateX: -18 }, { translateY: -18 }],
                        width: 36,
                        height: 36,
                        borderRadius: 5,
                        backgroundColor: palette.bg,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <ChainLogo chain={selectedCryptoChain} size={30} />
                    </View>
                  </View>
                </View>

                {/* Wallet Address Box */}
                <View style={[styles.inputCardBox, { backgroundColor: palette.card, borderColor: palette.border, alignItems: 'center' }]}>
                  <Text style={[Typography.title2, { color: palette.textSecondary, marginBottom: 4, textAlign: 'center' }]}>
                    {`${selectedCryptoChain.charAt(0).toUpperCase() + selectedCryptoChain.slice(1)}`} Deposit Address
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 }}>
                    <Text style={[Typography.currencyDisplay, { color: palette.text, flex: 1, fontSize: 13, textAlign: 'center' }]} numberOfLines={2} selectable>
                      {currentCryptoAddress}
                    </Text>

                  </View>
                </View>



                {/* Conversion Green Alert Callout Banner */}
                <View style={[styles.conversionAlertBox, { backgroundColor: isDark ? 'rgba(34, 197, 94, 0.12)' : '#E8F5E9', borderColor: isDark ? 'rgba(34, 197, 94, 0.3)' : '#C8E6C9' }]}>

                  <Text style={[Typography.title1, { color: isDark ? '#86EFAC' : '#1B5E20', flex: 1, fontSize: 14, lineHeight: 20, textAlign: 'center' }]}>
                    Your {currentTokenSymbol} deposits will automatically be converted to Naira at the current exchange rate.
                  </Text>
                </View>

                {/* Dual Action Buttons: Copy (Secondary) and Share (Primary) */}
                <View style={styles.dualActionRow}>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(currentCryptoAddress, 'sheet_crypto_addr')}
                    style={[styles.secondaryActionBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                      <Text style={[Typography.title1, { color: palette.text, fontSize: 14 }]}>
                        {copiedField === 'sheet_crypto_addr' ? 'Copied' : 'Copy'}
                      </Text>
                      <Copy size={18} color={palette.text} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleShareCryptoAddress}
                    style={[styles.secondaryActionBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
                    activeOpacity={0.8}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 }}>
                      <Text style={[Typography.title1, { color: palette.text, fontSize: 14 }]}>
                        Share
                      </Text>
                      <LucideShare size={18} color={palette.text} />
                    </View>

                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}

            {/* MODE 2: VIRTUAL BANK ACCOUNT BOTTOM SHEET */}
            {activeBottomSheet.type === 'bank' && activeBottomSheet.bankData && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.sheetContent}>
                <View style={[styles.bankDetailsBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
                  <View style={styles.sheetDetailRow}>
                    <View>
                      <Text style={[Typography.caption, { color: palette.textSecondary }]}>Account Name</Text>
                      <Text style={[Typography.bodyBold, { color: palette.text }]}>
                        {activeBottomSheet.bankData.accountName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => copyToClipboard(activeBottomSheet.bankData!.accountName, 'sheet_bank_name')}
                    >
                      {copiedField === 'sheet_bank_name' ? (
                        <Check size={16} color={palette.success} />
                      ) : (
                        <Copy size={16} color={palette.textSecondary} />
                      )}
                    </TouchableOpacity>

                  </View>
                  <View style={styles.sheetDetailRow}>
                    <View>
                      <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                        {activeBottomSheet.bankData.currency === 'EUR' ? 'IBAN Number' : 'Account Number'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[Typography.currencySub, { color: palette.text, fontSize: 16 }]} selectable>
                          {activeBottomSheet.bankData.accountNumber}
                        </Text>

                      </View>
                    </View>
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
                  <View style={styles.sheetDetailRow}>
                    <Text style={[Typography.caption, { color: palette.textSecondary }]}>Bank Name koh</Text>
                    <Text style={[Typography.bodyBold, { color: palette.text }]}>
                      {activeBottomSheet.bankData.bankName}
                    </Text>
                  </View>



                  {activeBottomSheet.bankData.extraDetails && (
                    <View style={styles.sheetDetailRow}>
                      <Text style={[Typography.caption, { color: palette.textSecondary }]}>Code / Routing</Text>
                      <Text style={[Typography.bodyBold, { color: palette.text }]}>
                        {activeBottomSheet.bankData.extraDetails}
                      </Text>
                    </View>
                  )}


                </View>

                {/* Conversion Green Alert Callout Banner */}
                <View style={[styles.conversionAlertBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.12)' : '#EBF5FF', borderColor: isDark ? 'rgba(59, 130, 246, 0.3)' : '#BFDBFE' }]}>
                  <CheckCircle2 size={20} color={isDark ? '#60A5FA' : '#1D4ED8'} style={{ marginTop: 1 }} />
                  <Text style={[Typography.footnote, { color: isDark ? '#93C5FD' : '#1E40AF', flex: 1, lineHeight: 18 }]}>
                    {activeBottomSheet.bankData.transferType || 'Transfers sent to this virtual account credit your balance instantly.'}
                  </Text>
                </View>

                {/* Dual Action Buttons: Copy (Secondary) and Share (Primary) */}
                <View style={styles.dualActionRow}>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(activeBottomSheet.bankData!.accountNumber, 'sheet_bank_acc')}
                    style={[styles.secondaryActionBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
                    activeOpacity={0.8}
                  >
                    <Text style={[Typography.bodyBold, { color: palette.text }]}>
                      {copiedField === 'sheet_bank_acc' ? 'Copied' : 'Copy Number'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleShareBankDetails}
                    style={[styles.primaryActionBtn, { backgroundColor: palette.text }]}
                    activeOpacity={0.85}
                  >
                    <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                      Share Details
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    minHeight: 36,
    marginBottom: 14,
    position: 'relative'
  },
  networkPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    zIndex: 10
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
  },
  inputCardBox: {

    padding: 14,

  },
  iconActionBtn: {
    padding: 4
  },
  dropdownMenu: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginTop: 4
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12
  },
  conversionAlertBox: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4
  },
  dualActionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
    marginBottom: 16
  },
  secondaryActionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  primaryActionBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
