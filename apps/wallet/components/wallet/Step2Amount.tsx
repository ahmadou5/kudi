import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Banknote, AlertTriangle } from 'lucide-react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { Spacing } from '../../constants/spacing';
import { AmountInput } from './AmountInput';

interface Step2AmountProps {
  activeRecipientName: string;
  amount: string;
  onChangeAmount: (val: string) => void;
  balanceUSDC: number;
  rateNGN: number;
  onContinueToReview: () => void;
}

export const Step2Amount: React.FC<Step2AmountProps> = ({
  activeRecipientName,
  amount,
  onChangeAmount,
  balanceUSDC,
  rateNGN,
  onContinueToReview,
}) => {
  const palette = useAppPalette();
  const numericAmount = parseFloat(amount) || 0;
  const amountNGN = numericAmount * rateNGN;
  const isAmountValid = numericAmount >= 1.0 && numericAmount <= balanceUSDC;

  return (
    <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.sectionHeader}>
        <View style={[styles.stepPill, { backgroundColor: 'rgba(10,132,255,0.08)', borderColor: palette.primary }]}>
          <Banknote size={16} color={palette.primary} />
        </View>
        <View style={styles.sectionCopy}>
          <Text style={[styles.sectionTitle, { color: palette.text }]}>Transfer Amount</Text>
        </View>
      </View>

      {/* Mini Summary Box */}
      <View style={[styles.summaryMini, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.summaryMiniLabel, { color: palette.textSecondary }]}>RECIPIENT</Text>
        <Text style={[styles.summaryMiniValue, { color: palette.text }]}>{activeRecipientName}</Text>
      </View>

      {/* Big Amount Input */}
      <AmountInput
        label="Amount (USDC)"
        value={amount}
        onChangeText={onChangeAmount}
        currencySymbol="$"
        placeholder="0.00"
        helperText={`Available Balance: $${balanceUSDC.toFixed(2)} USDC (~₦${(balanceUSDC * rateNGN).toLocaleString('en-NG')})`}
        presetChips={[
          { label: '$10', amount: 10 },
          { label: '$25', amount: 25 },
          { label: '$50', amount: 50 },
          { label: '$100', amount: 100 },
          { label: 'MAX', amount: balanceUSDC },
        ]}
        onPresetSelect={(val) => onChangeAmount(val.toString())}
      />

      {/* NGN Conversion Callout */}
      {numericAmount > 0 && (
        <View style={[styles.conversionBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
          <Text style={[styles.conversionLabel, { color: palette.textSecondary }]}>Equivalent in NGN</Text>
          <Text style={[styles.conversionValue, { color: palette.primary }]}>
            ₦{amountNGN.toLocaleString('en-NG', { maximumFractionDigits: 2 })}
          </Text>
        </View>
      )}

      {/* Validation Warnings */}
      {numericAmount > 0 && numericAmount < 1.0 ? (
        <View style={[styles.statusCard, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: '#F59E0B' }]}>
          <AlertTriangle size={18} color="#F59E0B" />
          <Text style={[styles.statusTitle, { color: '#F59E0B' }]}>
            Minimum transfer amount is $1.00 USDC
          </Text>
        </View>
      ) : null}

      {numericAmount > balanceUSDC ? (
        <View style={[styles.statusCard, { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: palette.error }]}>
          <AlertTriangle size={18} color={palette.error} />
          <Text style={[styles.statusTitle, { color: palette.error }]}>
            Amount exceeds available balance (${balanceUSDC.toFixed(2)})
          </Text>
        </View>
      ) : null}

      {/* Review Transfer Action */}
      <TouchableOpacity
        onPress={onContinueToReview}
        disabled={!isAmountValid}
        style={[
          styles.primaryButton,
          { backgroundColor: isAmountValid ? palette.primary : palette.border, marginTop: Spacing.md },
        ]}
      >
        <Text style={styles.primaryButtonText}>Review Transfer</Text>
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
  summaryMini: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 2,
  },
  summaryMiniLabel: { fontSize: 10, fontFamily: Typography.family.bold, letterSpacing: 0.8 },
  summaryMiniValue: { fontSize: Typography.sm, fontFamily: Typography.family.bold },
  conversionBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversionLabel: { fontSize: Typography.xs, fontFamily: Typography.family.medium },
  conversionValue: { fontSize: Typography.md, fontFamily: Typography.family.bold },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  statusTitle: { fontSize: Typography.sm, fontFamily: Typography.family.bold },
  primaryButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: Typography.md, fontFamily: Typography.family.bold },
});
