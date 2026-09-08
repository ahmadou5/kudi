import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, ImageSourcePropType } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppPalette } from '../lib/theme';
import { Typography } from '../constants/typography';
import { ChainLogo } from './ui/ChainLogo';

export type BrandProvider = 'usdc' | 'solana' | 'monad' | 'mtn' | 'airtel' | 'glo' | '9mobile' | 'electricity' | 'gtbank' | 'zenith' | 'paystack' | 'monnify' | 'generic';

const BRAND_LOGOS: Record<string, ImageSourcePropType> = {
  usdc: require('../assets/logos/usdc.png'),
  solana: require('../assets/logos/solana.png'),
  mtn: require('../assets/logos/mtn.png'),
  airtel: require('../assets/logos/airtel.png'),
  glo: require('../assets/logos/glo.png'),
  '9mobile': require('../assets/logos/9mobile.png'),
  gtbank: require('../assets/logos/gtbank.png'),
  zenith: require('../assets/logos/zenith.png'),
};

export interface TransactionData {
  id?: string;
  ref?: string;
  title: string;
  subtitle?: string;
  amount: string;
  secondaryAmount?: string;
  status: string;
  date: string;
  isDeposit?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  provider?: BrandProvider | string;
}

interface TransactionCardProps {
  item: TransactionData;
  onPress?: () => void;
  compact?: boolean;
}

function detectProvider(item: TransactionData): BrandProvider {
  if (item.provider) return item.provider.toLowerCase() as BrandProvider;

  const text = `${item.title} ${item.subtitle || ''} ${item.secondaryAmount || ''} ${item.ref || ''}`.toLowerCase();

  if (text.includes('solana')) return 'solana';
  if (text.includes('monad') || text.includes('ausd')) return 'monad';
  if (text.includes('mtn')) return 'mtn';
  if (text.includes('airtel')) return 'airtel';
  if (text.includes('glo')) return 'glo';
  if (text.includes('9mobile') || text.includes('etisalat')) return '9mobile';
  if (text.includes('electricity') || text.includes('ikedc') || text.includes('ekedc')) return 'electricity';
  if (text.includes('gtbank') || text.includes('paystack')) return 'gtbank';
  if (text.includes('zenith') || text.includes('monnify')) return 'zenith';
  if (text.includes('usdc')) return 'usdc';

  return 'generic';
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ item, onPress, compact = false }) => {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';

  const isDeposit = item.isDeposit ?? item.amount.startsWith('+');
  const provider = detectProvider(item);

  // Status Badge Colors
  const isSuccess = ['SUCCESS', 'COMPLETED', 'DONE'].includes(item.status.toUpperCase());
  const isPending = ['PENDING', 'PROCESSING'].includes(item.status.toUpperCase());

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

  const renderBrandIcon = () => {
    if (provider === 'monad') {
      return (
        <View style={[styles.brandContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: palette.border, borderWidth: 1 }]}>
          <ChainLogo chain="monad" size={24} />
        </View>
      );
    }

    const logoSource = BRAND_LOGOS[provider];

    if (logoSource) {
      return (
        <View style={[styles.brandContainer, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: palette.border, borderWidth: 1 }]}>
          <Image
            source={logoSource}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      );
    }

    if (provider === 'electricity') {
      return (
        <View style={[styles.brandContainer, { backgroundColor: '#F59E0B' }]}>
          <Ionicons name="flash" size={20} color="#FFFFFF" />
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
        <Ionicons
          name={item.icon || (isDeposit ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline')}
          size={20}
          color={isDeposit ? '#10B981' : '#F43F5E'}
        />
      </View>
    );
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
      disabled={!onPress}
      style={[
        styles.card,
        {
          backgroundColor: palette.card,
          borderColor: palette.border,
          paddingVertical: compact ? 12 : 16,
          paddingHorizontal: 16
        }
      ]}
    >
      <View style={styles.topRow}>
        {/* Left Icon with Real High Quality Brand/Chain Logo + Direction Overlay */}
        <View style={styles.leftGroup}>
          <View style={styles.iconWrapper}>
            {renderBrandIcon()}
            <View style={[styles.directionOverlay, { backgroundColor: isDeposit ? '#10B981' : '#F43F5E', borderColor: palette.card }]}>
              <Ionicons name={isDeposit ? 'arrow-down' : 'arrow-up'} size={9} color="#FFFFFF" />
            </View>
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
        <View style={[styles.statusBadge, { backgroundColor: statusBg, borderColor: statusColor + '40' }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[Typography.caption, { color: statusColor, fontWeight: '700', fontSize: 10 }]}>
            {item.status}
          </Text>
        </View>
      </View>

      {/* Amount & Date Bottom Row */}
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
          <Ionicons name="time-outline" size={12} color={palette.textSecondary} />
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
  titleStack: {
    flex: 1,
    gap: 2
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 0.8
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
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.15)'
  },
  amountStack: {
    gap: 2
  },
  dateGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4
  }
});
