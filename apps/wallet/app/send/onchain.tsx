import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { AlertTriangle, ArrowLeftRight, ClipboardPaste, Inbox, ScanLine, Trash2 } from 'lucide-react-native';
import { useAppPalette, hexToRgba, mixColors } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { useRecipientsStore } from '../../src/store/recipients.store';
import { ChainLogo } from '../../src/components/ui/ChainLogo';
import { useAppModal } from '../../src/components/ui/AppModal';
import { PaymentPinModal } from '../../src/components/wallet/PaymentPinModal';
import { TransactionResultModal } from '../../src/components/TransactionResultModal';
import { SendHeader } from '../../src/components/send/SendHeader';
import { SummaryCard } from '../../src/components/send/SummaryCard';
import { AmountKeypad } from '../../src/components/send/AmountKeypad';
import { SendSheet } from '../../src/components/send/SendSheet';
import { SwipeToSend } from '../../src/components/send/SwipeToSend';
import { haptics } from '../../src/lib/haptics';

type Chain = 'solana' | 'monad';

const CHAINS: Record<Chain, { label: string; short: string; network: string; token: string }> = {
  solana: { label: 'Solana (SOL)', short: 'Solana', network: 'Solana', token: 'USDC' },
  monad: { label: 'Monad (MON)', short: 'Monad', network: 'Monad', token: 'AUSD' },
};

/**
 * Network fee charged on top of the amount, in USDC.
 * The reference design shows a fee row; the API currently debits only the amount for
 * on-chain sends, so this stays 0 until the backend starts charging one.
 */
const ONCHAIN_FEE_USDC = 0;
const MIN_SEND_USDC = 1;
const MAX_AMOUNT_LENGTH = 9;
const QUICK_AMOUNTS = [10, 50, 100];
const QUICK_AMOUNTS_NGN = [5000, 10000];

const SOLANA_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

const isValidAddress = (address: string, chain: Chain) =>
  chain === 'solana' ? SOLANA_RE.test(address) : EVM_RE.test(address);

const detectChain = (address: string): Chain | null => {
  if (EVM_RE.test(address)) return 'monad';
  if (SOLANA_RE.test(address)) return 'solana';
  return null;
};

const shortAddress = (address: string) =>
  address.length > 14 ? `${address.slice(0, 6)}...${address.slice(-5)}` : address;

