import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { Zap, ArrowDownCircle, ArrowUpCircle, ArrowDown, ArrowUp, Clock, LucideIcon, BadgeAlert, BadgeCheck, BadgeX, ExternalLink } from 'lucide-react-native';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { ChainLogo } from './ui/ChainLogo';
import { router } from 'expo-router';

export type BrandProvider = 'usdc' | 'ausd' | 'solana' | 'monad' | 'mtn' | 'airtel' | 'glo' | '9mobile' | 'electricity' | 'gtbank' | 'zenith' | 'paystack' | 'monnify' | 'generic';

const BRAND_LOGOS: Record<string, ImageSourcePropType> = {
  usdc: require('../../assets/logos/usdc.png'),
  ausd: require('../../assets/logos/ausd.png'),
  solana: require('../../assets/logos/solana.png'),
  monad: require('../../assets/logos/monad.png'),
  mtn: require('../../assets/logos/mtn.png'),
  airtel: require('../../assets/logos/airtel.png'),
  glo: require('../../assets/logos/glo.png'),
  '9mobile': require('../../assets/logos/9mobile.png'),
  gtbank: require('../../assets/logos/gtbank.png'),
  zenith: require('../../assets/logos/zenith.png'),
};

export interface TransactionData {
  id?: string;
  ref?: string;
  txHash?: string;
  title: string;
  subtitle?: string;
  amount: string;
  secondaryAmount?: string;
  status: string;
  date: string;
  isDeposit?: boolean;
  icon?: LucideIcon | string;
  provider?: BrandProvider | string;
  chain?: 'solana' | 'monad' | 'monad-testnet' | string;
  tokenSymbol?: 'USDC' | 'AUSD' | string;
  metadata?: Record<string, any>;
}

interface TransactionCardProps {
  item: TransactionData;
  onPress?: () => void;
  compact?: boolean;
}

function detectProvider(item: TransactionData): BrandProvider {
  if (item.provider) return item.provider.toLowerCase() as BrandProvider;

  const text = `${item.title} ${item.subtitle || ''} ${item.secondaryAmount || ''} ${item.ref || ''} ${item.tokenSymbol || ''}`.toLowerCase();

  if (text.includes('ausd') || text.includes('monad')) return 'ausd';
  if (text.includes('usdc') || text.includes('solana')) return 'usdc';
  if (text.includes('mtn')) return 'mtn';
  if (text.includes('airtel')) return 'airtel';
  if (text.includes('glo')) return 'glo';
  if (text.includes('9mobile') || text.includes('etisalat')) return '9mobile';
  if (text.includes('electricity') || text.includes('ikedc') || text.includes('ekedc')) return 'electricity';
  if (text.includes('gtbank') || text.includes('paystack')) return 'gtbank';
  if (text.includes('zenith') || text.includes('monnify')) return 'zenith';

  return 'generic';
}

