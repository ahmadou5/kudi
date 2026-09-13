import React, { useState, useEffect, useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable
} from 'react-native';
import { ArrowLeft, Building2, Smartphone } from 'lucide-react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAppPalette } from '../../lib/theme';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { useAppModal } from '../../components/ui/AppModal';
import { BankPickerModal, BankItem } from '../../components/wallet/BankPickerModal';
import { PaymentPinModal } from '../../components/wallet/PaymentPinModal';
import { TransactionResultModal } from '../../components/TransactionResultModal';
import { RailSelectorCard } from '../../components/wallet/RailSelectorCard';
import { SpendHeroCard } from '../../components/wallet/SpendHeroCard';
import { Step1Recipient } from '../../components/wallet/Step1Recipient';
import { Step2Amount } from '../../components/wallet/Step2Amount';
import { Step3Review } from '../../components/wallet/Step3Review';
import { Beneficiary } from '../../components/wallet/BeneficiariesScroll';
import { ChainLogo } from '../../components/ui/ChainLogo';

type SpendType = 'select' | 'offchain' | 'onchain';
type OffchainSubMode = 'BANK' | 'INTERAPP';
type OnchainChain = 'solana' | 'monad';
type FlowStep = 1 | 2 | 3;

const NIGERIAN_BANKS: BankItem[] = [
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '057', name: 'Zenith Bank' },
  { code: '044', name: 'Access Bank' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '035', name: 'Wema Bank / ALAT' },
  { code: '232', name: 'Sterling Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '999992', name: 'OPay Digital Services' },
  { code: '999991', name: 'PalmPay' },
  { code: '50211', name: 'Kuda Microfinance Bank' }
];

