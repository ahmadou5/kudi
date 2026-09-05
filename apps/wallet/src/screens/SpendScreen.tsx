import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';

interface SpendScreenProps {
  rateNGN: number;
  onSpendSubmit: (amountUSDC: number, bankCode: string, accountNumber: string, accountName: string, pin: string) => Promise<void>;
  onResolveAccount: (accountNumber: string, bankCode: string) => Promise<string>;
}

export const SpendScreen: React.FC<SpendScreenProps> = ({ rateNGN, onSpendSubmit, onResolveAccount }) => {
  const [spendUSDC, setSpendUSDC] = useState<string>('30');
  const [pin, setPin] = useState<string>('1234');
  const [bankCode, setBankCode] = useState<string>('058');
  const [accountNumber, setAccountNumber] = useState<string>('0123456789');
  const [accountName, setAccountName] = useState<string>('');
  const [isResolving, setIsResolving] = useState<boolean>(false);
  const [isSpending, setIsSpending] = useState<boolean>(false);

  const handleResolve = async () => {
    setIsResolving(true);
    try {
      const resolved = await onResolveAccount(accountNumber, bankCode);
      setAccountName(resolved);
    } finally {
      setIsResolving(false);
    }
  };

  const handleConfirm = async () => {
    setIsSpending(true);
    try {
      await onSpendSubmit(parseFloat(spendUSDC) || 0, bankCode, accountNumber, accountName, pin);
    } finally {
      setIsSpending(false);
    }
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Spend USDC to Nigerian Bank</Text>

      <Text style={styles.label}>Amount (USDC)</Text>
      <TextInput
        style={styles.input}
        value={spendUSDC}
        onChangeText={setSpendUSDC}
        keyboardType="decimal-pad"
      />
      <Text style={styles.conversionPreview}>
        Recipient receives: ₦{((parseFloat(spendUSDC) || 0) * rateNGN).toLocaleString()} NGN
      </Text>

      <Text style={styles.label}>Bank Account Number</Text>
      <View style={styles.rowInput}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          value={accountNumber}
          onChangeText={setAccountNumber}
          keyboardType="number-pad"
          maxLength={10}
        />
        <TouchableOpacity style={styles.resolveButton} onPress={handleResolve}>
          {isResolving ? <ActivityIndicator color="#fff" /> : <Text style={styles.resolveButtonText}>Verify</Text>}
        </TouchableOpacity>
      </View>

      {accountName ? <Text style={styles.verifiedName}>Account Name: {accountName}</Text> : null}

      <Text style={styles.label}>Transaction PIN</Text>
      <TextInput
        style={styles.input}
        value={pin}
        onChangeText={setPin}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={4}
      />

      <TouchableOpacity style={styles.spendButton} onPress={handleConfirm} disabled={isSpending}>
        {isSpending ? <ActivityIndicator color="#fff" /> : <Text style={styles.spendButtonText}>CONFIRM & SPEND</Text>}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  label: { color: '#9ca3af', fontSize: 12, marginTop: 8 },
  input: { backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff', padding: 12, borderRadius: 8, fontSize: 16, marginTop: 4 },
  rowInput: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  resolveButton: { backgroundColor: '#06b6d4', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginTop: 4 },
  resolveButtonText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
  verifiedName: { color: '#34d399', fontSize: 13, marginTop: 4 },
  conversionPreview: { color: '#34d399', fontSize: 14, fontWeight: 'bold', marginTop: 4 },
  spendButton: { backgroundColor: '#8b5cf6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  spendButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});
