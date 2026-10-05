import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
import * as Haptics from 'expo-haptics';
import { AlertTriangle, ChevronDown, ClipboardPaste, ScanLine, Trash2 } from 'lucide-react-native';
import { useAppPalette } from '../../src/lib/theme';
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
const QUICK_AMOUNTS = [50, 100, 500, 1000];

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
  const isDark = palette.text === '#FFFFFF';
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
  const [address, setAddress] = useState(initialAddress);
  const [chain, setChain] = useState<Chain>(initialChain);
  const [networkOpen, setNetworkOpen] = useState(false);
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
  const numericBalance = parseFloat(String(balanceUSDC)) || 0;
  const numericAmount = parseFloat(amount) || 0;
  const totalUSDC = numericAmount + (numericAmount > 0 ? ONCHAIN_FEE_USDC : 0);
  const totalNGN = totalUSDC * rateNGN;
  const balanceNGN = numericBalance * rateNGN;

  const amountError = useMemo(() => {
    if (numericAmount > 0 && numericAmount < MIN_SEND_USDC) return `Minimum send is $${MIN_SEND_USDC.toFixed(2)}`;
    if (totalUSDC > numericBalance) return 'Insufficient balance';
    return '';
  }, [numericAmount, totalUSDC, numericBalance]);

  const canContinueAmount = numericAmount >= MIN_SEND_USDC && !amountError;
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

  const handleQuickAmount = (value: number) => setAmount(String(value));
  const handleMax = () => {
    const spendable = Math.max(0, numericBalance - ONCHAIN_FEE_USDC);
    const floored = Math.floor(spendable * 100) / 100;
    setAmount(floored > 0 ? String(floored) : '');
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
        Haptics.selectionAsync().catch(() => {});
      }
    } catch {
      // clipboard unavailable
    }
  };

  const handleScan = () => router.push({ pathname: '/qr-scanner', params: { pick: '1' } });

  const handleSelectSaved = (a: string, c: Chain) => {
    setAddress(a);
    setChain(c);
    Haptics.selectionAsync().catch(() => {});
  };

  const handleRemoveSaved = (id: string, addr: string) => {
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
  const amountDisplay = (
    <Text style={styles.amountRow} accessibilityLabel={`Amount ${hasAmount ? amount : '0'} dollars`}>
      <Text style={[styles.amountMain, { color: palette.text }]}>$</Text>
      {hasAmount ? (
        <>
          <Text style={[styles.amountMain, { color: palette.text }]}>{withCommas(intPart || '0')}</Text>
          {decPart !== undefined ? (
            <Text style={[styles.amountMain, { color: palette.text }]}>.{decPart}</Text>
          ) : null}
        </>
      ) : (
        <Text style={[styles.amountMain, { color: isDark ? '#3B3F4D' : '#D4D4D8' }]}>0.00</Text>
      )}
    </Text>
  );

  const cardBg = isDark ? palette.card : '#FFFFFF';
  const inputBg = isDark ? palette.bg : '#FFFFFF';
  const disabledBtn = isDark ? '#23262F' : '#E8E8EA';
  const disabledBtnText = isDark ? '#6B7080' : '#FFFFFF';
  const primaryBtn = isDark ? '#FFFFFF' : '#000000';
  const primaryBtnText = isDark ? '#000000' : '#FFFFFF';
  const tokenLogo = <ChainLogo chain={chain} size={26} />;

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <SendHeader title={`Send ${token} (${CHAINS[chain].short})`} onBack={handleBack} leading={tokenLogo} />

      {step === 1 ? (
        // ───────────── STEP 1 · AMOUNT ─────────────
        <View style={styles.flex}>
          <View style={styles.amountTop}>
            <View style={[styles.balancePill, { borderColor: palette.border, backgroundColor: inputBg }]}>
              <Text style={[Typography.footnote, { color: palette.text, fontWeight: '600' }]}>
                Current Balance: {fmtNgn(balanceNGN).replace(/\.00$/, '')}
              </Text>
            </View>

            <View style={styles.amountWrap}>{amountDisplay}</View>

            {amountError && hasAmount ? (
              <Text style={[Typography.footnote, { color: palette.error, textAlign: 'center' }]}>{amountError}</Text>
            ) : null}

            <View style={styles.chipsRow}>
              {QUICK_AMOUNTS.map((v) => (
                <TouchableOpacity
                  key={v}
                  onPress={() => handleQuickAmount(v)}
                  style={[styles.chip, { borderColor: palette.border, backgroundColor: inputBg }]}
                  activeOpacity={0.7}
                >
                  <Text style={[Typography.body, { color: palette.text, fontWeight: '600' }]}>${v}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                onPress={handleMax}
                style={[styles.chip, { borderColor: palette.border, backgroundColor: inputBg }]}
                activeOpacity={0.7}
              >
                <Text style={[Typography.body, { color: palette.text, fontWeight: '600' }]}>Max</Text>
              </TouchableOpacity>
            </View>

            <SummaryCard
              style={styles.summary}
              rows={[
                { label: 'Exchange Rate', value: `₦${rateNGN.toLocaleString('en-NG')}` },
                { label: 'Fee', value: `$${ONCHAIN_FEE_USDC}` },
                { label: 'Total debit', value: fmtNgn(totalNGN).replace(/\.00$/, ''), total: true },
              ]}
            />
          </View>

          <View style={styles.bottom}>
            <AmountKeypad onDigit={handleDigit} onDot={handleDot} onBackspace={handleBackspace} />
            <TouchableOpacity
              disabled={!canContinueAmount}
              onPress={() => setStep(2)}
              activeOpacity={0.85}
              style={[styles.primaryBtn, { backgroundColor: canContinueAmount ? primaryBtn : disabledBtn }]}
            >
              <Text style={[Typography.title3, { color: canContinueAmount ? primaryBtnText : disabledBtnText, fontWeight: '600' }]}>
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
            <TouchableOpacity onPress={() => setStep(1)} activeOpacity={0.7} style={styles.recipientAmount}>
              {amountDisplay}
            </TouchableOpacity>

            <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: cardBg }]}>
              <View
                style={[
                  styles.addressBox,
                  {
                    backgroundColor: inputBg,
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
                  placeholderTextColor={isDark ? '#6B7080' : '#9CA3AF'}
                  multiline
                  autoCapitalize="none"
                  autoCorrect={false}
                  spellCheck={false}
                  style={[styles.addressInput, { color: palette.text }]}
                />
                <TouchableOpacity onPress={handlePaste} hitSlop={8} accessibilityLabel="Paste address">
                  <ClipboardPaste size={24} color={palette.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleScan} hitSlop={8} accessibilityLabel="Scan QR code">
                  <ScanLine size={24} color={palette.text} />
                </TouchableOpacity>
              </View>

              {showAddressError ? (
                <Text style={[Typography.footnote, { color: palette.error }]}>
                  Enter a valid {CHAINS[chain].short} address
                </Text>
              ) : null}

              <TouchableOpacity
                onPress={() => setNetworkOpen((o) => !o)}
                activeOpacity={0.8}
                style={[styles.networkBox, { backgroundColor: inputBg, borderColor: palette.border }]}
              >
                <Text style={[Typography.body, { color: palette.text, flex: 1 }]}>{CHAINS[chain].label}</Text>
                <ChevronDown
                  size={20}
                  color={palette.text}
                  style={{ transform: [{ rotate: networkOpen ? '180deg' : '0deg' }] }}
                />
              </TouchableOpacity>

              {networkOpen ? (
                <View style={[styles.networkMenu, { backgroundColor: inputBg, borderColor: palette.border }]}>
                  {(Object.keys(CHAINS) as Chain[]).map((c) => (
                    <TouchableOpacity
                      key={c}
                      onPress={() => {
                        setChain(c);
                        setNetworkOpen(false);
                      }}
                      style={styles.networkOption}
                      activeOpacity={0.7}
                    >
                      <ChainLogo chain={c} size={22} />
                      <Text style={[Typography.body, { color: palette.text, flex: 1, fontWeight: c === chain ? '700' : '500' }]}>
                        {CHAINS[c].label} · {CHAINS[c].token}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}

              <TouchableOpacity
                disabled={!addressValid}
                onPress={() => {
                  setSaveAddress(false);
                  setSheetOpen(true);
                }}
                activeOpacity={0.85}
                style={[styles.primaryBtn, styles.cardBtn, { backgroundColor: addressValid ? primaryBtn : disabledBtn }]}
              >
                <Text style={[Typography.title3, { color: addressValid ? primaryBtnText : disabledBtnText, fontWeight: '600' }]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.savedTab, { backgroundColor: '#1E3A5F' }]}>
              <Text style={[Typography.footnote, { color: '#FFFFFF', fontWeight: '600' }]}>Saved Addresses</Text>
            </View>

            {savedCrypto.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={[Typography.body, { color: palette.text }]}>No saved addresses</Text>
              </View>
            ) : (
              <View style={styles.savedList}>
                {savedCrypto.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => handleSelectSaved(r.address, r.chain)}
                    activeOpacity={0.7}
                    style={[styles.savedRow, { borderColor: palette.border, backgroundColor: cardBg }]}
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
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      {/* ───────────── REVIEW SHEET ───────────── */}
      <SendSheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
        <Text style={[styles.sheetAmount, { color: palette.text }]}>
          {numericAmount.toFixed(2)} {token}
        </Text>

        <View
          style={[
            styles.warning,
            {
              backgroundColor: isDark ? 'rgba(251,146,60,0.12)' : '#FDEDE3',
              borderColor: isDark ? 'rgba(251,146,60,0.35)' : '#F8D3BB',
            },
          ]}
        >
          <AlertTriangle size={20} color={isDark ? '#FB923C' : '#7C2D12'} />
          <Text style={[Typography.body, { color: isDark ? '#FDBA74' : '#7C2D12', flex: 1 }]}>
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
          <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 15 }]}>Save receivers wallet address</Text>
          <Switch
            value={saveAddress}
            onValueChange={setSaveAddress}
            trackColor={{ false: isDark ? '#2A2D38' : '#E5E7EB', true: '#34C759' }}
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
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  amountWrap: { minHeight: 84, justifyContent: 'center', alignItems: 'center' },
  amountRow: { textAlign: 'center' },
  amountMain: { fontSize: 60, lineHeight: 72, fontWeight: '800', letterSpacing: -1 },
  chipsRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  summary: { alignSelf: 'stretch', marginTop: 8 },
  bottom: { flex: 1, justifyContent: 'flex-end', paddingBottom: 16, gap: 8 },
  primaryBtn: {
    marginHorizontal: 20,
    height: 56,
    borderRadius: 12,
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
    borderRadius: 10,
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
  networkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 58,
  },
  networkMenu: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  networkOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardBtn: { marginHorizontal: 0 },
  savedTab: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 6,
  },
  emptyWrap: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  savedList: { gap: 10 },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },

  // Sheet
  sheetAmount: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 16,
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
  addressValueText: { fontSize: 14, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 18,
  },
});