const INITIAL_BENEFICIARIES: Beneficiary[] = [
  { id: 'b1', name: 'Ahmadou S.', accountNumber: '0123456789', bankCode: '058', bankName: 'Guaranty Trust Bank', type: 'BANK' },
  { id: 'b2', name: 'Fatima Z.', accountNumber: '2233445566', bankCode: '057', bankName: 'Zenith Bank', type: 'BANK' },
  { id: 'b3', name: 'Chidubem K.', handle: '@chidubem', type: 'INTERAPP' },
  { id: 'b4', name: 'Solana Treasury', address: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', chain: 'solana', type: 'CRYPTO' }
];

export default function SpendTab() {
  const palette = useAppPalette();
  const { balanceUSDC, rateNGN, resolveAccount, spendToBank, sendCrypto, cryptoSendResult, setCryptoSendResult } = useKudiWallet();
  const params = useLocalSearchParams<{ address?: string }>();
  const modal = useAppModal();

  // Root Spend Selection & Step State
  const [spendType, setSpendType] = useState<SpendType>('select');
  const [step, setStep] = useState<FlowStep>(1);
  const [offchainMode, setOffchainMode] = useState<OffchainSubMode>('BANK');
  const [onchainChain, setOnchainChain] = useState<OnchainChain>('solana');

  // Form Inputs
  const [bankCode, setBankCode] = useState('058');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [bankConfirmed, setBankConfirmed] = useState(false);
  const [recipientHandle, setRecipientHandle] = useState('');
  const [resolvedUser, setResolvedUser] = useState<string | null>(null);
  const [onchainAddress, setOnchainAddress] = useState('');
  const [amount, setAmount] = useState('');

  // Beneficiaries State
  const [savedBeneficiaries, setSavedBeneficiaries] = useState<Beneficiary[]>(INITIAL_BENEFICIARIES);
  const [isSaved, setIsSaved] = useState(false);

  // Modals State
  const [bankPickerOpen, setBankPickerOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pinError, setPinError] = useState('');
  const [resultModal, setResultModal] = useState<{
    visible: boolean;
    type: 'success' | 'failed' | 'pending';
    title: string;
    message: string;
    amount?: string;
    reference?: string;
  }>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  // Handle incoming params (e.g. from QR Scanner)
  useEffect(() => {
    if (params.address) {
      setSpendType('onchain');
      setOnchainAddress(params.address);
    }
  }, [params.address]);

  // Selected Bank Object
  const selectedBank = useMemo(() => {
    return NIGERIAN_BANKS.find((b) => b.code === bankCode) || NIGERIAN_BANKS[0];
  }, [bankCode]);

  const handleBack = () => {
    if (spendType !== 'select' && step > 1) {
      setStep((prev) => (prev - 1) as FlowStep);
      return;
    }
    if (spendType !== 'select') {
      setSpendType('select');
      setStep(1);
      return;
    }
    router.back();
  };

  // Auto NUBAN resolution
  useEffect(() => {
    if (spendType === 'offchain' && offchainMode === 'BANK') {
      const cleanAcc = accountNumber.replace(/\D/g, '');
      if (cleanAcc.length === 10) {
        setIsResolving(true);
        setAccountName(null);
        setBankConfirmed(false);
        const timer = setTimeout(async () => {
          const res = await resolveAccount(cleanAcc, bankCode);
          setIsResolving(false);
          if (res) {
            setAccountName(res);
          } else {
            setAccountName(null);
          }
        }, 500);
        return () => clearTimeout(timer);
      } else {
        setAccountName(null);
        setIsResolving(false);
        setBankConfirmed(false);
      }
    }
  }, [accountNumber, bankCode, spendType, offchainMode, resolveAccount]);

  // Auto Inter-App resolution
  useEffect(() => {
    if (spendType === 'offchain' && offchainMode === 'INTERAPP') {
      const cleanHandle = recipientHandle.trim().toLowerCase();
      if (cleanHandle.length >= 3) {
        setIsResolving(true);
        const timer = setTimeout(() => {
          setIsResolving(false);
          if (cleanHandle.includes('kudi') || cleanHandle.includes('fatima') || cleanHandle.includes('ahmadou') || cleanHandle.includes('chidubem')) {
            setResolvedUser(cleanHandle.startsWith('@') ? cleanHandle : `@${cleanHandle}`);
          } else {
            setResolvedUser(`${cleanHandle.startsWith('@') ? cleanHandle : '@' + cleanHandle} (Kudi User)`);
          }
        }, 400);
        return () => clearTimeout(timer);
      } else {
        setResolvedUser(null);
        setIsResolving(false);
      }
    }
  }, [recipientHandle, spendType, offchainMode]);

  // Active Beneficiaries Filter
  const activeBeneficiaries = useMemo(() => {
    if (spendType === 'offchain') {
      return savedBeneficiaries.filter((b) => b.type === offchainMode);
    }
    return savedBeneficiaries.filter((b) => b.type === 'CRYPTO');
  }, [savedBeneficiaries, spendType, offchainMode]);

  // Calculations
  const numericAmount = parseFloat(amount) || 0;
  const amountNGN = numericAmount * rateNGN;

  // Active Recipient Label
  const activeRecipientName = useMemo(() => {
    if (spendType === 'offchain') {
      if (offchainMode === 'BANK') {
        return accountName ? `${accountName} • ${selectedBank.name}` : selectedBank.name;
      } else {
        return resolvedUser || recipientHandle || 'Inter-App Recipient';
      }
    }
    return onchainAddress ? `${onchainAddress.slice(0, 6)}...${onchainAddress.slice(-4)}` : `${onchainChain.toUpperCase()} Address`;
  }, [spendType, offchainMode, accountName, selectedBank.name, resolvedUser, recipientHandle, onchainAddress, onchainChain]);

  // Recipient Ready Check for Step 1
  const isRecipientReady = useMemo(() => {
    if (spendType === 'offchain') {
      if (offchainMode === 'BANK') {
        return Boolean(accountName) && bankConfirmed;
      }
      return Boolean(resolvedUser);
    }
    return onchainAddress.trim().length >= 32;
  }, [spendType, offchainMode, accountName, bankConfirmed, resolvedUser, onchainAddress]);

  const handleResetForm = () => {
    setSpendType('select');
    setStep(1);
    setAmount('');
    setPinError('');
    setAccountName(null);
    setAccountNumber('');
    setBankConfirmed(false);
    setRecipientHandle('');
    setResolvedUser(null);
    setOnchainAddress('');
    setIsSaved(false);
  };

  const handleSaveBeneficiary = () => {
    if (spendType === 'offchain' && offchainMode === 'BANK' && accountName) {
      const newB: Beneficiary = {
        id: `b_${Date.now()}`,
        name: accountName,
        accountNumber,
        bankCode,
        bankName: selectedBank.name,
        type: 'BANK'
      };
      setSavedBeneficiaries([newB, ...savedBeneficiaries]);
      setIsSaved(true);
    } else if (spendType === 'offchain' && offchainMode === 'INTERAPP' && resolvedUser) {
      const newB: Beneficiary = {
        id: `b_${Date.now()}`,
        name: resolvedUser,
        handle: resolvedUser,
        type: 'INTERAPP'
      };
      setSavedBeneficiaries([newB, ...savedBeneficiaries]);
      setIsSaved(true);
    } else if (spendType === 'onchain' && onchainAddress) {
      const newB: Beneficiary = {
        id: `b_${Date.now()}`,
        name: `${onchainChain.toUpperCase()} Beneficiary`,
        address: onchainAddress,
        chain: onchainChain,
        type: 'CRYPTO'
      };
      setSavedBeneficiaries([newB, ...savedBeneficiaries]);
      setIsSaved(true);
    }
  };

  const handleRemoveBeneficiary = (id: string, name: string) => {
    modal.show({
      title: 'Remove Beneficiary',
      description: `Are you sure you want to remove ${name}?`,
      type: 'warning',
      primaryText: 'Remove',
      onPrimaryPress: () => {
        setSavedBeneficiaries((prev) => prev.filter((b) => b.id !== id));
        modal.hide();
      },
      secondaryText: 'Cancel',
      onSecondaryPress: () => modal.hide()
    });
  };

  const handleExecuteTransfer = async (enteredPin: string) => {
    if (enteredPin.length < 4) {
      setPinError('Please enter your complete 4-digit PIN');
      return;
    }

    setIsSubmitting(true);
    setPinError('');

    try {
      const txRef = `KUDI_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      if (spendType === 'offchain') {
        if (offchainMode === 'BANK') {
          await spendToBank(numericAmount, bankCode, accountNumber, accountName || '', enteredPin);
          setIsSubmitting(false);
          setPinModalOpen(false);

          setResultModal({
            visible: true,
            type: 'success',
            title: 'Bank Transfer Successful',
            message: `Successfully sent ${numericAmount.toFixed(2)} USDC (₦${amountNGN.toLocaleString('en-NG', { maximumFractionDigits: 2 })}) to ${accountName}.`,
            amount: `$${numericAmount.toFixed(2)} USDC`,
            reference: txRef
          });
        } else {
          // Inter-app transfer
          await new Promise((resolve) => setTimeout(resolve, 1000));
          setIsSubmitting(false);
          setPinModalOpen(false);

          setResultModal({
            visible: true,
            type: 'success',
            title: 'Inter-App Transfer Sent',
            message: `Successfully transferred $${numericAmount.toFixed(2)} USDC to ${resolvedUser}.`,
            amount: `$${numericAmount.toFixed(2)} USDC`,
            reference: txRef
          });
        }
      } else {
        // On-chain transfer
        const res = await sendCrypto({
          amountUSDC: numericAmount,
          toAddress: onchainAddress,
          chain: onchainChain,
          pin: enteredPin,
        });
        setIsSubmitting(false);
        setPinModalOpen(false);

        if (res && (res.status === 'CONFIRMED' || res.status === 'PENDING' || res.status === 'BROADCAST')) {
          setCryptoSendResult(res);
          const isConfirmed = res.status === 'CONFIRMED';
          setResultModal({
            visible: true,
            type: isConfirmed ? 'success' : 'pending',
            title: isConfirmed ? `${onchainChain.toUpperCase()} Transfer Confirmed` : `${onchainChain.toUpperCase()} Transfer Submitted`,
            message: isConfirmed
              ? `Successfully sent $${numericAmount.toFixed(2)} USDC on ${onchainChain.toUpperCase()} network.`
              : `Sent $${numericAmount.toFixed(2)} USDC on ${onchainChain.toUpperCase()} network. Finalizing on-chain...`,
            amount: `$${numericAmount.toFixed(2)} USDC`,
            reference: res.txHash || res.reference || txRef
          });
        } else {
          setResultModal({
            visible: true,
            type: 'failed',
            title: 'On-Chain Transfer Failed',
            message: 'Transaction rejected by network RPC.',
            amount: `$${numericAmount.toFixed(2)} USDC`,
            reference: txRef
          });
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      setPinError(err instanceof Error ? err.message : 'Transfer execution failed.');
    }
  };

  // Dynamically update result modal when background polling confirms transaction status
  useEffect(() => {
    if (!cryptoSendResult || !resultModal.visible) return;

    if (cryptoSendResult.status === 'CONFIRMED') {
      setResultModal((prev) => ({
        ...prev,
        type: 'success',
        title: `${onchainChain.toUpperCase()} Transfer Confirmed!`,
        message: `Transaction finalized on-chain.`,
        reference: cryptoSendResult.txHash || cryptoSendResult.reference || prev.reference,
      }));
    } else if (cryptoSendResult.status === 'FAILED') {
      setResultModal((prev) => ({
        ...prev,
        type: 'failed',
        title: `${onchainChain.toUpperCase()} Transfer Failed`,
        message: 'Transaction failed on network. Balance has been restored.',
        reference: cryptoSendResult.reference || prev.reference,
      }));
    }
  }, [cryptoSendResult, resultModal.visible, onchainChain]);

  const activeFlowTitle = useMemo(() => {
    if (spendType === 'offchain') {
      return offchainMode === 'BANK' ? 'Bank transfer' : 'Inter-app transfer';
    }
    return `Crypto transfer`;
  }, [spendType, offchainMode, onchainChain]);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: palette.bg }]}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backButton, { backgroundColor: palette.card, borderColor: palette.border }]}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={palette.text} />
          </TouchableOpacity>
          {
            spendType === "select" && (
              <Text style={[Typography.title1, { color: palette.text }]}>
                Spend Funds
              </Text>
            )
          }
        </View>

        {/* Root Spend Type Selection (Off-chain & On-chain Cards) */}
        {spendType === 'select' ? (
          <RailSelectorCard
            onSelectOffchain={() => {
              setSpendType('offchain');
              setStep(1);
            }}
            onSelectOnchain={() => {
              setSpendType('onchain');
              setStep(1);
            }}
          />
        ) : (
          /* Modular Component Flow */
          <View style={styles.sectionGap}>
            {/* Top Hero Banner with FlowProgressDots */}
            <SpendHeroCard
              activeFlowTitle={activeFlowTitle}
              currentStep={step}
              totalSteps={3}
              onStepPress={(target) => {
                if (target < step) setStep(target as FlowStep);
              }}
            />

            {/* Sub-mode Switcher Pills */}
            {spendType === 'offchain' ? (
              <View style={styles.chainTabRow}>
                <TouchableOpacity
                  onPress={() => setOffchainMode('BANK')}
                  activeOpacity={0.8}
                  style={[
                    styles.chainTab,
                    {
                      backgroundColor: offchainMode === 'BANK' ? (palette.text === '#FFFFFF' ? '#1E293B' : '#0F172A') : palette.card,
                      borderColor: offchainMode === 'BANK' ? palette.primary : palette.border
                    }
                  ]}
                >
                  <Building2 size={16} color={offchainMode === 'BANK' ? palette.primary : palette.textSecondary} />
                  <Text style={[Typography.footnote, { color: offchainMode === 'BANK' ? '#FFF' : palette.textSecondary, fontWeight: offchainMode === 'BANK' ? '700' : '500' }]}>
                    Bank Transfer (NGN)
                  </Text>
                  {offchainMode === 'BANK' && <View style={[styles.activeDot, { backgroundColor: palette.primary }]} />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setOffchainMode('INTERAPP')}
                  activeOpacity={0.8}
                  style={[
                    styles.chainTab,
                    {
                      backgroundColor: offchainMode === 'INTERAPP' ? (palette.text === '#FFFFFF' ? '#1E293B' : '#0F172A') : palette.card,
                      borderColor: offchainMode === 'INTERAPP' ? palette.primary : palette.border
                    }
                  ]}
                >
                  <Smartphone size={16} color={offchainMode === 'INTERAPP' ? palette.primary : palette.textSecondary} />
                  <Text style={[Typography.footnote, { color: offchainMode === 'INTERAPP' ? '#FFF' : palette.textSecondary, fontWeight: offchainMode === 'INTERAPP' ? '700' : '500' }]}>
                    Inter-App
                  </Text>
                  {offchainMode === 'INTERAPP' && <View style={[styles.activeDot, { backgroundColor: palette.primary }]} />}
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.chainTabRow}>
                <TouchableOpacity
                  onPress={() => setOnchainChain('solana')}
                  activeOpacity={0.8}
                  style={[
                    styles.chainTab,
                    {
                      backgroundColor: onchainChain === 'solana' ? (palette.text === '#FFFFFF' ? '#1E293B' : '#0F172A') : palette.card,
                      borderColor: onchainChain === 'solana' ? '#9945FF' : palette.border
                    }
                  ]}
                >
                  <ChainLogo chain="solana" size={16} />

                  {onchainChain === 'solana' && <View style={[styles.activeDot, { backgroundColor: '#9945FF' }]} />}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setOnchainChain('monad')}
                  activeOpacity={0.8}
                  style={[
                    styles.chainTab,
                    {
                      backgroundColor: onchainChain === 'monad' ? (palette.text === '#FFFFFF' ? '#1E293B' : '#0F172A') : palette.card,
                      borderColor: onchainChain === 'monad' ? '#836EF9' : palette.border
                    }
                  ]}
                >
                  <ChainLogo chain="monad" size={16} />

                  {onchainChain === 'monad' && <View style={[styles.activeDot, { backgroundColor: '#836EF9' }]} />}
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 1 Component */}
            {step === 1 ? (
              <Step1Recipient
                spendType={spendType}
                offchainMode={offchainMode}
                onchainChain={onchainChain}
                selectedBank={selectedBank}
                onOpenBankPicker={() => setBankPickerOpen(true)}
                accountNumber={accountNumber}
                onChangeAccountNumber={setAccountNumber}
                isResolving={isResolving}
                accountName={accountName}
                bankConfirmed={bankConfirmed}
                onToggleBankConfirmed={() => setBankConfirmed(!bankConfirmed)}
                isSaved={isSaved}
                onSaveBeneficiary={handleSaveBeneficiary}
                recipientHandle={recipientHandle}
                onChangeRecipientHandle={setRecipientHandle}
                resolvedUser={resolvedUser}
                onchainAddress={onchainAddress}
                onChangeOnchainAddress={setOnchainAddress}
                activeBeneficiaries={activeBeneficiaries}
                onSelectBeneficiary={(b) => {
                  if (b.type === 'BANK') {
                    setBankCode(b.bankCode || '058');
                    setAccountNumber(b.accountNumber || '');
                    setAccountName(b.name);
                    setBankConfirmed(true);
                  } else if (b.type === 'INTERAPP') {
                    setRecipientHandle(b.handle || b.name);
                    setResolvedUser(b.handle || b.name);
                  } else {
                    setOnchainAddress(b.address || '');
                  }
                }}
                onRemoveBeneficiary={handleRemoveBeneficiary}
                isRecipientReady={isRecipientReady}
                onContinue={() => setStep(2)}
              />
            ) : null}

            {/* STEP 2 Component */}
            {step === 2 ? (
              <Step2Amount
                activeRecipientName={activeRecipientName}
                amount={amount}
                onChangeAmount={setAmount}
                balanceUSDC={balanceUSDC}
                rateNGN={rateNGN}
                onContinueToReview={() => setStep(3)}
              />
            ) : null}

            {/* STEP 3 Component */}
            {step === 3 ? (
              <Step3Review
                spendType={spendType}
                offchainMode={offchainMode}
                selectedBank={selectedBank}
                activeRecipientName={activeRecipientName}
                numericAmount={numericAmount}
                rateNGN={rateNGN}
                onOpenPinModal={() => setPinModalOpen(true)}
              />
            ) : null}
          </View>
        )}

        {/* Modals Integration */}
        <BankPickerModal
          visible={bankPickerOpen}
          onClose={() => setBankPickerOpen(false)}
          banks={NIGERIAN_BANKS}
          selectedBankCode={bankCode}
          onSelect={(b) => {
            setBankCode(b.code);
            setAccountNumber('');
            setAccountName(null);
            setBankConfirmed(false);
          }}
        />

        <PaymentPinModal
          visible={pinModalOpen}
          onClose={() => setPinModalOpen(false)}
          reviewTitle={activeRecipientName}
          reviewAmount={`$${numericAmount.toFixed(2)} USDC`}
          loading={isSubmitting}
          error={pinError}
          onConfirm={handleExecuteTransfer}
        />

        <TransactionResultModal
          visible={resultModal.visible}
          type={resultModal.type}
          title={resultModal.title}
          message={resultModal.message}
          amount={resultModal.amount}
          reference={resultModal.reference}
          onClose={() => {
            setResultModal({ ...resultModal, visible: false });
            handleResetForm();
          }}
          onViewReceipt={() => {
            setResultModal({ ...resultModal, visible: false });
            router.push('/(tabs)/history');
          }}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  contentContainer: { padding: Spacing.lg, paddingBottom: 40 },
  headerRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 14,
    marginBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionGap: { gap: Spacing.lg },
  chainTabRow: { flexDirection: 'row', gap: 5, alignItems: 'flex-start', width: '50%' },
  chainTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },
});
