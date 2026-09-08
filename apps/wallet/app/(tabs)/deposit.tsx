import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppPalette } from '../../lib/theme';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { Typography } from '../../constants/typography';
import { AppModal, useAppModal } from '../../components/ui/AppModal';
import { ChainLogo } from '../../components/ui/ChainLogo';
import * as Clipboard from 'expo-clipboard';

import { useVirtualAccounts } from '../../src/hooks/useVirtualAccounts';
import { useAuthStore } from '../../store/auth.store';

type DepositViewMode = 'select' | 'onchain' | 'offchain';
type ChainType = 'solana' | 'monad';

export default function DepositTab() {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const wallets = useAuthStore(s => s.wallets);
  const { data: apiVirtualAccounts } = useVirtualAccounts();

  const [viewMode, setViewMode] = useState<DepositViewMode>('select');
  const [selectedChain, setSelectedChain] = useState<ChainType>('solana');
  const [selectedOffchainAcc, setSelectedOffchainAcc] = useState<'ngn' | 'usd'>('ngn');

  const solanaWallet = wallets.find(w => w.chain === 'solana')?.address || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  const monadWallet = wallets.find(w => w.chain.includes('monad'))?.address || '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

  const addresses = {
    solana: {
      name: 'Solana Network',
      token: 'USDC (SPL)',
      address: solanaWallet,
      minDeposit: '0.10 USDC',
      speed: 'Instant (~1 sec)'
    },
    monad: {
      name: 'Monad Metropolis',
      token: 'AUSD (EVM)',
      address: monadWallet,
      minDeposit: '0.10 AUSD',
      speed: 'Instant (~400 ms)'
    }
  };

  const firstVirtualAcc = apiVirtualAccounts && apiVirtualAccounts.length > 0 ? apiVirtualAccounts[0] : null;

  const virtualAccounts = [
    {
      id: 'ngn',
      bankName: firstVirtualAcc?.bankName || 'Kudi MFB (Wema Bank)',
      accountNumber: firstVirtualAcc?.accountNumber || '9928104812',
      accountName: firstVirtualAcc?.accountName || 'Ahmadou S. / Kudi Float',
      currency: 'NGN (Nigerian Naira)',
      type: 'Local Bank Transfer',
      bgDark: '#0F172A',
      bgLight: '#F8FAFC',
      accentColor: '#34D399'
    },
    {
      id: 'usd',
      bankName: 'Kudi Global Float (USD)',
      accountNumber: 'US89 KUDI 0012 9481 02',
      routingNumber: '121000358',
      accountName: firstVirtualAcc?.accountName || 'Ahmadou S.',
      currency: 'USD (US Dollar)',
      type: 'ACH & Wire Transfer',
      bgDark: '#1E293B',
      bgLight: '#F1F5F9',
      accentColor: '#60A5FA'
    }
  ];


  const modal = useAppModal();

  const handleCopy = async (text: string, label: string) => {
    try {
      await Clipboard.setStringAsync(text);
    } catch (err) {
      console.warn('Clipboard setStringAsync error:', err);
    }
    modal.alert('Copied to Clipboard', `${label}:\n${text}`, 'success');
  };

  // Render Background Pattern Layer for Cards
  const renderPatternBackground = (accentColor: string) => (
    <View style={styles.patternContainer} pointerEvents="none">
      <View
        style={[
          styles.patternRingOuter,
          { borderColor: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.05)' }
        ]}
      />
      <View
        style={[
          styles.patternRingInner,
          { borderColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(15, 23, 42, 0.04)' }
        ]}
      />
      <View
        style={[
          styles.patternGlow,
          { backgroundColor: accentColor, opacity: isDark ? 0.08 : 0.05 }
        ]}
      />
      <View style={styles.dotGrid}>
        {[...Array(6)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.patternDot,
              { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(15, 23, 42, 0.15)' }
            ]}
          />
        ))}
      </View>
    </View>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 110 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Dynamic Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            if (viewMode === 'select') {
              router.back();
            } else {
              setViewMode('select');
            }
          }}
          style={[styles.circularBackBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title1, { color: palette.text }]}>
          {viewMode === 'select'
            ? 'Deposit Funds'
            : viewMode === 'onchain'
              ? 'On-Chain Deposit'
              : 'Virtual Bank Account'}
        </Text>
      </View>

      {/* MODE 1: SELECTION VIEW */}
      {viewMode === 'select' && (
        <View style={styles.selectionStack}>


          {/* On-Chain Deposit Card */}
          <TouchableOpacity
            onPress={() => setViewMode('onchain')}
            activeOpacity={0.85}
            style={[
              styles.choiceCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.border
              }
            ]}
          >
            {renderPatternBackground('#9945FF')}

            <View style={styles.choiceHeader}>
              <View style={[styles.typeBadge, { backgroundColor: 'rgba(153, 69, 255, 0.00)' }]}>

              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
            </View>

            <Text style={[Typography.title2, { color: palette.text, marginTop: 12 }]}>
              On-Chain Deposit
            </Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
              Deposit USDC & crypto directly via Solana or Monad Metropolis networks.
            </Text>

            {/* Asset Badges Row */}
            <View style={styles.assetBadgesRow}>


              <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Image source={require('../../assets/logos/usdc.png')} style={styles.miniLogo} />
                <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>USDC</Text>
              </View>

              <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Ionicons name="cube-outline" size={14} color="#9945FF" />
                <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>AUSD</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Off-Chain Deposit Card */}
          <TouchableOpacity
            onPress={() => setViewMode('offchain')}
            activeOpacity={0.85}
            style={[
              styles.choiceCard,
              {
                backgroundColor: palette.card,
                borderColor: palette.border
              }
            ]}
          >
            {renderPatternBackground('#34D399')}

            <View style={styles.choiceHeader}>
              <View style={[styles.typeBadge, { backgroundColor: 'rgba(52, 211, 153, 0)' }]}>

              </View>
              <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
            </View>

            <Text style={[Typography.title2, { color: palette.text, marginTop: 12 }]}>
              Off-Chain Deposit
            </Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
              Instant local bank transfer to your dedicated virtual account.
            </Text>

            {/* Currency Badges Row */}
            <View style={styles.assetBadgesRow}>
              <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>₦</Text>
              </View>

              <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>$</Text>
              </View>

              <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>€</Text>
              </View>

              <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>£</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* MODE 2: ON-CHAIN DEPOSIT VIEW */}
      {viewMode === 'onchain' && (
        <View style={styles.detailStack}>
          {/* Chain Switcher Tab Controls */}
          <View style={styles.switcherRow}>
            <TouchableOpacity
              onPress={() => setSelectedChain('solana')}
              activeOpacity={0.8}
              style={[
                styles.switcherTab,
                {
                  backgroundColor: selectedChain === 'solana'
                    ? (isDark ? '#1E293B' : '#0F172A')
                    : palette.card,
                  borderColor: palette.border
                }
              ]}
            >
              <ChainLogo chain="solana" size={18} />
              <Text
                style={[
                  Typography.footnote,
                  {
                    color: selectedChain === 'solana' ? '#FFFFFF' : palette.textSecondary,
                    fontWeight: selectedChain === 'solana' ? '700' : '500'
                  }
                ]}
              >
                Solana Devnet (USDC)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setSelectedChain('monad')}
              activeOpacity={0.8}
              style={[
                styles.switcherTab,
                {
                  backgroundColor: selectedChain === 'monad'
                    ? (isDark ? '#1E293B' : '#0F172A')
                    : palette.card,
                  borderColor: palette.border
                }
              ]}
            >
              <ChainLogo chain="monad" size={18} />
              <Text
                style={[
                  Typography.footnote,
                  {
                    color: selectedChain === 'monad' ? '#FFFFFF' : palette.textSecondary,
                    fontWeight: selectedChain === 'monad' ? '700' : '500'
                  }
                ]}
              >
                Monad Testnet (AUSD)
              </Text>
            </TouchableOpacity>
          </View>

          {/* QR Code Visual Frame */}
          <View style={[styles.qrCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {renderPatternBackground(selectedChain === 'solana' ? '#14F195' : '#9945FF')}

            <View style={styles.qrFrameContainer}>
              <View style={styles.qrFrame}>
                {/* Visual Styled QR Grid Graphic */}
                <View style={styles.qrGridGraphic}>
                  <Ionicons
                    name={selectedChain === 'solana' ? 'qr-code-outline' : 'qr-code'}
                    size={110}
                    color={palette.text}
                  />
                </View>
                <View style={[styles.qrCenterBadge, { backgroundColor: selectedChain === 'solana' ? '#9945FF' : '#0F172A' }]}>
                  <Ionicons name={selectedChain === 'solana' ? 'sparkles' : 'cube'} size={18} color="#14F195" />
                </View>
              </View>
            </View>

            <Text style={[Typography.title2, styles.chainTitle, { color: palette.text }]}>
              {addresses[selectedChain].name}
            </Text>

            {/* Address Box */}
            <View style={[styles.addressBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Text style={[Typography.currencySub, styles.addressText, { color: palette.textSecondary }]}>
                {addresses[selectedChain].address}
              </Text>
            </View>

            {/* Copy Button */}
            <TouchableOpacity
              style={[styles.copyBtn, { backgroundColor: palette.text }]}
              onPress={() => handleCopy(addresses[selectedChain].address, `${addresses[selectedChain].name} Address`)}
              activeOpacity={0.8}
            >
              <Ionicons name="copy-outline" size={16} color={palette.bg} />
              <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                Copy {selectedChain === 'solana' ? 'Solana' : 'Monad'} Address
              </Text>
            </TouchableOpacity>
          </View>

          {/* Network Info Pills */}
          <View style={styles.infoRow}>
            <View style={[styles.infoBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>EXPECTED SPEED</Text>
              <Text style={[Typography.bodyBold, { color: palette.success, marginTop: 2 }]}>
                {addresses[selectedChain].speed}
              </Text>
            </View>
            <View style={[styles.infoBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>MINIMUM DEPOSIT</Text>
              <Text style={[Typography.bodyBold, { color: palette.text, marginTop: 2 }]}>
                {addresses[selectedChain].minDeposit}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* MODE 3: OFF-CHAIN VIRTUAL ACCOUNT VIEW */}
      {viewMode === 'offchain' && (() => {
        const currentAcc = virtualAccounts.find((a) => a.id === selectedOffchainAcc) || virtualAccounts[0];

        return (
          <View style={styles.detailStack}>
            {/* Account Switcher Tab Controls */}
            <View style={styles.switcherRow}>
              <TouchableOpacity
                onPress={() => setSelectedOffchainAcc('ngn')}
                activeOpacity={0.8}
                style={[
                  styles.switcherTab,
                  {
                    backgroundColor: selectedOffchainAcc === 'ngn'
                      ? (isDark ? '#1E293B' : '#0F172A')
                      : palette.card,
                    borderColor: palette.border
                  }
                ]}
              >
                <Text style={[Typography.bodyBold, { color: selectedOffchainAcc === 'ngn' ? '#34D399' : palette.textSecondary, fontSize: 14 }]}>
                  ₦
                </Text>
                <Text
                  style={[
                    Typography.footnote,
                    {
                      color: selectedOffchainAcc === 'ngn' ? '#FFFFFF' : palette.textSecondary,
                      fontWeight: selectedOffchainAcc === 'ngn' ? '700' : '500'
                    }
                  ]}
                >
                  NGN Account
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSelectedOffchainAcc('usd')}
                activeOpacity={0.8}
                style={[
                  styles.switcherTab,
                  {
                    backgroundColor: selectedOffchainAcc === 'usd'
                      ? (isDark ? '#1E293B' : '#0F172A')
                      : palette.card,
                    borderColor: palette.border
                  }
                ]}
              >
                <Text style={[Typography.bodyBold, { color: selectedOffchainAcc === 'usd' ? '#60A5FA' : palette.textSecondary, fontSize: 14 }]}>
                  $
                </Text>
                <Text
                  style={[
                    Typography.footnote,
                    {
                      color: selectedOffchainAcc === 'usd' ? '#FFFFFF' : palette.textSecondary,
                      fontWeight: selectedOffchainAcc === 'usd' ? '700' : '500'
                    }
                  ]}
                >
                  USD Account
                </Text>
              </TouchableOpacity>
            </View>

            {/* Single Selected Virtual Account Card */}
            <View
              style={[
                styles.virtualAccCard,
                {
                  backgroundColor: palette.card,
                  borderColor: palette.border
                }
              ]}
            >
              {renderPatternBackground(currentAcc.accentColor)}

              <View style={styles.accHeaderRow}>
                <Text style={[Typography.caption, { color: currentAcc.accentColor, fontWeight: '800' }]}>
                  {currentAcc.type}
                </Text>
                <View style={[styles.currencyPill, { backgroundColor: currentAcc.accentColor + '20' }]}>
                  <Text style={[Typography.caption, { color: currentAcc.accentColor, fontWeight: '800' }]}>
                    {currentAcc.currency}
                  </Text>
                </View>
              </View>

              <Text style={[Typography.title2, { color: palette.text, marginTop: 10 }]}>
                {currentAcc.bankName}
              </Text>

              {/* Account Number Display */}
              <View style={[styles.accNumberRow, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <View>
                  <Text style={[Typography.caption, { color: palette.textSecondary }]}>ACCOUNT NUMBER</Text>
                  <Text style={[Typography.currencyDisplay, { color: palette.text, fontSize: 24, letterSpacing: 1 }]}>
                    {currentAcc.accountNumber}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => handleCopy(currentAcc.accountNumber, `${currentAcc.bankName} Account Number`)}
                  style={[styles.miniCopyBtn, { backgroundColor: palette.text }]}
                  activeOpacity={0.8}
                >
                  <Ionicons name="copy-outline" size={16} color={palette.bg} />
                </TouchableOpacity>
              </View>

              <View style={styles.accMetaRow}>
                <View>
                  <Text style={[Typography.caption, { color: palette.textSecondary }]}>BENEFICIARY NAME</Text>
                  <Text style={[Typography.bodyBold, { color: palette.text }]}>{currentAcc.accountName}</Text>
                </View>
                {!!currentAcc.routingNumber && (
                  <View>
                    <Text style={[Typography.caption, { color: palette.textSecondary }]}>ROUTING NUMBER</Text>
                    <Text style={[Typography.bodyBold, { color: palette.text }]}>{currentAcc.routingNumber}</Text>
                  </View>
                )}
              </View>
            </View>

            {/* Instant Credit Notice */}
            <View style={[styles.noticeCard, { backgroundColor: 'rgba(52, 211, 153, 0.1)', borderColor: 'rgba(52, 211, 153, 0.3)' }]}>
              <Ionicons name="time-outline" size={20} color="#34D399" />
              <Text style={[Typography.footnote, { color: palette.text, flex: 1, lineHeight: 18 }]}>
                Bank transfers to this account are credited automatically to your float within 30 seconds.
              </Text>
            </View>
          </View>
        );
      })()}
      <AppModal config={modal.config} onClose={modal.hide} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 15,
    marginBottom: 12
  },
  circularBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sectionSubtitle: {
    marginBottom: 16
  },
  selectionStack: {
    gap: 16
  },
  choiceCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4
  },
  patternContainer: { ...(StyleSheet.absoluteFill as any) },
  patternRingOuter: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 1.5
  },
  patternRingInner: {
    position: 'absolute',
    top: -20,
    right: -10,
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1
  },
  patternGlow: {
    position: 'absolute',
    top: -30,
    right: 10,
    width: 150,
    height: 150,
    borderRadius: 75
  },
  dotGrid: {
    position: 'absolute',
    top: 18,
    right: 20,
    flexDirection: 'row',
    gap: 6
  },
  patternDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5
  },
  choiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,

  },
  assetBadgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 18
  },
  assetBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16
  },
  miniLogo: {
    width: 16,
    height: 16,
    borderRadius: 8
  },
  detailStack: {
    gap: 16
  },
  switcherRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8
  },
  switcherTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1
  },
  switcherLogo: {
    width: 16,
    height: 16,
    borderRadius: 8
  },
  qrCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 22,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center'
  },
  qrFrameContainer: {
    marginVertical: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrFrame: {
    width: 160,
    height: 160,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1.5,
    borderColor: 'rgba(148, 163, 184, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative'
  },
  qrGridGraphic: {
    alignItems: 'center',
    justifyContent: 'center'
  },
  qrCenterBadge: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  chainTitle: {
    marginTop: 6,
    marginBottom: 12
  },
  addressBox: {
    width: '100%',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14
  },
  addressText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18
  },
  copyBtn: {
    width: '100%',
    height: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8
  },
  infoRow: {
    flexDirection: 'row',
    gap: 12
  },
  infoBox: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center'
  },
  virtualAccCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 20,
    borderRadius: 22,
    borderWidth: 1
  },
  accHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  currencyPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12
  },
  accNumberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginVertical: 14
  },
  miniCopyBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center'
  },
  accMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    marginTop: 4
  }
});
