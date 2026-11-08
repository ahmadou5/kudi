import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Image,
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
import { router } from 'expo-router';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react-native';
import { AmountKeypad } from '../../src/components/send/AmountKeypad';
import { useAppPalette, hexToRgba, readableInk } from '../../src/lib/theme';
import { Typography } from '../../src/constants/typography';
import { PHONE_NUMBER_BANK_CODES } from '../../src/constants/banks';
import { useBanks } from '../../src/hooks/useBanks';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { useRecipientsStore, BankRecipient } from '../../src/store/recipients.store';
import { nairaInWords } from '../../src/utils/amountWords';
import { BankPickerModal, BankLogo } from '../../src/components/wallet/BankPickerModal';
import { PaymentPinModal } from '../../src/components/wallet/PaymentPinModal';
import { TransactionResultModal } from '../../src/components/TransactionResultModal';
import { SendHeader } from '../../src/components/send/SendHeader';
import { SummaryCard } from '../../src/components/send/SummaryCard';
import { SendSheet } from '../../src/components/send/SendSheet';
import { haptics } from '../../src/lib/haptics';
import { useSendAuth } from '../../src/hooks/useSendAuth';
import { EnterSection } from '../../src/lib/animations';

/** Flat fee shown to the user and added on top of the amount (matches the API's ₦20 payout fee). */
const NGN_FEE = 20;
const MIN_NGN = 100;
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000];
const RECENT_PREVIEW = 6;

