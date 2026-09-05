import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface HistoryScreenProps {
  spendSuccess: string | null;
}

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ spendSuccess }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Transaction History</Text>

      {spendSuccess && (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{spendSuccess}</Text>
        </View>
      )}

      <View style={styles.historyItem}>
        <View>
          <Text style={styles.historyTitle}>Spend to Bank (GTBank)</Text>
          <Text style={styles.historySub}>Paystack Rail · ₦47,565 NGN</Text>
        </View>
        <Text style={styles.historyAmount}>-30.00 USDC</Text>
      </View>

      <View style={styles.historyItem}>
        <View>
          <Text style={styles.historyTitle}>Deposit (Monad AUSD)</Text>
          <Text style={styles.historySub}>On-chain Confirmed</Text>
        </View>
        <Text style={[styles.historyAmount, { color: '#10b981' }]}>+300.00 AUSD</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12,
    marginBottom: 8
  },
  historyTitle: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  historySub: { color: '#9ca3af', fontSize: 12 },
  historyAmount: { color: '#ef4444', fontWeight: 'bold', fontSize: 14 },
  successBanner: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    padding: 12,
    borderRadius: 8,
    borderColor: '#10b981',
    borderWidth: 1,
    marginBottom: 12
  },
  successText: { color: '#34d399', fontSize: 13, fontWeight: 'bold' }
});
