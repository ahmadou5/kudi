import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Image,
  Linking,
  Clipboard
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import {
  X,
  Send,
  RefreshCw,
  Check,
  Clock,
  Copy,
  CheckCircle2,
  ExternalLink
} from 'lucide-react-native';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { ChainLogo } from '../components/ui/ChainLogo';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TransactionDetailsScreen() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
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

  const isSuccess = ['SUCCESS', 'COMPLETED', 'CONFIRMED', 'DONE'].includes(status.toUpperCase());
  const isPending = ['PENDING', 'PROCESSING', 'BROADCAST'].includes(status.toUpperCase());

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
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      {/* Top Header Bar */}
      <View style={[styles.header, { borderBottomColor: palette.border }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={[styles.closeBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <X size={18} color={palette.text} />
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

        {/* TRANSACTION STATUS TRACKER LINE - Only displayed for spend / outgoing transactions */}
        {!isDeposit && (
          <View style={[styles.trackerCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <View style={styles.trackerHeader}>
              <View style={styles.trackerHeaderLeft}>
                <View style={[styles.pulseDot, { backgroundColor: statusColor }]} />
                <Text style={[Typography.caption, { color: palette.textSecondary, letterSpacing: 0.8, fontSize: 11, fontWeight: '600' }]}>
                  TRANSACTION PROGRESS
                </Text>
              </View>
              <View style={[styles.stepCountBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}>
                <Text style={[Typography.caption, { color: statusColor, fontSize: 10, fontWeight: '700' }]}>
                  {isSuccess ? 'Completed' : isPending ? 'In Progress' : 'Failed'}
                </Text>
              </View>
            </View>

            <View style={styles.timelineContainer}>
              {/* Connector lines behind nodes */}
              <View style={styles.trackLineOverlay}>
                <View style={[styles.trackSegment, { backgroundColor: statusColor }]} />
                <View style={[styles.trackSegment, { backgroundColor: isSuccess ? statusColor : isDark ? '#334155' : '#E2E8F0' }]} />
              </View>

              <View style={styles.timelineRow}>
                {/* Stage 1: Requested */}
                <View style={styles.stageNode}>
                  <View style={[styles.nodeCircle, { backgroundColor: statusColor + '20', borderColor: statusColor }]}>
                    <Send size={13} color={statusColor} />
                  </View>
                  <Text style={[Typography.caption, { color: palette.text, fontWeight: '700', fontSize: 11, marginTop: 6 }]}>
                    Requested
                  </Text>
                  <Text style={[Typography.caption, { color: palette.textSecondary, fontSize: 10 }]}>
                    Submitted
                  </Text>
                </View>

                {/* Stage 2: Processing */}
                <View style={styles.stageNode}>
                  <View style={[
                    styles.nodeCircle,
                    {
                      backgroundColor: (isPending || isSuccess) ? statusColor + '20' : (isDark ? '#1E293B' : '#F1F5F9'),
                      borderColor: (isPending || isSuccess) ? statusColor : (isDark ? '#334155' : '#CBD5E1')
                    }
                  ]}>
                    <RefreshCw
                      size={13}
                      color={(isPending || isSuccess) ? statusColor : palette.textSecondary}
                    />
                  </View>
                  <Text style={[
                    Typography.caption,
                    {
                      color: (isPending || isSuccess) ? palette.text : palette.textSecondary,
                      fontWeight: '700',
                      fontSize: 11,
                      marginTop: 6
                    }
                  ]}>
                    Processing
                  </Text>
                  <Text style={[Typography.caption, { color: palette.textSecondary, fontSize: 10 }]}>
                    Network
                  </Text>
                </View>

                {/* Stage 3: Completed */}
                <View style={styles.stageNode}>
                  <View style={[
                    styles.nodeCircle,
                    {
                      backgroundColor: isSuccess ? palette.success + '20' : (isDark ? '#1E293B' : '#F1F5F9'),
                      borderColor: isSuccess ? palette.success : (isDark ? '#334155' : '#CBD5E1')
                    }
                  ]}>
                    {isSuccess ? (
                      <Check size={13} color={palette.success} />
                    ) : (
                      <Clock size={13} color={palette.textSecondary} />
                    )}
                  </View>
                  <Text style={[
                    Typography.caption,
                    {
                      color: isSuccess ? palette.success : palette.textSecondary,
                      fontWeight: '700',
                      fontSize: 11,
                      marginTop: 6
                    }
                  ]}>
                    {isSuccess ? 'Completed' : 'Pending'}
                  </Text>
                  <Text style={[Typography.caption, { color: palette.textSecondary, fontSize: 10 }]}>
                    {isSuccess ? 'Finalized' : 'Awaiting'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

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
                {copied ? (
                  <CheckCircle2 size={14} color={palette.success} />
                ) : (
                  <Copy size={14} color={palette.textSecondary} />
                )}
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
            <ExternalLink size={18} color={palette.bg} />
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
  trackerCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 16
  },
  trackerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  trackerHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5
  },
  stepCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  timelineContainer: {
    position: 'relative',
    paddingHorizontal: 8
  },
  trackLineOverlay: {
    position: 'absolute',
    top: 15,
    left: 44,
    right: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 1
  },
  trackSegment: {
    flex: 1,
    height: 2,
    marginHorizontal: 4
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    zIndex: 2
  },
  stageNode: {
    alignItems: 'center',
    width: 72
  },
  nodeCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center'
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
