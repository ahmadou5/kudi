import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { TransactionCard, TransactionData } from '../../components/TransactionCard';

import { useTransactions } from '../../src/hooks/useTransactions';

export default function HistoryTab() {
  const palette = useAppPalette();
  const { data: apiTxs, isLoading } = useTransactions(50);

  const historyItems: TransactionData[] = (apiTxs && apiTxs.length > 0)
    ? apiTxs.map((tx, idx) => {
        const isDep = tx.toUserId !== 'bank_payout_gtbank' && !tx.reference.includes('SPEND');
        const amountNum = parseFloat(String(tx.amount || 0));
        const amountNGN = amountNum * 1585.50;
        return {
          id: tx.reference || `tx_${idx}`,
          ref: tx.reference,
          title: tx.metadata?.title || tx.reference,
          subtitle: tx.metadata?.subtitle || (isDep ? 'USDC Deposit' : 'Bank Transfer'),
          amount: `${isDep ? '+' : '-'}₦${amountNGN.toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
          secondaryAmount: `${amountNum.toFixed(2)} USDC`,
          status: 'SUCCESS',
          date: tx.timestamp ? new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent',
          isDeposit: isDep
        };
      })
    : [
        {
          id: '1',
          ref: 'TRF_PAYSTACK_9921',
          title: 'TRF_PAYSTACK_9921',
          subtitle: 'GTBank (**** 5678)',
          amount: '-₦15,855.00',
          secondaryAmount: '10.00 USDC',
          status: 'SUCCESS',
          date: 'Today, 10:32 AM',
          isDeposit: false
        },
        {
          id: '2',
          ref: 'DEP_SOLANA_0012',
          title: 'DEP_SOLANA_0012',
          subtitle: 'Solana Network',
          amount: '+₦158,550.00',
          secondaryAmount: '100.00 USDC',
          status: 'COMPLETED',
          date: 'Today, 09:15 AM',
          isDeposit: true
        }
      ];


  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[Typography.title1, { color: palette.text }]}>Activities</Text>

      <View style={{ gap: 12, marginTop: 16 }}>
        {historyItems.map((item) => (
          <TransactionCard key={item.id || item.ref} item={item} />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 }
});