const fmtNgn = (n: number) =>
  `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortBankName = (name: string) =>
  name
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s*(Digital Services|Microfinance Bank|MFB)\s*$/i, '')
    .replace(/\s*\/.*$/, '')
    .trim();

type Step = 'account' | 'amount';
type ListTab = 'recent' | 'saved';

export default function SendNgnScreen() {
  const palette = useAppPalette();
  const isDark = palette.scheme === 'dark';
  const { bioReady, authorize } = useSendAuth();
  const { balanceUSDC, rateNGN, resolveAccount, spendToBank } = useKudiWallet();
  const { banks, loading: banksLoading } = useBanks();

  const recentBank = useRecipientsStore((s) => s.recentBank);
  const savedBank = useRecipientsStore((s) => s.savedBank);
  const addRecentBank = useRecipientsStore((s) => s.addRecentBank);
  const saveBank = useRecipientsStore((s) => s.saveBank);
  const removeSavedBank = useRecipientsStore((s) => s.removeSavedBank);

  const [step, setStep] = useState<Step>('account');

  // Step 1 – account
  const [accountNumber, setAccountNumber] = useState('');
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [accountFocused, setAccountFocused] = useState(false);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [listTab, setListTab] = useState<ListTab>('recent');
  const [showAll, setShowAll] = useState(false);

  // Step 2 – amount
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');

  // Review / submit
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saveBeneficiary, setSaveBeneficiary] = useState(false);
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

  const selectedBank = useMemo(() => banks.find((b) => b.code === bankCode) || banks[0] || null, [bankCode, banks]);
  const cleanAccount = accountNumber.replace(/\D/g, '');
  const accountComplete = cleanAccount.length === 10;

  const numericBalance = parseFloat(String(balanceUSDC)) || 0;
  const balanceNGN = numericBalance * rateNGN;
  const numericAmount = parseFloat(amountText.replace(/,/g, '')) || 0;
  const totalNGN = numericAmount + (numericAmount > 0 ? NGN_FEE : 0);

  const amountError = useMemo(() => {
    if (numericAmount > 0 && numericAmount < MIN_NGN) return `Minimum transfer is ${fmtNgn(MIN_NGN)}`;
    if (totalNGN > balanceNGN) return 'Insufficient balance';
    return '';
  }, [numericAmount, totalNGN, balanceNGN]);
  const canContinueAmount = numericAmount >= MIN_NGN && !amountError;

  // Likely banks for phone-number style accounts, shown until the user picks one.
  const suggestedBanks = useMemo(() => {
    if (!accountComplete || selectedBank) return [];
    if (!/^[789]/.test(cleanAccount)) return [];
    return banks.filter((b) => PHONE_NUMBER_BANK_CODES.includes(b.code));
  }, [accountComplete, selectedBank, cleanAccount, banks]);

  const prefilledKey = useRef<string | null>(null);

  // ── Resolve the account name once we have 10 digits + a bank ──
  useEffect(() => {
    if (prefilledKey.current === `${cleanAccount}:${bankCode}`) {
      // Applied from a saved/recent recipient whose name is already known.
      return;
    }
    prefilledKey.current = null;
    setAccountName(null);
    if (!accountComplete || !bankCode) {
      setIsResolving(false);
      return;
    }
    let cancelled = false;
    setIsResolving(true);
    const timer = setTimeout(async () => {
      const name = await resolveAccount(cleanAccount, bankCode);
      if (cancelled) return;
      setIsResolving(false);
      setAccountName(name || null);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanAccount, bankCode]);

  // ── Hardware back: amount → account ──
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 'amount') {
        setStep('account');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [step]);

  const handleBack = () => {
    if (step === 'amount') setStep('account');
    else router.back();
  };

  const pickRecipient = (r: BankRecipient) => {
    haptics.tap();
    prefilledKey.current = `${r.accountNumber}:${r.bankCode}`;
    setAccountNumber(r.accountNumber);
    setBankCode(r.bankCode);
    setAccountName(r.name);
    setIsResolving(false);
    setStep('amount');
  };

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const [int, ...rest] = cleaned.split('.');
    const dec = rest.join('').slice(0, 2);
    const intFormatted = (int || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    setAmountText(rest.length > 0 ? `${intFormatted || '0'}.${dec}` : intFormatted);
  };

  const applyDigitToAmount = (text: string, d: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const [int, ...rest] = cleaned.split('.');
    const dec = rest.join('').slice(0, 2);
    const intFormatted = (int || '').replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const next = dec.length > 0 ? `${intFormatted || '0'}.${dec}` : intFormatted;
    return next === '' ? '' : next;
  };

  const applyDotToAmount = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    if (cleaned.includes('.')) return text;
    return text ? `${text}.` : '0.';
  };

  const handleKeypadDigit = (d: string) => setAmountText((prev) => applyDigitToAmount(prev, d));
  const handleKeypadDot = () => setAmountText((prev) => applyDotToAmount(prev));
  const handleKeypadBackspace = () => setAmountText((prev) => prev.slice(0, -1));

  const amountDisplayText = useMemo(
    () => fmtNgn(numericAmount),
    [numericAmount]
  );

  const handleOpenReview = () => {
    setSaveBeneficiary(false);
    setSheetOpen(true);
  };

  const handleConfirmTransfer = async () => {
    setPinError('');
    if (bioReady) {
      const bioPin = await authorize('Confirm transfer');
      if (bioPin) {
        // Biometric approved: send straight from the review sheet — no PIN modal.
        await handleConfirmPin(bioPin);
        return;
      }
      // Cancelled / failed → fall through to the PIN modal.
    }
    // Close the sheet first: stacking two native Modals is unreliable on iOS.
    setSheetOpen(false);
    setTimeout(() => setPinOpen(true), 300);
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin.length < 4) {
      setPinError('Please enter your complete 4-digit PIN');
      return;
    }
    if (!selectedBank || !accountName) return;

    setSubmitting(true);
    setPinError('');

    // The backend works in USDC; convert the NGN total (amount + fee) at the live rate, rounding up.
    const amountUSDC = Math.ceil((totalNGN / rateNGN) * 10000) / 10000;
    const fallbackRef = `KUDI_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
    const amountLabel = fmtNgn(numericAmount);

    try {
      const res = await spendToBank(amountUSDC, selectedBank.code, cleanAccount, accountName, pin, note.trim() || undefined);
      setSubmitting(false);
      setPinOpen(false);

      if (sheetOpen) {
        // Biometric path: the review sheet is still up — dismiss it before the
        // result modal, mirroring the sheet → PIN hand-off above.
        setSheetOpen(false);
        await new Promise((r) => setTimeout(r, 300));
      }

      if (res.success) {
        const recipient = {
          name: accountName,
          accountNumber: cleanAccount,
          bankCode: selectedBank.code,
          bankName: shortBankName(selectedBank.name),
        };
        addRecentBank(recipient);
        if (saveBeneficiary) saveBank(recipient);

        setResult({
          visible: true,
          type: 'success',
          title: 'Transfer Successful',
          message: `${amountLabel} sent to ${accountName} (${shortBankName(selectedBank.name)}).`,
          amount: amountLabel,
          reference: res.reference || fallbackRef,
        });
      } else {
        setResult({
          visible: true,
          type: 'failed',
          title: 'Transfer Failed',
          message: res.message || 'The transfer could not be completed.',
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

  // ── Theme-derived styling ──
  const inputBg = isDark ? palette.bg : '#FFFFFF';
  const cardBg = isDark ? palette.card : '#FFFFFF';
  const placeholder = hexToRgba(palette.text, 0.4);
  const primaryBtn = palette.text;
  const primaryBtnText = palette.bg;
  const disabledBtn = hexToRgba(palette.text, 0.1);
  const disabledBtnText = hexToRgba(palette.text, 0.4);
  const activeTab = palette.primary;

  const accountReady = accountComplete && !!selectedBank && !!accountName && !isResolving;
  const list = listTab === 'recent' ? recentBank : savedBank;
  const visibleList = showAll ? list : list.slice(0, RECENT_PREVIEW);
  const isNotallowed = true;
  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <SendHeader
        title="Send NGN"
        onBack={handleBack}
        leading={
          <Image source={require('../../assets/logos/ngnc.png')} style={{ width: 26, height: 26, borderRadius: 13 }} />
        }
      />

      <View style={styles.progressRow}>
        {[1, 2].map((seg) => {
          const current = step === 'account' ? 1 : 2;
          const active = seg <= current;
          return (
            <TouchableOpacity
              key={seg}
              style={styles.progressSeg}
              disabled={seg === current}
              onPress={() => {
                const next = seg === 1 ? 'account' : 'amount';
                if (seg < current) setStep(next);
              }}
              activeOpacity={0.7}
              accessibilityRole="progressbar"
              accessibilityLabel={seg === 1 ? 'Recipient step' : 'Amount step'}
              accessibilityValue={{ now: seg === current ? 1 : 0, min: 0, max: 1 }}
            >
              <View
                style={[
                  styles.progressSegBar,
                  { backgroundColor: active ? palette.text : hexToRgba(palette.text, 0.12) },
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {step === 'account' ? (
        // ───────────── STEP 1 · ACCOUNT + BANK ─────────────
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <EnterSection index={0}>
              <View style={[styles.formCard, { borderColor: palette.border, backgroundColor: cardBg }]}>
                <TextInput
                  value={accountNumber}
                  onChangeText={(t) => setAccountNumber(t.replace(/\D/g, '').slice(0, 10))}
                  onFocus={() => setAccountFocused(true)}
                  onBlur={() => setAccountFocused(false)}
                  placeholder="Enter 10-digit account number"
                  placeholderTextColor={placeholder}
                  keyboardType="number-pad"
                  maxLength={10}
                  style={[
                    styles.input,
                    {
                      color: palette.text,
                      backgroundColor: inputBg,
                      borderColor: accountFocused ? palette.text : palette.border,
                      borderWidth: accountFocused ? 1.5 : 1,
                    },
                  ]}
                />

                <TouchableOpacity
                  onPress={() => setBankPickerOpen(true)}
                  activeOpacity={0.8}
                  style={[styles.bankSelect, { backgroundColor: inputBg, borderColor: palette.border }]}
                >
                  {selectedBank ? (
                    <View style={styles.bankSelected}>
                      <BankLogo name={selectedBank.name} bankCode={selectedBank.code} size={26} />
                      <Text style={[Typography.body, { color: palette.text }]} numberOfLines={1}>
                        {shortBankName(selectedBank.name)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={[Typography.body, { color: placeholder, flex: 1 }]}>Select bank</Text>
                  )}
                  <ChevronDown size={20} color={palette.text} />
                </TouchableOpacity>

                {suggestedBanks.length > 0 ? (
                  <View style={styles.suggestions}>
                    {suggestedBanks.map((b) => (
                      <TouchableOpacity
                        key={b.code}
                        onPress={() => setBankCode(b.code)}
                        activeOpacity={0.7}
                        style={styles.suggestionRow}
                      >
                        <BankLogo name={b.name} bankCode={b.code} size={40} />
                        <Text style={[Typography.title3, { color: palette.text }]}>{shortBankName(b.name)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}

                {isResolving ? (
                  <View style={[styles.nameBox, { backgroundColor: inputBg, borderColor: palette.border }]}>
                    <ActivityIndicator size="small" color={palette.textSecondary} />
                    <Text style={[Typography.body, { color: palette.textSecondary }]}>Verifying account…</Text>
                  </View>
                ) : accountName && accountComplete && selectedBank ? (
                  <View
                    style={[
                      styles.nameBox,
                      {
                        backgroundColor: hexToRgba(palette.success, 0.12),
                        borderColor: isDark ? hexToRgba(palette.success, 0.35) : hexToRgba(palette.success, 0.22),
                      },
                    ]}
                  >
                    <Text style={[Typography.body, { color: palette.success, fontWeight: '600' }]} numberOfLines={1}>
                      {accountName}
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  disabled={!accountReady}
                  onPress={() => setStep('amount')}
                  activeOpacity={0.85}
                  style={[styles.primaryBtn, { backgroundColor: accountReady ? primaryBtn : disabledBtn }]}
                >
                  <Text style={[Typography.title3, { color: accountReady ? primaryBtnText : disabledBtnText, fontWeight: '600' }]}>
                    Continue
                  </Text>
                </TouchableOpacity>
              </View>
            </EnterSection>

            {/* Recent / Saved */}
            <EnterSection index={1}>
              <View style={styles.tabsRow}>
                <View style={styles.tabs}>
                  {(['recent', 'saved'] as ListTab[]).map((t) => {
                    const active = listTab === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        onPress={() => {
                          setListTab(t);
                          setShowAll(false);
                        }}
                        activeOpacity={0.8}
                        style={[
                          styles.tab,
                          active
                            ? { backgroundColor: activeTab, borderColor: activeTab }
                            : { backgroundColor: inputBg, borderColor: palette.border },
                        ]}
                      >
                        <Text style={[Typography.footnote, { color: active ? readableInk(palette.primary) : palette.text, fontWeight: '600' }]}>
                          {t === 'recent' ? 'Recent' : 'Saved'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {list.length > RECENT_PREVIEW ? (
                  <TouchableOpacity onPress={() => setShowAll((s) => !s)} hitSlop={8}>
                    <Text style={[Typography.title3, { color: palette.text, fontWeight: '500' }]}>
                      {showAll ? 'Show Less' : 'View All'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </EnterSection>

            <EnterSection index={2}>
              {visibleList.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={[Typography.body, { color: palette.textSecondary }]}>
                    {listTab === 'recent' ? 'No recent recipients yet' : 'No saved beneficiaries yet'}
                  </Text>
                </View>
              ) : (
                <View style={styles.recipientList}>
                  {visibleList.map((r) => (
                    <TouchableOpacity
                      key={r.id}
                      onPress={() => pickRecipient(r)}
                      onLongPress={listTab === 'saved' ? () => removeSavedBank(r.id) : undefined}
                      activeOpacity={0.7}
                      style={styles.recipientRow}
                    >
                      <BankLogo name={r.bankName} bankCode={r.bankCode} size={46} />
                      <View style={styles.recipientInfo}>
                        <Text style={[Typography.title3, { color: palette.text, fontWeight: '600' }]} numberOfLines={1}>
                          {r.name}
                        </Text>
                        <View style={styles.recipientMeta}>
                          <View style={[styles.bankPill, { borderColor: palette.border }]}>
                            <Text style={[Typography.footnote, { color: palette.textSecondary }]} numberOfLines={1}>
                              {r.bankName}
                            </Text>
                          </View>
                          <Text style={[Typography.footnote, { color: palette.textSecondary }]}>{r.accountNumber}</Text>
                        </View>
                      </View>
                      <ChevronRight size={20} color={palette.text} />
                    </TouchableOpacity>
                  ))}
                  {listTab === 'saved' ? (
                    <Text style={[Typography.footnote, { color: palette.textSecondary, textAlign: 'center' }]}>
                      Long-press a saved beneficiary to remove it
                    </Text>
                  ) : null}
                </View>
              )}
            </EnterSection>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        // ───────────── STEP 2 · AMOUNT ─────────────
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.content}>
            <EnterSection index={0}>
              <View style={[styles.balancePill, { borderColor: palette.border, backgroundColor: inputBg }]}>
                <Text style={[Typography.currencySub, { color: hexToRgba(palette.text, 0.5) }]}>Balance</Text>
                <Text style={[Typography.currencySub, { fontFamily: Typography.currencySub.fontFamily, color: palette.text }]}>
                  {fmtNgn(balanceNGN)}
                </Text>
              </View>
            </EnterSection>

            <EnterSection index={1}>
              <View style={styles.amountWrap}>
                <Text style={styles.amountDisplay}>{amountDisplayText}</Text>
              </View>
            </EnterSection>

            <EnterSection index={2}>
              <View style={styles.errorSlot} pointerEvents="none" accessibilityLiveRegion="polite">
                {amountError && numericAmount > 0 ? (
                  <View
                    style={[
                      styles.errorPill,
                      {
                        backgroundColor: hexToRgba(palette.error, 0.12),
                        borderColor: hexToRgba(palette.error, 0.35),
                      },
                    ]}
                  >
                    <Text style={[Typography.currencySub, { color: palette.error, textAlign: 'center', fontSize: 10 }]}>
                      {amountError}
                    </Text>
                  </View>
                ) : null}
              </View>
            </EnterSection>

            <EnterSection index={3}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
                {QUICK_AMOUNTS.map((v) => (
                  <TouchableOpacity
                    key={v}
                    onPress={() => handleAmountChange(String(v))}
                    activeOpacity={0.7}
                    style={[styles.chip, { borderColor: palette.border, backgroundColor: inputBg }]}
                  >
                    <Text style={[Typography.body, { color: palette.text, fontWeight: '600' }]}>
                      ₦{v.toLocaleString('en-NG')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </EnterSection>

            <EnterSection index={4}>
              <SummaryCard
                rows={[
                  { label: 'Fee', value: fmtNgn(NGN_FEE) },
                  { label: 'Total debit', value: fmtNgn(totalNGN), total: true },
                ]}
              />
            </EnterSection>
            {
              isNotallowed ? null : <EnterSection index={5}>
                <TextInput
                  value={note}
                  onChangeText={setNote}
                  placeholder="Note (Optional)"
                  placeholderTextColor={placeholder}
                  maxLength={60}
                  style={[
                    styles.noteInput,
                    { color: palette.text, backgroundColor: inputBg, borderColor: palette.border },
                  ]}
                />
              </EnterSection>
            }

          </View>

          <View style={styles.footer}>
            <AmountKeypad onDigit={handleKeypadDigit} onDot={handleKeypadDot} onBackspace={handleKeypadBackspace} />
            <TouchableOpacity
              disabled={!canContinueAmount}
              onPress={handleOpenReview}
              activeOpacity={0.85}
              style={[styles.primaryBtn, { backgroundColor: canContinueAmount ? primaryBtn : disabledBtn }]}
            >
              <Text style={[Typography.title3, { color: canContinueAmount ? primaryBtnText : disabledBtnText, fontWeight: '600' }]}>
                Continue
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}

      {/* ───────────── CONFIRM SHEET ───────────── */}
      <SendSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} locked={submitting}>
        <Text style={[styles.sheetAmount, { color: palette.text }]}>{fmtNgn(numericAmount)}</Text>
        <Text style={[Typography.currencySub, styles.sheetWords, { color: palette.textSecondary, fontFamily: Typography.currencySub.fontFamily }]}>
          {nairaInWords(numericAmount)}
        </Text>

        <View style={styles.warning}>
          <AlertTriangle size={20} color={palette.warning} />
          <Text style={[Typography.body, { color: palette.text, flex: 1 }]}>
            Ensure you confirm all transaction details. Bank transfers are irreversible
          </Text>
        </View>

        <SummaryCard
          rows={[
            {
              label: 'Bank name',
              value: (
                <View style={styles.bankValue}>
                  <Text style={[styles.sheetValue, { color: palette.text }]}>
                    {selectedBank ? shortBankName(selectedBank.name) : ''}
                  </Text>
                  {selectedBank ? <BankLogo name={selectedBank.name} bankCode={selectedBank.code} size={22} /> : null}
                </View>
              ),
            },
            { label: 'Account name', value: accountName || '' },
            { label: 'Account number', value: cleanAccount },
            { label: 'Amount', value: fmtNgn(numericAmount) },
            { label: 'Fee', value: fmtNgn(NGN_FEE) },
            { label: 'Total debit', value: fmtNgn(totalNGN), total: true },
          ]}
        />

        <View style={styles.toggleRow}>
          <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 15 }]}>Save to beneficiaries</Text>
          <Switch
            value={saveBeneficiary}
            onValueChange={setSaveBeneficiary}
            trackColor={{ false: hexToRgba(palette.text, isDark ? 0.2 : 0.12), true: palette.success }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.sheetErrorSlot} accessibilityLiveRegion="polite">
          {pinError ? (
            <Text style={[Typography.footnote, { color: palette.error, textAlign: 'center' }]}>{pinError}</Text>
          ) : null}
        </View>

        <TouchableOpacity
          onPress={handleConfirmTransfer}
          disabled={submitting}
          activeOpacity={0.85}
          style={[
            styles.primaryBtn,
            { backgroundColor: submitting ? disabledBtn : primaryBtn, marginHorizontal: 0, opacity: submitting ? 0.85 : 1 },
          ]}
        >
          {submitting ? (
            <ActivityIndicator color={primaryBtnText} />
          ) : (
            <Text style={[Typography.title3, { color: primaryBtnText, fontWeight: '600' }]}>Confirm Transfer</Text>
          )}
        </TouchableOpacity>
      </SendSheet>

      <BankPickerModal
        visible={bankPickerOpen}
        onClose={() => setBankPickerOpen(false)}
        banks={banks}
        banksLoading={banksLoading}
        selectedBankCode={bankCode || undefined}
        onSelect={(b) => setBankCode(b.code)}
      />

      <PaymentPinModal
        visible={pinOpen}
        onClose={() => setPinOpen(false)}
        reviewTitle={accountName || 'Bank Transfer'}
        reviewMeta={selectedBank ? `${shortBankName(selectedBank.name)} • ${cleanAccount}` : undefined}
        reviewAmount={fmtNgn(numericAmount)}
        loading={submitting}
        error={pinError}
        onConfirm={handleConfirmPin}
        onBiometricPress={
          bioReady
            ? () => {
              void (async () => {
                const bioPin = await authorize('Confirm transfer');
                if (bioPin) await handleConfirmPin(bioPin);
              })();
            }
            : undefined
        }
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
  content: { paddingHorizontal: 20, paddingBottom: 32, gap: 14 },

  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, paddingBottom: 10 },
  progressSeg: { flex: 1, height: 12, justifyContent: 'center' },
  progressSegBar: { height: 3, borderRadius: 2 },

  amountWrap: { minHeight: 84, justifyContent: 'center', alignItems: 'center' },
  amountDisplay: { fontSize: 40, fontWeight: '600', fontFamily: Typography.currencySub.fontFamily, textAlign: 'center' },
  errorSlot: { alignSelf: 'stretch', height: 26, alignItems: 'center', justifyContent: 'center' },
  errorPill: { paddingHorizontal: 10, paddingVertical: 2, borderRadius: 999, borderWidth: 1 },

  formCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  input: {
    height: 58,
    borderRadius: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: Typography.currencySub.fontFamily,
  },
  bankSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 58,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    gap: 10,
  },
  bankSelected: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  suggestions: { gap: 10 },
  suggestionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nameBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  primaryBtn: {
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
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

  tabsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  tabs: { flexDirection: 'row', gap: 10 },
  tab: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1 },
  empty: { alignItems: 'center', paddingVertical: 40 },
  recipientList: { gap: 18, paddingTop: 4 },
  recipientRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  recipientInfo: { flex: 1, gap: 6 },
  recipientMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bankPill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 14,
    borderWidth: 1,
    maxWidth: 150,
  },

  recipientCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 3,
  },
  balanceRow: { alignItems: 'flex-end' },
  balancePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 999,
    maxWidth: 250,
    alignSelf: 'center',
    borderWidth: 1,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 60,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 12,
  },
  currency: { fontSize: 22, fontWeight: '700' },
  amountInput: { flex: 1, fontSize: 18, fontFamily: Typography.currencySub.fontFamily, height: '100%' },
  chipsRow: { gap: 10, paddingRight: 20 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  noteInput: {
    height: 58,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Typography.family.sans,
  },
  footer: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8, gap: 8 },

  sheetAmount: { fontSize: 32, fontWeight: '600', textAlign: 'center', marginTop: 4, fontFamily: Typography.currencySub.fontFamily },
  sheetWords: { textAlign: 'center', marginTop: 4, marginBottom: 20 },
  bankValue: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sheetValue: { fontSize: 14, fontWeight: '600' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 18,
  },
  sheetErrorSlot: { minHeight: 18, justifyContent: 'center', marginBottom: 8 },
});
