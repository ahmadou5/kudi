import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { BankLogo, BankItem } from './BankPickerModal';

type SpendType = 'offchain' | 'onchain';
type OffchainSubMode = 'BANK' | 'INTERAPP';

interface Step3ReviewProps {
  spendType: SpendType;
  offchainMode: OffchainSubMode;
  selectedBank: BankItem;
  activeRecipientName: string;
  numericAmount: number;
  rateNGN: number;
  onOpenPinModal: () => void;
}

function initialsFromName(name?: string) {
  if (!name) return 'P';
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();
}

export const Step3Review: React.FC<Step3ReviewProps> = ({
  spendType,
  offchainMode,
  selectedBank,
  activeRecipientName,
  numericAmount,
  rateNGN,
  onOpenPinModal,
}) => {
  const palette = useAppPalette();
  const amountNGN = numericAmount * rateNGN;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.stepPill, { backgroundColor: 'rgba(48,209,88,0.12)', borderColor: palette.success }]}>
          <Ionicons name="checkmark-circle-outline" size={16} color={palette.success} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Review & Confirm</Text>
        </View>
      </View>

      {/* Review Card Box */}
      <View style={[styles.reviewCardBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <View style={styles.reviewRecipientRow}>
          {spendType === 'offchain' && offchainMode === 'BANK' ? (
            <BankLogo name={selectedBank.name} bankCode={selectedBank.code} size={48} />
          ) : (
            <View style={[styles.reviewAvatarCircle, { backgroundColor: palette.primary }]}>
              <Text style={styles.reviewAvatarText}>{initialsFromName(activeRecipientName)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.reviewLabel, { color: palette.textSecondary }]}>Recipient</Text>
            <Text style={[styles.reviewTitle, { color: palette.text }]}>{activeRecipientName}</Text>
          </View>
        </View>

        <View style={[styles.reviewAmountBox, { borderColor: palette.border }]}>
          <Text style={[styles.reviewAmountLabel, { color: palette.textSecondary }]}>Amount to receive</Text>
          <Text style={[styles.reviewAmountValue, { color: palette.text }]}>${numericAmount.toFixed(2)} USDC</Text>
          <Text style={[styles.reviewAmountSub, { color: palette.textSecondary }]}>
            ≈ ₦{amountNGN.toLocaleString('en-NG', { maximumFractionDigits: 2 })} NGN
          </Text>
        </View>
      </View>

      {/* Send Money Trigger */}
      <TouchableOpacity
        onPress={onOpenPinModal}
        style={[styles.primaryButton, { backgroundColor: palette.primary, marginTop: Spacing.md }]}
      >
        <Text style={styles.primaryButtonText}>Send Money</Text>
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
  reviewCardBox: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  reviewRecipientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reviewAvatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewAvatarText: { color: '#fff', fontSize: Typography.md, fontFamily: Typography.family.bold },
  reviewLabel: { fontSize: 10, fontFamily: Typography.family.bold, letterSpacing: 0.8 },
  reviewTitle: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  reviewAmountBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  reviewAmountLabel: { fontSize: 10, fontFamily: Typography.family.bold, letterSpacing: 0.8 },
  reviewAmountValue: { fontSize: 24, fontFamily: Typography.family.bold },
  reviewAmountSub: { fontSize: Typography.xs },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: Typography.md, fontFamily: Typography.family.bold },
});
