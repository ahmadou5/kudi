import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Building2,
  Smartphone,
  Send,
  ChevronDown,
  CheckCircle2,
  Check,
  CreditCard,
  AlertCircle,
  UserPlus,
} from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { BankLogo, BankItem } from './BankPickerModal';
import { BeneficiariesScroll, Beneficiary } from './BeneficiariesScroll';
import { ChainLogo } from '../ui/ChainLogo';

type SpendType = 'offchain' | 'onchain';
type OffchainSubMode = 'BANK' | 'INTERAPP';
type OnchainChain = 'solana' | 'monad';

interface Step1RecipientProps {
  spendType: SpendType;
  offchainMode: OffchainSubMode;
  onchainChain: OnchainChain;
  selectedBank: BankItem;
  onOpenBankPicker: () => void;
  accountNumber: string;
  onChangeAccountNumber: (text: string) => void;
  isResolving: boolean;
  accountName: string | null;
  bankConfirmed: boolean;
  onToggleBankConfirmed: () => void;
  isSaved: boolean;
  onSaveBeneficiary: () => void;
  recipientHandle: string;
  onChangeRecipientHandle: (text: string) => void;
  resolvedUser: string | null;
  onchainAddress: string;
  onChangeOnchainAddress: (text: string) => void;
  activeBeneficiaries: Beneficiary[];
  onSelectBeneficiary: (b: Beneficiary) => void;
  onRemoveBeneficiary: (id: string, name: string) => void;
  isRecipientReady: boolean;
  onContinue: () => void;
}