const fmtNgn = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const withCommas = (intPart: string) => intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export default function SendOnchainScreen() {
  const palette = useAppPalette();
  const modal = useAppModal();
  const params = useLocalSearchParams<{ address?: string; chain?: string }>();
  const { balanceUSDC, rateNGN, sendCrypto, cryptoSendResult, setCryptoSendResult } = useKudiWallet();

  const savedCrypto = useRecipientsStore((s) => s.savedCrypto);
  const saveCrypto = useRecipientsStore((s) => s.saveCrypto);
  const removeSavedCrypto = useRecipientsStore((s) => s.removeSavedCrypto);

  const initialAddress = (params.address || '').trim();
  const initialChain: Chain =
    params.chain === 'monad' || params.chain === 'solana'
      ? params.chain
      : detectChain(initialAddress) || 'solana';

  const [step, setStep] = useState<1 | 2>(1);
  const [amount, setAmount] = useState('');
  const [entryNgn, setEntryNgn] = useState(false);
  const [address, setAddress] = useState(initialAddress);
  const [chain, setChain] = useState<Chain>(initialChain);
  const [addressFocused, setAddressFocused] = useState(false);
  const [saveAddress, setSaveAddress] = useState(false);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [pinError, setPinError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    visible: boolean;
    type: 'success' | 'failed' | 'pending';
    title: string;
    message: string;
    amount?: string;
    reference?: string;
  }>({ visible: false, type: 'success', title: '', message: '' });

  const token = CHAINS[chain].token;
  const rateReady = rateNGN > 0;
  const numericBalance = parseFloat(String(balanceUSDC)) || 0;
  const enteredAmount = parseFloat(amount) || 0;
  const numericAmount = entryNgn && rateReady ? enteredAmount / rateNGN : enteredAmount;
  const totalUSDC = numericAmount + (numericAmount > 0 ? ONCHAIN_FEE_USDC : 0);
  const totalNGN = totalUSDC * rateNGN;
  const balanceNGN = numericBalance * rateNGN;
  const maxAmount = Math.floor(Math.max(0, numericBalance - ONCHAIN_FEE_USDC) * 100) / 100;
  const maxAmountNGN = Math.floor(balanceNGN * 100) / 100;
  const quickAmounts = entryNgn ? QUICK_AMOUNTS_NGN : QUICK_AMOUNTS;
  const quickLabel = (v: number) => (entryNgn ? `₦${v.toLocaleString('en-NG')}` : `$${v}`);

  const amountError = useMemo(() => {
    if (enteredAmount > 0 && numericAmount < MIN_SEND_USDC) {
      return entryNgn
        ? `Minimum send is ${fmtNgn(rateNGN * MIN_SEND_USDC).replace(/\.00$/, '')}`
        : `Minimum send is $${MIN_SEND_USDC.toFixed(2)}`;
    }
    if (totalUSDC > numericBalance) return 'Insufficient balance';
    return '';
  }, [enteredAmount, numericAmount, totalUSDC, numericBalance, entryNgn, rateNGN]);

  const canContinueAmount = numericAmount >= MIN_SEND_USDC && !amountError;
  const maxActive = entryNgn
    ? maxAmountNGN > 0 && enteredAmount === maxAmountNGN
    : maxAmount > 0 && enteredAmount === maxAmount;
  const trimmedAddress = address.trim();
  const addressValid = isValidAddress(trimmedAddress, chain);
  const showAddressError = trimmedAddress.length > 0 && !addressValid && !addressFocused;

  // ── Pick up an address returned by the QR scanner (opened in "pick" mode) ──
  useFocusEffect(
    useCallback(() => {
      const scanned = useRecipientsStore.getState().scannedAddress;
      if (scanned) {
        useRecipientsStore.getState().setScannedAddress(null);
        setAddress(scanned.trim());
        const detected = detectChain(scanned.trim());
        if (detected) setChain(detected);
      }
    }, [])
  );

  // ── Hardware back: step 2 → step 1 ──
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 2) {
        setStep(1);
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  // ── Promote the polled withdrawal status into the result modal ──
  useEffect(() => {
    if (!cryptoSendResult || !result.visible) return;
    if (cryptoSendResult.status === 'CONFIRMED') {
      setResult((prev) => ({
        ...prev,
        type: 'success',
        title: `${CHAINS[chain].short} Transfer Confirmed!`,
        message: 'Transaction finalized on-chain.',
        reference: cryptoSendResult.txHash || cryptoSendResult.reference || prev.reference,
      }));
    } else if (cryptoSendResult.status === 'FAILED') {
      setResult((prev) => ({
        ...prev,
        type: 'failed',
        title: `${CHAINS[chain].short} Transfer Failed`,
        message: 'Transaction failed on network. Balance has been restored.',
        reference: cryptoSendResult.reference || prev.reference,
      }));
    }
  }, [cryptoSendResult, result.visible, chain]);

  // ── Amount entry ──
  const handleDigit = (d: string) => {
    setAmount((prev) => {
      if (prev.length >= MAX_AMOUNT_LENGTH) return prev;
      const [, dec] = prev.split('.');
      if (dec !== undefined && dec.length >= 2) return prev;
      if (prev === '0') return d === '0' ? prev : d;
      return prev + d;
    });
  };
  const handleDot = () => setAmount((prev) => (prev.includes('.') ? prev : (prev || '0') + '.'));
  const handleBackspace = () => setAmount((prev) => prev.slice(0, -1));

  const handleQuickAmount = (value: number) => {
    haptics.tap();
    setAmount(String(value));
  };
  const handleMax = () => {
    haptics.tap();
    const cap = entryNgn ? maxAmountNGN : maxAmount;
    setAmount(cap > 0 ? String(cap) : '');
  };

  const toggleEntryCurrency = () => {
    if (!rateReady) return;
    haptics.tap();
    const next = !entryNgn;
    setEntryNgn(next);
    if (amount) {
      const converted = next ? enteredAmount * rateNGN : enteredAmount / rateNGN;
      const rounded = Math.round(converted * 100) / 100;
      setAmount(rounded > 0 ? String(rounded) : '');
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else router.back();
  };

  // ── Address helpers ──
  const handlePaste = async () => {
    try {
      const text = (await Clipboard.getStringAsync()).trim();
      if (text) {
        setAddress(text);
        const detected = detectChain(text);
        if (detected) setChain(detected);
        haptics.tap();
      }
    } catch {
      // clipboard unavailable
    }
  };

  const handleScan = () => router.push({ pathname: '/qr-scanner', params: { pick: '1' } });

  const handleSelectSaved = (a: string, c: Chain) => {
    setAddress(a);
    setChain(c);
    haptics.tap();
  };

  const handleRemoveSaved = (id: string, addr: string) => {
    haptics.impact('light');
    modal.show({
      title: 'Remove Address',
      description: `Remove ${shortAddress(addr)} from saved addresses?`,
      type: 'warning',
      primaryText: 'Remove',
      onPrimaryPress: () => {
        removeSavedCrypto(id);
        modal.hide();
      },
      secondaryText: 'Cancel',
      onSecondaryPress: () => modal.hide(),
    });
  };

  // ── Transfer ──
  const handleSwipeComplete = () => {
    // Close the sheet first: stacking two native Modals is unreliable on iOS.
    setSheetOpen(false);
    setPinError('');
    setTimeout(() => setPinOpen(true), 300);
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin.length < 4) {
      setPinError('Please enter your complete 4-digit PIN');
      return;
    }
    setSubmitting(true);
    setPinError('');
    const fallbackRef = `KUDI_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const amountLabel = `$${numericAmount.toFixed(2)} ${token}`;

    try {
      const res = await sendCrypto({ amountUSDC: numericAmount, toAddress: trimmedAddress, chain, pin });
      setSubmitting(false);
      setPinOpen(false);

      if (res && ['CONFIRMED', 'PENDING', 'BROADCAST'].includes(res.status)) {
        setCryptoSendResult(res);
        if (saveAddress) saveCrypto({ address: trimmedAddress, chain });
        const confirmed = res.status === 'CONFIRMED';
        setResult({
          visible: true,
          type: confirmed ? 'success' : 'pending',
          title: confirmed ? `${CHAINS[chain].short} Transfer Confirmed` : `${CHAINS[chain].short} Transfer Submitted`,
          message: confirmed
            ? `Successfully sent ${amountLabel} on ${CHAINS[chain].short}.`
            : `Sent ${amountLabel} on ${CHAINS[chain].short}. Finalizing on-chain...`,
          amount: amountLabel,
          reference: res.txHash || res.reference || fallbackRef,
        });
      } else {
        setResult({
          visible: true,
          type: 'failed',
          title: 'On-Chain Transfer Failed',
          message: 'Transaction rejected by network RPC.',
          amount: amountLabel,
          reference: fallbackRef,
        });
      }
    } catch (err) {
      setSubmitting(false);
      setPinError(err instanceof Error ? err.message : 'Transfer execution failed.');
    }
  };

  const closeResult = () => {
    setResult((prev) => ({ ...prev, visible: false }));
    router.replace('/(tabs)');
  };

  // ── Amount display ──
  const [intPart, decPart] = amount.split('.');
  const hasAmount = amount.length > 0;
  const visibleError = amountError && hasAmount ? amountError : '';
  const errorAnim = useRef(new Animated.Value(0)).current;
  const errorRise = errorAnim.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });

  useEffect(() => {
    Animated.timing(errorAnim, {
      toValue: visibleError ? 1 : 0,
      duration: visibleError ? 200 : 140,
      useNativeDriver: true,
    }).start();
  }, [visibleError, errorAnim]);
  const amountDisplay = (
    <Text
      style={[styles.amountRow]}
      accessibilityLabel={`Amount ${hasAmount ? amount : '0'} ${entryNgn ? 'naira' : 'dollars'}`}
    >
      <Text style={[{ color: palette.text, fontFamily: Typography.currencySub.fontFamily, fontSize: 40 }]}>
        {entryNgn ? '₦' : '$'}
      </Text>
      {hasAmount ? (
        <>
          <Text style={[{ color: palette.text, fontFamily: Typography.currencySub.fontFamily, fontSize: 43 }]}>{withCommas(intPart || '0')}</Text>
          {decPart !== undefined ? (
            <Text style={[{ color: palette.text, fontFamily: Typography.currencySub.fontFamily, fontSize: 35 }]}>.{decPart}</Text>
          ) : null}
        </>
      ) : (
        <Text style={[{ color: hexToRgba(palette.text, 0.35), fontFamily: Typography.currencySub.fontFamily, fontSize: 48 }]}>0.00</Text>
      )}
    </Text>
  );

  const insetBg = mixColors(palette.bg, palette.text, 0.04);
  const ctaBg = (enabled: boolean) => (enabled ? palette.text : hexToRgba(palette.text, 0.12));
  const ctaText = (enabled: boolean) => (enabled ? palette.bg : hexToRgba(palette.text, 0.38));
  const tokenLogo = <ChainLogo chain={chain} size={26} />;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <SendHeader title={`Send ${token} (${CHAINS[chain].short})`} onBack={handleBack} leading={tokenLogo} />

      <View style={styles.progressRow}>
        {[1, 2].map((seg) => (
          <TouchableOpacity
            key={seg}
            style={styles.progressSeg}
            disabled={seg === 1 && step === 1}
            onPress={() => seg === 1 && step === 2 && setStep(1)}
            activeOpacity={0.7}
            accessibilityRole="progressbar"
            accessibilityLabel={seg === 1 ? 'Amount step' : 'Recipient step'}
            accessibilityValue={{ now: step === seg ? 1 : 0, min: 0, max: 1 }}
          >
            <View
              style={[
                styles.progressSegBar,
                { backgroundColor: step >= seg ? palette.text : hexToRgba(palette.text, 0.12) },
              ]}
            />
          </TouchableOpacity>
        ))}
      </View>

      {step === 1 ? (
        // ───────────── STEP 1 · AMOUNT ─────────────
        <View style={styles.flex}>
          <View style={styles.amountTop}>
            <TouchableOpacity
              onPress={toggleEntryCurrency}
              activeOpacity={0.7}
              style={[styles.balancePill, { borderColor: palette.border, backgroundColor: insetBg }]}
              accessibilityRole="button"
              accessibilityLabel={`Balance. Switch amount currency, currently ${entryNgn ? 'Naira' : 'USDC'}`}
            >
              <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.5) }]}>Balance</Text>
              <Text
                style={[
                  Typography.currencySub,
                  { fontFamily: Typography.currencySub.fontFamily, color: palette.text },
                ]}
              >
                {entryNgn
                  ? fmtNgn(balanceNGN).replace(/\.00$/, '')
                  : `$${numericBalance.toFixed(2)}`}
              </Text>
              <ArrowLeftRight size={13} color={hexToRgba(palette.text, 0.4)} />
            </TouchableOpacity>

            <View style={styles.amountWrap}>{amountDisplay}</View>

            <View style={styles.errorSlot} pointerEvents="none" accessibilityLiveRegion="polite">
              <Animated.View
                style={[
                  styles.errorPill,
                  {
                    opacity: errorAnim,
                    transform: [{ translateY: errorRise }],
                    backgroundColor: hexToRgba(palette.error, 0.12),
                    borderColor: hexToRgba(palette.error, 0.35),
                  },
                ]}
              >
                <Text style={[Typography.currencySub, { color: palette.error, textAlign: 'center', fontSize: 10 }]}>
                  {visibleError}
                </Text>
              </Animated.View>
            </View>

            <View style={styles.chipsRow}>
              {quickAmounts.map((v) => {
                const active = enteredAmount === v;
                return (
                  <TouchableOpacity
                    key={v}
                    onPress={() => handleQuickAmount(v)}
                    style={[
                      styles.chip,
                      {
                        borderColor: active ? palette.text : palette.border,
                        backgroundColor: active ? palette.text : insetBg,
                      },
                    ]}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text
                      style={[

                        { color: active ? palette.bg : palette.text, fontFamily: Typography.currencySub.fontFamily, fontSize: 12 },
                      ]}
                    >
                      {quickLabel(v)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                onPress={handleMax}
                style={[
                  styles.chip,
                  {
                    borderColor: maxActive ? palette.text : palette.border,
                    backgroundColor: maxActive ? palette.text : insetBg,
                  },
                ]}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityState={{ selected: maxActive }}
              >
                <Text
                  style={[
                    Typography.currencySub,
                    { color: maxActive ? palette.bg : palette.text },
                  ]}
                >
                  Max
                </Text>
              </TouchableOpacity>
            </View>

            <SummaryCard
              style={styles.summary}
              rows={[
                ...(entryNgn
                  ? [

                    { label: 'You send', value: `${numericAmount.toFixed(2)} ${token}` },
                  ]
                  : []),
                { label: 'Fee', value: `$${ONCHAIN_FEE_USDC}` },
                {
                  label: 'Total debit',
                  value: entryNgn
                    ? fmtNgn(totalNGN).replace(/\.00$/, '')
                    : `$${totalUSDC.toFixed(2)}`,
                  total: true,
                },
              ]}
            />
          </View>

          <View style={styles.bottom}>
            <AmountKeypad onDigit={handleDigit} onDot={handleDot} onBackspace={handleBackspace} />
            <TouchableOpacity
              disabled={!canContinueAmount}
              onPress={() => setStep(2)}
              activeOpacity={0.85}
              style={[styles.primaryBtn, { backgroundColor: ctaBg(canContinueAmount) }]}
            >
              <Text style={[Typography.title3, { color: ctaText(canContinueAmount), fontWeight: '700' }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        // ───────────── STEP 2 · RECIPIENT ─────────────
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.recipientContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <TouchableOpacity
              onPress={() => setStep(1)}
              activeOpacity={0.7}
              style={styles.recipientAmount}
              accessibilityRole="button"
              accessibilityLabel="Edit amount"
            >
              {amountDisplay}
              <Text style={[Typography.caption, { color: hexToRgba(palette.text, 0.4) }]}>
                Tap to edit amount
              </Text>
            </TouchableOpacity>

            <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: palette.card }]}>
              <View
                style={[
                  styles.addressBox,
                  {
                    backgroundColor: insetBg,
                    borderColor: showAddressError ? palette.error : addressFocused ? palette.text : palette.border,
                    borderWidth: addressFocused || showAddressError ? 1.5 : 1,
                  },
                ]}
              >
                <TextInput
                  value={address}
                  onChangeText={(t) => setAddress(t.replace(/\s/g, ''))}
                  onFocus={() => setAddressFocused(true)}
                  onBlur={() => setAddressFocused(false)}
                  placeholder="Enter receiving wallet address"
                  placeholderTextColor={hexToRgba(palette.text, 0.4)}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  style={[styles.addressInput, { color: palette.text }]}
                />
                <View style={[styles.inputDivider, { backgroundColor: palette.border }]} />
                <TouchableOpacity onPress={handlePaste} hitSlop={8} accessibilityLabel="Paste address">
                  <ClipboardPaste size={22} color={palette.text} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    haptics.tap();
                    handleScan();
                  }}
                  hitSlop={8}
                  accessibilityLabel="Scan QR code"
                >
                  <ScanLine size={22} color={palette.text} />
                </TouchableOpacity>
              </View>

              {showAddressError ? (
                <Text style={[Typography.footnote, { color: palette.error }]}>
                  Enter a valid {CHAINS[chain].short} address
                </Text>
              ) : null}

              <View style={styles.chainRow}>
                {(Object.keys(CHAINS) as Chain[]).map((c) => {
                  const selected = c === chain;
                  return (
                    <TouchableOpacity
                      key={c}
                      onPress={() => {
                        if (!selected) {
                          setChain(c);
                          haptics.tap();
                        }
                      }}
                      activeOpacity={0.8}
                      style={[
                        styles.chainSeg,
                        {
                          borderColor: selected ? palette.text : palette.border,
                          backgroundColor: selected ? palette.text : insetBg,
                        },
                      ]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                    >
                      <ChainLogo chain={c} size={18} />
                      <Text
                        style={[
                          Typography.footnote,
                          { color: selected ? palette.bg : palette.textSecondary, fontWeight: '700' },
                        ]}
                      >
                        {CHAINS[c].short} · {CHAINS[c].token}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                disabled={!addressValid}
                onPress={() => {
                  setSaveAddress(false);
                  setSheetOpen(true);
                }}
                activeOpacity={0.85}
                style={[styles.primaryBtn, styles.cardBtn, { backgroundColor: ctaBg(addressValid) }]}
              >
                <Text style={[Typography.title3, { color: ctaText(addressValid), fontWeight: '700' }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.groupLabel, { color: hexToRgba(palette.text, 0.45) }]}>
              Saved Addresses{savedCrypto.length > 0 ? ` · ${savedCrypto.length}` : ''}
            </Text>

            {savedCrypto.length === 0 ? (
              <View style={styles.emptyWrap}>
                <View style={[styles.emptyTile, { backgroundColor: hexToRgba(palette.text, 0.07) }]}>
                  <Inbox size={24} color={palette.textSecondary} />
                </View>
                <Text style={[Typography.body, { color: palette.textSecondary }]}>No saved addresses yet</Text>
                <Text style={[Typography.footnote, { color: hexToRgba(palette.text, 0.4) }]}>
                  Addresses you save after a send show up here
                </Text>
              </View>
            ) : (
              <View style={[styles.groupCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
                {savedCrypto.map((r, index) => (
                  <React.Fragment key={r.id}>
                    {index > 0 && <View style={[styles.rowDivider, { backgroundColor: palette.border }]} />}
                    <TouchableOpacity
                      onPress={() => handleSelectSaved(r.address, r.chain)}
                      activeOpacity={0.7}
                      style={styles.savedRow}
                      accessibilityRole="button"
                      accessibilityLabel={`Use saved address ${shortAddress(r.address)}`}
                    >
                      <ChainLogo chain={r.chain} size={32} />
                      <View style={{ flex: 1 }}>
                        <Text style={[Typography.bodyBold, { color: palette.text }]}>{shortAddress(r.address)}</Text>
                        <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                          {CHAINS[r.chain].label}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => handleRemoveSaved(r.id, r.address)}
                        hitSlop={10}
                        accessibilityLabel="Remove saved address"
                      >
                        <Trash2 size={18} color={palette.textSecondary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  </React.Fragment>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ───────────── REVIEW SHEET ───────────── */}
      <SendSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={[Typography.caption, { color: hexToRgba(palette.text, 0.45), textAlign: 'center' }]}>
          You are sending
        </Text>
        <Text style={[styles.sheetAmount, { color: palette.text }]}>
          {numericAmount.toFixed(2)} {token}
        </Text>

        <View
          style={[
            styles.warning,
            {
              backgroundColor: hexToRgba(palette.warning, 0.12),
              borderColor: hexToRgba(palette.warning, 0.3),
            },
          ]}
        >
          <AlertTriangle size={20} color={palette.warning} />
          <Text style={[Typography.body, { color: palette.text, flex: 1 }]}>
            Ensure you confirm all transaction details. Stablecoin transfers are irreversible
          </Text>
        </View>

        <SummaryCard
          rows={[
            {
              label: 'Address',
              value: (
                <View style={styles.addressValue}>
                  <Text style={[styles.addressValueText, { color: palette.text }]}>{shortAddress(trimmedAddress)}</Text>
                  <ChainLogo chain={chain} size={20} />
                </View>
              ),
            },
            { label: 'Network', value: CHAINS[chain].network },
            { label: 'Exchange rate', value: `${fmtNgn(rateNGN)} / ${token}` },
            { label: 'Amount to send', value: `${numericAmount.toFixed(2)} ${token}` },
            { label: 'Fee', value: `$${ONCHAIN_FEE_USDC}` },
            { label: 'Total debit', value: fmtNgn(totalNGN), total: true },
          ]}
        />

        <View style={styles.toggleRow}>
          <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 15 }]}>Save this address for next time</Text>
          <Switch
            value={saveAddress}
            onValueChange={setSaveAddress}
            trackColor={{ false: hexToRgba(palette.text, 0.16), true: palette.primary }}
            thumbColor="#FFFFFF"
          />
        </View>

        <SwipeToSend
          onComplete={handleSwipeComplete}
          trailing={<ChainLogo chain={chain} size={40} />}
        />
      </SendSheet>

      <PaymentPinModal
        visible={pinOpen}
        onClose={() => setPinOpen(false)}
        reviewTitle={shortAddress(trimmedAddress)}
        reviewAmount={`$${numericAmount.toFixed(2)} ${token}`}
        loading={submitting}
        error={pinError}
        onConfirm={handleConfirmPin}
      />

      <TransactionResultModal
        visible={result.visible}
        type={result.type}
        title={result.title}
        message={result.message}
        amount={result.amount}
        reference={result.reference}
        onClose={closeResult}
        onViewReceipt={() => {
          setResult((prev) => ({ ...prev, visible: false }));
          router.replace('/(tabs)/history');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  // Step 1
  amountTop: { paddingHorizontal: 20, gap: 14, alignItems: 'center' },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  amountWrap: { minHeight: 84, justifyContent: 'center', alignItems: 'center' },
  amountRow: { textAlign: 'center' },
  errorSlot: {
    alignSelf: 'stretch',
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorPill: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    minWidth: 68,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
  progressSeg: { flex: 1, height: 12, justifyContent: 'center' },
  progressSegBar: { height: 3, borderRadius: 2 },
  summary: { alignSelf: 'stretch', marginTop: 8 },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 18, gap: 8 },
  primaryBtn: {
    marginHorizontal: 20,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 2
  recipientContent: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  recipientAmount: { alignItems: 'center', paddingVertical: 8 },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  addressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 60,
  },
  addressInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: Typography.family.sans,
    paddingVertical: 4,
    textAlignVertical: 'center',
  },
  chainRow: { flexDirection: 'row', gap: 10 },
  chainSeg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  inputDivider: { width: 1, height: 28 },
  cardBtn: { marginHorizontal: 0 },
  groupLabel: {
    fontFamily: Typography.family.mono,
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    paddingHorizontal: 4,
  },
  groupCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  rowDivider: { height: StyleSheet.hairlineWidth, marginLeft: 58 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
  },
  emptyWrap: { alignItems: 'center', gap: 6, paddingVertical: 40 },
  emptyTile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  // Sheet
  sheetAmount: {
    fontFamily: Typography.family.mono,
    fontSize: 32,
    lineHeight: 38,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 14,
  },
  addressValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addressValueText: {
    fontFamily: Typography.family.mono,
    fontSize: 14,
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 18,
  },
});
