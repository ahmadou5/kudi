import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export const DepositScreen: React.FC = () => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Deposit Addresses</Text>
      
      <View style={styles.walletBox}>
        <View style={styles.chainRow}>
          <Text style={styles.chainName}>Monad Metropolis Testnet (AUSD)</Text>
          <Text style={styles.chainBadge}>EVM</Text>
        </View>
        <Text style={styles.walletAddress}>0x71C7656EC7ab88b098defB751B7401B5f6d8976F</Text>
        <Text style={styles.walletHint}>Self-custodied via Privy Server Wallet</Text>
      </View>

      <View style={styles.walletBox}>
        <View style={styles.chainRow}>
          <Text style={styles.chainName}>Solana Mainnet (USDC)</Text>
          <Text style={styles.chainBadge}>SOL</Text>
        </View>
        <Text style={styles.walletAddress}>Sol4kUdiDemoDepositAddress11111111111111111</Text>
        <Text style={styles.walletHint}>Self-custodied via Privy Server Wallet</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  section: { gap: 12 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
  walletBox: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12
  },
  chainRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  chainName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  chainBadge: { color: '#8b5cf6', fontWeight: 'bold', fontSize: 12 },
  walletAddress: { color: '#06b6d4', fontSize: 12, fontFamily: 'monospace', marginVertical: 4 },
  walletHint: { color: '#6b7280', fontSize: 11 }
});
