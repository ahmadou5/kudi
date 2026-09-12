import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Clipboard,
  Animated
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { ChainLogo } from '../components/ui/ChainLogo';

export default function TransactionDetailsScreen() {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const params = useLocalSearchParams();

  const [copied, setCopied] = useState(false);

  // Parse passed params
  const title = (params.title as string) || 'Transaction Details';
  const subtitle = (params.subtitle as string) || '';
  const amount = (params.amount as string) || '$0.00';
  const secondaryAmount = (params.secondaryAmount as string) || '';
  const status = (params.status as string) || 'SUCCESS';
  const date = (params.date as string) || 'Recently';
  const isDeposit = params.isDeposit === 'true' || amount.startsWith('+');
  const chain = (params.chain as string) || '';
  const tokenSymbol = (params.tokenSymbol as string) || (amount.includes('AUSD') ? 'AUSD' : 'USDC');
  const ref = (params.ref as string) || (params.id as string) || 'REF_UNKNOWN';
  const txHash = (params.txHash as string) || (ref.startsWith('0x') || ref.length > 25 ? ref : '');

  // Logos resolution
  const isMonad = chain.includes('monad') || tokenSymbol === 'AUSD' || title.toLowerCase().includes('ausd');
  const isSolana = chain.includes('solana') || tokenSymbol === 'USDC' || subtitle.toLowerCase().includes('solana');

  let tokenLogo = require('../assets/logos/usdc.png');
  if (isMonad) {
    tokenLogo = require('../assets/logos/ausd.png');
  } else if (title.toLowerCase().includes('gtbank') || subtitle.toLowerCase().includes('gtbank')) {
    tokenLogo = require('../assets/logos/gtbank.png');
  } else if (title.toLowerCase().includes('zenith') || subtitle.toLowerCase().includes('zenith')) {
    tokenLogo = require('../assets/logos/zenith.png');
  }

  // Explorer link construction
  let explorerUrl: string | null = null;
  if (txHash) {
    if (isMonad) {
      explorerUrl = `https://testnet.monadexplorer.com/tx/${txHash}`;
    } else if (isSolana) {
      explorerUrl = `https://explorer.solana.com/tx/${txHash}?cluster=devnet`;
    }
  }

  const handleCopyRef = () => {
    Clipboard.setString(ref);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleOpenExplorer = () => {
    if (explorerUrl) {
      Linking.openURL(explorerUrl).catch((err) =>
        console.warn('Could not open explorer link:', err)
      );
    }
  };

  const isSuccess = ['SUCCESS', 'COMPLETED', 'DONE'].includes(status.toUpperCase());
  const isPending = ['PENDING', 'PROCESSING'].includes(status.toUpperCase());

  const statusBg = isSuccess
    ? 'rgba(52, 211, 153, 0.15)'
    : isPending
    ? 'rgba(251, 191, 36, 0.15)'
    : 'rgba(244, 63, 94, 0.15)';

  const statusColor = isSuccess
    ? '#34D399'
    : isPending
    ? '#FBBF24'
    : '#F43F5E';

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      {/* Top Header Bar */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title3, { color: palette.text }]}>Transaction Details</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Hero Card */}
        <View style={[styles.heroCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {/* Dual Token + Chain Badge Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={[styles.tokenLogoCircle, { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: palette.border }]}>
              <Image source={tokenLogo} style={styles.tokenLogoImg} resizeMode="contain" />
            </View>

            {(isMonad || isSolana) && (
              <View style={[styles.chainBadgeCircle, { borderColor: palette.card }]}>
                <ChainLogo chain={isMonad ? 'monad' : 'solana'} size={20} />
              </View>
            )}
          </View>

          {/* Amount Display */}
          <Text
            style={[
              Typography.currencyDisplay,
              styles.heroAmount,
              { color: isDeposit ? palette.success : palette.text }
            ]}
          >
            {amount}
          </Text>

          {!!secondaryAmount && (
            <Text style={[Typography.bodyBold, { color: palette.textSecondary }]}>
              {secondaryAmount}
            </Text>
          )}

          {/* Status Badge */}
          <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[Typography.caption, { color: statusColor, fontWeight: '700' }]}>
              {status}
            </Text>
          </View>
        </View>

        {/* Info Rows Container */}
        <View style={[styles.detailsContainer, { backgroundColor: palette.card, borderColor: palette.border }]}>
          <View style={styles.infoRow}>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>Type</Text>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>
              {title}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          <View style={styles.infoRow}>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>Network / Chain</Text>
            <View style={styles.rowRightGroup}>
              {(isMonad || isSolana) && <ChainLogo chain={isMonad ? 'monad' : 'solana'} size={16} />}
              <Text style={[Typography.bodyBold, { color: palette.text }]}>
                {isMonad ? 'Monad Testnet' : isSolana ? 'Solana Network' : 'Bank Payout (NGN)'}
              </Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          <View style={styles.infoRow}>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>Asset / Currency</Text>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>
              {tokenSymbol}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          <View style={styles.infoRow}>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>Date & Time</Text>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>
              {date}
            </Text>
          </View>

          <View style={[styles.divider, { backgroundColor: palette.border }]} />

          {/* Reference Row with Copy Button */}
          <View style={styles.infoRowVertical}>
            <View style={styles.refHeaderRow}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>Reference / Hash</Text>
              <TouchableOpacity onPress={handleCopyRef} activeOpacity={0.7} style={styles.copyBtn}>
                <Ionicons name={copied ? 'checkmark-circle' : 'copy-outline'} size={14} color={copied ? palette.success : palette.textSecondary} />
                <Text style={[Typography.caption, { color: copied ? palette.success : palette.textSecondary, fontWeight: '600' }]}>
                  {copied ? 'Copied!' : 'Copy'}
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[Typography.footnote, styles.refText, { color: palette.text }]}>
              {ref}
            </Text>
          </View>
        </View>

        {/* Action Button: View on Block Explorer */}
        {!!explorerUrl && (
          <TouchableOpacity
            onPress={handleOpenExplorer}
            style={[styles.explorerBtn, { backgroundColor: palette.text }]}
            activeOpacity={0.8}
          >
            <Ionicons name="open-outline" size={18} color={palette.bg} />
            <Text style={[Typography.bodyBold, { color: palette.bg }]}>
              View on {isMonad ? 'Monad Explorer' : 'Solana Explorer'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  scrollContent: {
    padding: 20,
    gap: 16
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    alignItems: 'center',
    gap: 10
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 4
  },
  tokenLogoCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden'
  },
  tokenLogoImg: {
    width: 44,
    height: 44,
    borderRadius: 22
  },
  chainBadgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center'
  },
  heroAmount: {
    marginTop: 4
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 4
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3
  },
  detailsContainer: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 12
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  infoRowVertical: {
    gap: 6
  },
  refHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rowRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  divider: {
    height: StyleSheet.hairlineWidth
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  refText: {
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12
  },
  explorerBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8
  }
});