export const Step1Recipient: React.FC<Step1RecipientProps> = ({
  spendType,
  offchainMode,
  onchainChain,
  selectedBank,
  onOpenBankPicker,
  accountNumber,
  onChangeAccountNumber,
  isResolving,
  accountName,
  bankConfirmed,
  onToggleBankConfirmed,
  isSaved,
  onSaveBeneficiary,
  recipientHandle,
  onChangeRecipientHandle,
  resolvedUser,
  onchainAddress,
  onChangeOnchainAddress,
  activeBeneficiaries,
  onSelectBeneficiary,
  onRemoveBeneficiary,
  isRecipientReady,
  onContinue,
}) => {
  const palette = useAppPalette();

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.stepPill, { backgroundColor: 'rgba(10,132,255,0.08)', borderColor: palette.primary }]}>
          {spendType === 'offchain' ? (
            offchainMode === 'BANK' ? (
              <Building2 size={16} color={palette.primary} />
            ) : (
              <Smartphone size={16} color={palette.primary} />
            )
          ) : (
            <Send size={16} color={palette.primary} />
          )}
        </View>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>
            {spendType === 'offchain'
              ? offchainMode === 'BANK'
                ? 'Bank lookup'
                : 'Recipient lookup'
              : 'Address input'}
          </Text>
        </View>
      </View>

      {/* Saved Beneficiaries Carousel */}
      <BeneficiariesScroll
        beneficiaries={activeBeneficiaries}
        onSelect={onSelectBeneficiary}
        onLongPress={onRemoveBeneficiary}
      />

      {/* Form Fields */}
      {spendType === 'offchain' ? (
        offchainMode === 'BANK' ? (
          <>
            <Text style={[styles.inputLabel, { color: palette.text }]}>Recipient Bank</Text>
            <TouchableOpacity
              onPress={onOpenBankPicker}
              style={[styles.selectRow, { backgroundColor: palette.bg, borderColor: palette.border }]}
            >
              <BankLogo name={selectedBank.name} bankCode={selectedBank.code} size={36} />
              <Text style={[styles.selectValue, { color: palette.text, flex: 1, marginLeft: 10 }]}>
                {selectedBank.name}
              </Text>
              <ChevronDown size={18} color={palette.textSecondary} />
            </TouchableOpacity>

            <Text style={[styles.inputLabel, { color: palette.text, marginTop: 12 }]}>Account Number</Text>
            <View style={[styles.inputBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Building2 size={18} color={palette.textSecondary} />
              <TextInput
                value={accountNumber}
                onChangeText={(t) => onChangeAccountNumber(t.replace(/\D/g, ''))}
                keyboardType="number-pad"
                placeholder="Enter 10-digit NUBAN"
                placeholderTextColor={palette.textSecondary}
                style={[styles.textInput, { color: palette.text }]}
                maxLength={10}
              />
            </View>

            {isResolving ? (
              <View style={[styles.statusCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={[styles.statusTitle, { color: palette.textSecondary }]}>Resolving NUBAN account details…</Text>
              </View>
            ) : accountName ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <View style={[styles.statusCard, { backgroundColor: 'rgba(48,209,88,0.12)', borderColor: palette.success }]}>
                  <CheckCircle2 size={20} color={palette.success} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusTitle, { color: palette.success }]}>{accountName}</Text>
                    <Text style={[styles.statusMeta, { color: palette.textSecondary }]}>
                      {selectedBank.name} • {accountNumber}
                    </Text>
                  </View>
                </View>

                <Pressable
                  onPress={onToggleBankConfirmed}
                  style={[
                    styles.confirmRow,
                    {
                      backgroundColor: bankConfirmed ? 'rgba(48,209,88,0.08)' : palette.bg,
                      borderColor: bankConfirmed ? palette.success : palette.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.confirmCheck,
                      {
                        backgroundColor: bankConfirmed ? palette.success : 'transparent',
                        borderColor: bankConfirmed ? palette.success : palette.border,
                      },
                    ]}
                  >
                    {bankConfirmed ? <Check size={14} color="#fff" /> : null}
                  </View>
                  <Text style={[styles.confirmText, { color: palette.text }]}>
                    I confirm this is the correct account
                  </Text>
                </Pressable>

                {!isSaved && (
                  <TouchableOpacity
                    onPress={onSaveBeneficiary}
                    style={[styles.saveCardRow, { borderColor: palette.primary, backgroundColor: 'rgba(10,132,255,0.05)' }]}
                  >
                    <CreditCard size={16} color={palette.primary} />
                    <Text style={[styles.saveCardText, { color: palette.primary }]}>Save this bank account</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : accountNumber.length === 10 ? (
              <View style={[styles.statusCard, { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: palette.error }]}>
                <AlertCircle size={20} color={palette.error} />
                <Text style={[styles.statusTitle, { color: palette.error }]}>Could not resolve bank account details.</Text>
              </View>
            ) : null}
          </>
        ) : (
          <>
            <Text style={[styles.inputLabel, { color: palette.text }]}>Recipient Handle / Phone</Text>
            <View style={[styles.inputBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Smartphone size={18} color={palette.textSecondary} />
              <TextInput
                value={recipientHandle}
                onChangeText={onChangeRecipientHandle}
                placeholder="@handle or phone number"
                placeholderTextColor={palette.textSecondary}
                style={[styles.textInput, { color: palette.text }]}
                autoCapitalize="none"
              />
            </View>

            {isResolving ? (
              <View style={[styles.statusCard, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={[styles.statusTitle, { color: palette.textSecondary }]}>Checking Kudi network…</Text>
              </View>
            ) : resolvedUser ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <View style={[styles.statusCard, { backgroundColor: 'rgba(48,209,88,0.12)', borderColor: palette.success }]}>
                  <CheckCircle2 size={20} color={palette.success} />
                  <Text style={[styles.statusTitle, { color: palette.success }]}>{resolvedUser}</Text>
                </View>
                {!isSaved && (
                  <TouchableOpacity
                    onPress={onSaveBeneficiary}
                    style={[styles.saveCardRow, { borderColor: palette.primary, backgroundColor: 'rgba(10,132,255,0.05)' }]}
                  >
                    <UserPlus size={16} color={palette.primary} />
                    <Text style={[styles.saveCardText, { color: palette.primary }]}>Save this contact</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
          </>
        )
      ) : (
        <>
          <Text style={[styles.inputLabel, { color: palette.text }]}>{onchainChain.toUpperCase()} Wallet Address</Text>
          <View style={[styles.inputBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <ChainLogo chain={onchainChain} size={18} />
            <TextInput
              value={onchainAddress}
              onChangeText={onChangeOnchainAddress}
              placeholder={`Paste ${onchainChain.toUpperCase()} address`}
              placeholderTextColor={palette.textSecondary}
              style={[styles.textInput, { color: palette.text }]}
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={async () => {
                const text = await Clipboard.getStringAsync();
                if (text) onChangeOnchainAddress(text.trim());
              }}
            >
              <Text style={[styles.pasteText, { color: palette.primary }]}>Paste</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Continue Action */}
      <TouchableOpacity
        onPress={onContinue}
        disabled={!isRecipientReady}
        style={[
          styles.primaryButton,
          { backgroundColor: isRecipientReady ? palette.primary : palette.border, marginTop: Spacing.md },
        ]}
      >
        <Text style={styles.primaryButtonText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepPill: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  inputLabel: { fontSize: Typography.sm, fontFamily: Typography.family.semibold },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  selectValue: { fontSize: Typography.sm, fontFamily: Typography.family.semibold },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  textInput: { flex: 1, fontSize: Typography.sm, fontFamily: Typography.family.medium },
  pasteText: { fontSize: Typography.xs, fontFamily: Typography.family.bold },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  statusTitle: { fontSize: Typography.sm, fontFamily: Typography.family.bold },
  statusMeta: { fontSize: Typography.xs, marginTop: 2 },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  confirmCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: { fontSize: Typography.xs, fontFamily: Typography.family.semibold },
  saveCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    gap: 8,
  },
  saveCardText: { fontSize: Typography.xs, fontFamily: Typography.family.bold },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: Typography.md, fontFamily: Typography.family.bold },
});