function detectChain(item: TransactionData): 'monad' | 'solana' | null {
  if (item.chain) {
    const c = item.chain.toLowerCase();
    if (c.includes('monad')) return 'monad';
    if (c.includes('solana')) return 'solana';
  }
  const text = `${item.title} ${item.subtitle || ''} ${item.amount}`.toLowerCase();
  if (text.includes('monad') || text.includes('ausd')) return 'monad';
  if (text.includes('solana') || text.includes('usdc')) return 'solana';
  return null;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ item, onPress, compact = false }) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const [isExpanded, setIsExpanded] = useState(false);

  const isDeposit = item.isDeposit ?? item.amount.startsWith('+');
  const provider = detectProvider(item);
  const detectedChain = detectChain(item);

  // Status Badge Colors
  const isSuccess = ['SUCCESS', 'COMPLETED', 'CONFIRMED', 'DONE'].includes(item.status.toUpperCase());
  const isPending = ['PENDING', 'PROCESSING', 'BROADCAST'].includes(item.status.toUpperCase());

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

  const navigateToDetails = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: '/transaction-details',
        params: {
          id: item.id || item.ref,
          ref: item.ref || item.id,
          txHash: item.txHash || item.ref,
          title: item.title,
          subtitle: item.subtitle,
          amount: item.amount,
          secondaryAmount: item.secondaryAmount,
          status: isSuccess ? 'CONFIRMED' : item.status,
          date: item.date,
          isDeposit: String(isDeposit),
          chain: item.chain || detectedChain || '',
          tokenSymbol: item.tokenSymbol || (provider === 'ausd' ? 'AUSD' : 'USDC')
        }
      });
    }
  };

  const handleCardPress = () => {
    navigateToDetails();
  };

  const renderBrandIcon = () => {
    const logoSource = BRAND_LOGOS[provider];

    if (logoSource) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: palette.border, borderWidth: 1 }]}>
          <Image source={logoSource} style={styles.logoImage} resizeMode="contain" />
        </View>
      );
    }

    if (provider === 'electricity') {
      return (
        <View style={[styles.brandContainer, { backgroundColor: '#F59E0B' }]}>
          <Zap size={20} color="#FFFFFF" />
        </View>
      );
    }

    return (
      <View
        style={[
          styles.brandContainer,
          {
            backgroundColor: isDeposit
              ? (isDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)')
              : (isDark ? 'rgba(244, 63, 94, 0.16)' : 'rgba(244, 63, 94, 0.12)')
          }
        ]}
      >
        {isDeposit ? (
          <ArrowDownCircle size={20} color="#10B981" />
        ) : (
          <ArrowUpCircle size={20} color="#F43F5E" />
        )}
      </View>
    );
  };

  if (compact) {
    const amountOnly = item.amount.replace(/\s*(USDC|AUSD|NGN).*/gi, '').trim();

    return (
      <TouchableOpacity
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.75}
        style={[
          styles.card,
          {
            backgroundColor: palette.card,
            borderColor: palette.border,
            paddingVertical: 12,
            paddingHorizontal: 16
          }
        ]}
      >
        <View style={styles.topRow}>
          {/* Main Token Logo + Chain Logo Corner Badge Overlay */}
          <View style={styles.leftGroup}>
            <View style={styles.iconWrapper}>
              {renderBrandIcon()}

              {detectedChain ? (
                <View style={[styles.chainBadgeOverlay, { borderColor: palette.card }]}>
                  <ChainLogo chain={detectedChain} size={14} />
                </View>
              ) : (
                <View style={[styles.directionOverlay, { backgroundColor: isDeposit ? '#10B981' : '#F43F5E', borderColor: palette.card }]}>
                  {isDeposit ? (
                    <ArrowDown size={9} color="#FFFFFF" />
                  ) : (
                    <ArrowUp size={9} color="#FFFFFF" />
                  )}
                </View>
              )}
            </View>

            <View style={styles.titleStack}>
              <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 14 }]} numberOfLines={1}>
                {isDeposit ? 'Deposit' : 'Spend'}
              </Text>
              {!isExpanded && (
                <Text
                  style={[
                    Typography.currencySub,
                    {
                      color: isDeposit ? palette.success : palette.text,
                      fontSize: 14
                    }
                  ]}
                  numberOfLines={1}
                >
                  {amountOnly}
                </Text>
              )}
            </View>
          </View>

          {/* Right Group: Status Badge ONLY */}
          <View style={styles.rightHeaderGroup}>
            <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
              <Text style={[Typography.footnote, { color: statusColor, fontSize: 11, fontWeight: '700' }]}>
                {isSuccess ? 'CONFIRMED' : isPending ? 'PENDING' : item.status.toUpperCase()}
              </Text>
              {isPending && <BadgeAlert size={14} color={statusColor} />}
              {isSuccess && <BadgeCheck size={14} color={statusColor} />}
              {!isPending && !isSuccess && <BadgeX size={14} color={statusColor} />}
            </View>
          </View>
        </View>

        {/* Expanded Panel (Revealed on Tap) */}
        {isExpanded && (
          <View style={styles.expandedPanel}>
            <View style={styles.expandedRow}>
              <View style={styles.amountStack}>
                <Text style={[Typography.currencySub, { color: isDeposit ? palette.success : palette.text, fontSize: 16 }]}>
                  {item.amount}
                </Text>
                {!!item.secondaryAmount && (
                  <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 12 }]}>
                    {item.secondaryAmount.startsWith('Via') ? item.secondaryAmount : `Via ${item.secondaryAmount}`}
                  </Text>
                )}
              </View>

              <View style={styles.rightExpandedStack}>
                {!!item.subtitle && (
                  <Text style={[Typography.caption, { color: palette.textSecondary, fontSize: 11, fontWeight: '600' }]}>
                    {item.subtitle}
                  </Text>
                )}
                <View style={styles.dateGroup}>
                  <Clock size={11} color={palette.textSecondary} />
                  <Text style={[Typography.footnote, { color: palette.textSecondary, fontSize: 11 }]}>
                    {item.date}
                  </Text>
                </View>
              </View>
            </View>

            <TouchableOpacity
              onPress={navigateToDetails}
              style={[styles.viewDetailsBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)', borderColor: palette.border }]}
              activeOpacity={0.7}
            >
              <Text style={[Typography.caption, { color: palette.text, fontWeight: '700', fontSize: 12 }]}>
                View Details
              </Text>
              <ExternalLink size={12} color={palette.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleCardPress}
      activeOpacity={0.75}
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          paddingVertical: 16,
          paddingHorizontal: 16
        }
      ]}
    >
      <View style={styles.topRow}>
        {/* Main Token Logo + Chain Logo Corner Badge Overlay */}
        <View style={styles.leftGroup}>
          <View style={styles.iconWrapper}>
            {renderBrandIcon()}

            {detectedChain ? (
              <View style={[styles.chainBadgeOverlay, { borderColor: palette.card }]}>
                <ChainLogo chain={detectedChain} size={14} />
              </View>
            ) : (
              <View style={[styles.directionOverlay, { backgroundColor: isDeposit ? '#10B981' : '#F43F5E', borderColor: palette.card }]}>
                {isDeposit ? (
                  <ArrowDown size={9} color="#FFFFFF" />
                ) : (
                  <ArrowUp size={9} color="#FFFFFF" />
                )}
              </View>
            )}
          </View>

          <View style={styles.titleStack}>
            <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 14 }]} numberOfLines={1}>
              {item.title}
            </Text>
            {!!item.subtitle && (
              <Text style={[Typography.subhead, { color: palette.textSecondary, fontSize: 12 }]} numberOfLines={1}>
                {item.subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Right Status Badge */}
        <View style={styles.rightHeaderGroup}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
            <Text style={[Typography.footnote, { color: statusColor, fontSize: 11, fontWeight: '700' }]}>
              {isSuccess ? 'CONFIRMED' : isPending ? 'PENDING' : item.status.toUpperCase()}
            </Text>
            {isPending && <BadgeAlert size={14} color={statusColor} />}
            {isSuccess && <BadgeCheck size={14} color={statusColor} />}
            {!isPending && !isSuccess && <BadgeX size={14} color={statusColor} />}
          </View>
        </View>
      </View>

      {/* Amount & Date Bottom Row for History View */}
      <View style={styles.bottomRow}>
        <View style={styles.amountStack}>
          <Text
            style={[
              Typography.currencySub,
              {
                color: isDeposit ? palette.success : palette.text,
                fontSize: 16
              }
            ]}
          >
            {item.amount}
          </Text>
          {!!item.secondaryAmount && (
            <Text style={[Typography.currencySub, { color: palette.textSecondary, fontSize: 11 }]}>
              {item.secondaryAmount.startsWith('Via') ? item.secondaryAmount : `Via ${item.secondaryAmount}`}
            </Text>
          )}
        </View>

        <View style={styles.dateGroup}>
          <Clock size={12} color={palette.textSecondary} />
          <Text style={[Typography.footnote, { color: palette.textSecondary, fontSize: 11 }]}>
            {item.date}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    marginRight: 8
  },
  iconWrapper: {
    position: 'relative'
  },
  brandContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  logoImage: {
    width: 32,
    height: 32,
    borderRadius: 16
  },
  directionOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5
  },
  chainBadgeOverlay: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    overflow: 'hidden',
    backgroundColor: '#0F172A'
  },
  titleStack: {
    flex: 1,
    gap: 2
  },
  rightHeaderGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  expandChevronCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.15)'
  },
  amountStack: {
    gap: 2
  },
  rightBottomGroup: {
    alignItems: 'flex-end',
    gap: 6
  },
  dateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  },
  detailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1
  },
  expandedPanel: {
    paddingTop: 10,
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.18)',
    gap: 10
  },
  expandedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  rightExpandedStack: {
    alignItems: 'flex-end',
    gap: 4
  },
  viewDetailsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 2
  }
});
