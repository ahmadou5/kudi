import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppPalette } from '../../lib/theme';
import { Typography } from '../../constants/typography';
import { AppModal, useAppModal } from '../../components/ui/AppModal';
import { ChainLogo } from '../../components/ui/ChainLogo';
import * as Clipboard from 'expo-clipboard';
import { useVirtualAccounts } from '../../src/hooks/useVirtualAccounts';
import { useAuthStore } from '../../store/auth.store';

// ─── Types ────────────────────────────────────────────────────────────────────

type DepositViewMode = 'select' | 'onchain' | 'offchain';

type TokenId = 'USDC' | 'AUSD' | 'NGNC';
type ChainId = 'solana' | 'monad';

interface TokenDefinition {
  id: TokenId;
  name: string;
  description: string;
  color: string;
  logo: any;
  chains: ChainId[];
  /** Recommended chain — shown first and pre-selected */
  defaultChain: ChainId;
}

interface ChainDefinition {
  id: ChainId;
  name: string;
  shortName: string;
  color: string;
  minDeposit: string;
  speed: string;
}

// ─── Token & Chain Config ─────────────────────────────────────────────────────

const TOKENS: TokenDefinition[] = [
  {
    id: 'USDC',
    name: 'USD Coin',
    description: 'Available on both Solana and Monad networks',
    color: '#2775CA',
    logo: require('../../assets/logos/usdc.png'),
    chains: ['solana', 'monad'],
    defaultChain: 'solana'
  },
  {
    id: 'AUSD',
    name: 'Agora USD',
    description: 'Exclusively on Monad Testnet',
    color: '#8B5CF6',
    logo: require('../../assets/logos/ausd.png'),
    chains: ['monad'],
    defaultChain: 'monad'
  },
  {
    id: 'NGNC',
    name: 'Naira Coin',
    description: 'Nigerian Naira stablecoin on Solana',
    color: '#10B981',
    logo: require('../../assets/logos/ngnc.png'),
    chains: ['solana'],
    defaultChain: 'solana'
  }
];

const CHAINS: Record<ChainId, ChainDefinition> = {
  solana: {
    id: 'solana',
    name: 'Solana Devnet',
    shortName: 'Solana',
    color: '#9945FF',
    minDeposit: '0.10',
    speed: '~1 sec'
  },
  monad: {
    id: 'monad',
    name: 'Monad Testnet',
    shortName: 'Monad',
    color: '#836EF9',
    minDeposit: '0.10',
    speed: '~400 ms'
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function DepositTab() {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const wallets = useAuthStore(s => s.wallets);
  const { data: apiVirtualAccounts } = useVirtualAccounts();
  const modal = useAppModal();

  const [viewMode, setViewMode] = useState<DepositViewMode>('select');

  // On-chain state — token first, then chain
  const [selectedToken, setSelectedToken] = useState<TokenId | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainId>('solana');

  // Off-chain state
  const [selectedOffchainAcc, setSelectedOffchainAcc] = useState<'ngn' | 'usd'>('ngn');

  // ── Wallet addresses ──
  const solanaAddress = wallets.find(w => w.chain === 'solana')?.address || '';
  const monadAddress = wallets.find(w => w.chain?.includes('monad'))?.address || '';

  const getAddress = (chain: ChainId) =>
    chain === 'solana' ? solanaAddress : monadAddress;

  // ── Virtual accounts ──
  const firstVA = apiVirtualAccounts?.[0] || null;
  const virtualAccounts = [
    {
      id: 'ngn' as const,
      bankName: firstVA?.bankName || 'Kudi MFB (Wema Bank)',
      accountNumber: firstVA?.accountNumber || '9928104812',
      accountName: firstVA?.accountName || 'Kudi Float',
      currency: 'NGN',
      type: 'Local Bank Transfer',
      accentColor: '#34D399'
    },
    {
      id: 'usd' as const,
      bankName: 'Kudi Global Float (USD)',
      accountNumber: 'US89 KUDI 0012 9481 02',
      routingNumber: '121000358',
      accountName: firstVA?.accountName || 'Kudi Float',
      currency: 'USD',
      type: 'ACH & Wire Transfer',
      accentColor: '#60A5FA'
    }
  ];

  // ── Handlers ──
  const handleCopy = async (text: string, label: string) => {
    try { await Clipboard.setStringAsync(text); } catch {}
    modal.alert('Copied!', `${label} copied to clipboard`, 'success');
  };

  const handleSelectToken = (token: TokenDefinition) => {
    setSelectedToken(token.id);
    setSelectedChain(token.defaultChain);
  };

  const handleBack = () => {
    if (viewMode === 'onchain' && selectedToken !== null) {
      setSelectedToken(null);
      return;
    }
    if (viewMode !== 'select') {
      setViewMode('select');
      setSelectedToken(null);
      return;
    }
    router.back();
  };

  // ── Derived ──
  const tokenDef = TOKENS.find(t => t.id === selectedToken);
  const chainDef = CHAINS[selectedChain];
  const depositAddress = getAddress(selectedChain);
  const currentVA = virtualAccounts.find(a => a.id === selectedOffchainAcc) || virtualAccounts[0];

  const headerTitle =
    viewMode === 'select' ? 'Deposit Funds' :
    viewMode === 'onchain' && !selectedToken ? 'Select Token' :
    viewMode === 'onchain' ? `Deposit ${selectedToken}` :
    'Virtual Bank Account';

  // ─── Render Helpers ───────────────────────────────────────────────────────

  const renderBgPattern = (color: string) => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.ring1, { borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)' }]} />
      <View style={[styles.ring2, { borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.04)' }]} />
      <View style={[styles.glow, { backgroundColor: color, opacity: isDark ? 0.1 : 0.06 }]} />
    </View>
  );

  // ─── Token Selector ───────────────────────────────────────────────────────

  const renderTokenSelector = () => (
    <View style={styles.stack}>
      <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 8, letterSpacing: 0.8 }]}>
        SELECT TOKEN TO DEPOSIT
      </Text>

      {TOKENS.map(token => (
        <TouchableOpacity
          key={token.id}
          onPress={() => handleSelectToken(token)}
          activeOpacity={0.85}
          style={[styles.tokenCard, { backgroundColor: palette.card, borderColor: palette.border }]}
        >
          {renderBgPattern(token.color)}

          <View style={styles.tokenCardRow}>
            <View style={[styles.tokenLogoWrap, { backgroundColor: token.color + '18', borderColor: token.color + '40' }]}>
              <Image source={token.logo} style={styles.tokenLogo} />
            </View>

            <View style={{ flex: 1 }}>
              <View style={styles.tokenNameRow}>
                <Text style={[Typography.bodyBold, { color: palette.text }]}>{token.id}</Text>
                <Text style={[Typography.caption, { color: palette.textSecondary, marginLeft: 6 }]}>{token.name}</Text>
              </View>
              <Text style={[Typography.footnote, { color: palette.textSecondary, marginTop: 2 }]}>
                {token.description}
              </Text>

              {/* Chain availability pills */}
              <View style={styles.chainPillsRow}>
                {token.chains.map(cid => (
                  <View
                    key={cid}
                    style={[styles.chainPill, { backgroundColor: CHAINS[cid].color + '22', borderColor: CHAINS[cid].color + '55' }]}
                  >
                    <ChainLogo chain={cid} size={11} />
                    <Text style={[Typography.caption, { color: CHAINS[cid].color, fontWeight: '700', fontSize: 10 }]}>
                      {CHAINS[cid].shortName}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <Ionicons name="chevron-forward" size={18} color={palette.textSecondary} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  // ─── Chain Selector (shown after token) ──────────────────────────────────

  const renderChainSelector = () => {
    if (!tokenDef) return null;
    const availableChains = tokenDef.chains.map(c => CHAINS[c]);

    return (
      <View style={styles.stack}>
        {/* Token summary pill */}
        <View style={[styles.selectedTokenBanner, { backgroundColor: tokenDef.color + '18', borderColor: tokenDef.color + '40' }]}>
          <Image source={tokenDef.logo} style={styles.bannerLogo} />
          <Text style={[Typography.bodyBold, { color: tokenDef.color }]}>{tokenDef.id}</Text>
          <Text style={[Typography.footnote, { color: palette.textSecondary, marginLeft: 4 }]}>{tokenDef.name}</Text>
          <TouchableOpacity
            onPress={() => setSelectedToken(null)}
            style={styles.changePill}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Chain tabs — only if token has multiple chains */}
        {availableChains.length > 1 ? (
          <>
            <Text style={[Typography.caption, { color: palette.textSecondary, letterSpacing: 0.8, marginBottom: 4 }]}>
              SELECT NETWORK
            </Text>
            <View style={styles.chainTabRow}>
              {availableChains.map(chain => {
                const active = selectedChain === chain.id;
                return (
                  <TouchableOpacity
                    key={chain.id}
                    onPress={() => setSelectedChain(chain.id)}
                    activeOpacity={0.8}
                    style={[
                      styles.chainTab,
                      {
                        backgroundColor: active ? (isDark ? '#1E293B' : '#0F172A') : palette.card,
                        borderColor: active ? chain.color : palette.border
                      }
                    ]}
                  >
                    <ChainLogo chain={chain.id} size={16} />
                    <Text style={[Typography.footnote, { color: active ? '#FFF' : palette.textSecondary, fontWeight: active ? '700' : '500' }]}>
                      {chain.name}
                    </Text>
                    {active && (
                      <View style={[styles.activeDot, { backgroundColor: chain.color }]} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        ) : (
          // Single chain — just show it as info, no choice needed
          <View style={[styles.singleChainInfo, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <ChainLogo chain={availableChains[0].id} size={18} />
            <View>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>{availableChains[0].name}</Text>
              <Text style={[Typography.footnote, { color: palette.textSecondary }]}>
                {tokenDef.id} is only available on {availableChains[0].shortName}
              </Text>
            </View>
          </View>
        )}

        {/* Address Card */}
        <View style={[styles.addressCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
          {renderBgPattern(chainDef.color)}

          {/* QR placeholder */}
          <View style={[styles.qrFrame, { borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.1)' }]}>
            <Ionicons name="qr-code" size={120} color={palette.text} />
            <View style={[styles.qrBadge, { backgroundColor: tokenDef.color }]}>
              <Image source={tokenDef.logo} style={{ width: 18, height: 18, borderRadius: 9 }} />
            </View>
          </View>

          <Text style={[Typography.title2, { color: palette.text, marginTop: 10, marginBottom: 4 }]}>
            {tokenDef.id} · {chainDef.shortName}
          </Text>
          <Text style={[Typography.caption, { color: palette.textSecondary, marginBottom: 14 }]}>
            Send only {tokenDef.id} on {chainDef.name}
          </Text>

          {/* Address box */}
          {depositAddress ? (
            <>
              <View style={[styles.addrBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                <Text style={[styles.addrText, { color: palette.textSecondary }]} numberOfLines={2} selectable>
                  {depositAddress}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.copyBtn, { backgroundColor: palette.text }]}
                onPress={() => handleCopy(depositAddress, `${tokenDef.id} ${chainDef.shortName} Address`)}
                activeOpacity={0.8}
              >
                <Ionicons name="copy-outline" size={16} color={palette.bg} />
                <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                  Copy {chainDef.shortName} Address
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={[styles.addrBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
              <Text style={[Typography.caption, { color: palette.textSecondary, textAlign: 'center' }]}>
                Wallet address not available. Please log out and back in.
              </Text>
            </View>
          )}
        </View>

        {/* Info pills */}
        <View style={styles.infoRow}>
          <View style={[styles.infoBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Ionicons name="flash-outline" size={16} color={palette.success} />
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>SPEED</Text>
            <Text style={[Typography.bodyBold, { color: palette.success }]}>{chainDef.speed}</Text>
          </View>
          <View style={[styles.infoBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Ionicons name="arrow-down-circle-outline" size={16} color={palette.text} />
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>MIN DEPOSIT</Text>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>{chainDef.minDeposit} {tokenDef.id}</Text>
          </View>
          <View style={[styles.infoBox, { backgroundColor: palette.card, borderColor: palette.border }]}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#F59E0B" />
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 2 }]}>NETWORK FEE</Text>
            <Text style={[Typography.bodyBold, { color: '#F59E0B' }]}>Free</Text>
          </View>
        </View>

        {/* Warning banner */}
        <View style={[styles.warningBanner, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }]}>
          <Ionicons name="warning-outline" size={18} color="#F59E0B" />
          <Text style={[Typography.footnote, { color: palette.text, flex: 1, lineHeight: 18 }]}>
            Only send <Text style={{ fontWeight: '700', color: tokenDef.color }}>{tokenDef.id}</Text> to this address on {chainDef.name}. Sending any other token will result in permanent loss of funds.
          </Text>
        </View>
      </View>
    );
  };

  // ─── Off-Chain ────────────────────────────────────────────────────────────

  const renderOffchain = () => (
    <View style={styles.stack}>
      {/* Tab switcher */}
      <View style={styles.chainTabRow}>
        {virtualAccounts.map(acc => {
          const active = selectedOffchainAcc === acc.id;
          return (
            <TouchableOpacity
              key={acc.id}
              onPress={() => setSelectedOffchainAcc(acc.id)}
              activeOpacity={0.8}
              style={[
                styles.chainTab,
                {
                  backgroundColor: active ? (isDark ? '#1E293B' : '#0F172A') : palette.card,
                  borderColor: active ? acc.accentColor : palette.border
                }
              ]}
            >
              <Text style={[Typography.bodyBold, { color: active ? acc.accentColor : palette.textSecondary }]}>
                {acc.id === 'ngn' ? '₦' : '$'}
              </Text>
              <Text style={[Typography.footnote, { color: active ? '#FFF' : palette.textSecondary, fontWeight: active ? '700' : '500' }]}>
                {acc.currency} Account
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Account card */}
      <View style={[styles.virtualCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
        {renderBgPattern(currentVA.accentColor)}

        <View style={styles.vaHeaderRow}>
          <Text style={[Typography.caption, { color: currentVA.accentColor, fontWeight: '800' }]}>{currentVA.type}</Text>
          <View style={[styles.currencyPill, { backgroundColor: currentVA.accentColor + '22' }]}>
            <Text style={[Typography.caption, { color: currentVA.accentColor, fontWeight: '800' }]}>{currentVA.currency}</Text>
          </View>
        </View>

        <Text style={[Typography.title2, { color: palette.text, marginTop: 10 }]}>{currentVA.bankName}</Text>

        <View style={[styles.accNumRow, { backgroundColor: palette.bg, borderColor: palette.border }]}>
          <View>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>ACCOUNT NUMBER</Text>
            <Text style={[Typography.currencyDisplay, { color: palette.text, fontSize: 24, letterSpacing: 1 }]}>
              {currentVA.accountNumber}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => handleCopy(currentVA.accountNumber, `${currentVA.bankName} Account Number`)}
            style={[styles.miniCopy, { backgroundColor: palette.text }]}
            activeOpacity={0.8}
          >
            <Ionicons name="copy-outline" size={15} color={palette.bg} />
          </TouchableOpacity>
        </View>

        <View style={styles.accMetaRow}>
          <View>
            <Text style={[Typography.caption, { color: palette.textSecondary }]}>BENEFICIARY</Text>
            <Text style={[Typography.bodyBold, { color: palette.text }]}>{currentVA.accountName}</Text>
          </View>
          {!!(currentVA as any).routingNumber && (
            <View>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>ROUTING</Text>
              <Text style={[Typography.bodyBold, { color: palette.text }]}>{(currentVA as any).routingNumber}</Text>
            </View>
          )}
        </View>
      </View>

      <View style={[styles.noticeCard, { backgroundColor: 'rgba(52,211,153,0.1)', borderColor: 'rgba(52,211,153,0.3)' }]}>
        <Ionicons name="time-outline" size={18} color="#34D399" />
        <Text style={[Typography.footnote, { color: palette.text, flex: 1, lineHeight: 18 }]}>
          Bank transfers are credited to your Kudi balance automatically within 30 seconds of receipt.
        </Text>
      </View>
    </View>
  );

  // ─── Selection screen ─────────────────────────────────────────────────────

  const renderSelect = () => (
    <View style={styles.stack}>
      <TouchableOpacity
        onPress={() => setViewMode('onchain')}
        activeOpacity={0.85}
        style={[styles.choiceCard, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        {renderBgPattern('#9945FF')}
        <View style={styles.choiceTop}>
          <View style={styles.choiceBadgesRow}>
            <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
              <Image source={require('../../assets/logos/usdc.png')} style={styles.miniLogo} />
              <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>USDC</Text>
            </View>
            <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
              <Image source={require('../../assets/logos/ausd.png')} style={styles.miniLogo} />
              <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>AUSD</Text>
            </View>
            <View style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
              <Image source={require('../../assets/logos/ngnc.png')} style={styles.miniLogo} />
              <Text style={[Typography.caption, { color: palette.text, fontWeight: '700' }]}>NGNC</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
        </View>
        <Text style={[Typography.title2, { color: palette.text, marginTop: 14 }]}>On-Chain Deposit</Text>
        <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          Deposit USDC, AUSD or NGNC via Solana or Monad. Select your token and get the right address instantly.
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setViewMode('offchain')}
        activeOpacity={0.85}
        style={[styles.choiceCard, { backgroundColor: palette.card, borderColor: palette.border }]}
      >
        {renderBgPattern('#34D399')}
        <View style={styles.choiceTop}>
          <View style={styles.choiceBadgesRow}>
            {['₦', '$', '€'].map(sym => (
              <View key={sym} style={[styles.assetBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }]}>
                <Text style={[Typography.bodyBold, { color: palette.text, fontSize: 13 }]}>{sym}</Text>
              </View>
            ))}
          </View>
          <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
        </View>
        <Text style={[Typography.title2, { color: palette.text, marginTop: 14 }]}>Bank Transfer</Text>
        <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
          Deposit NGN or USD via local bank transfer to your dedicated virtual account.
        </Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Root render ──────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: palette.bg }]}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={handleBack}
          style={[styles.backBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title1, { color: palette.text }]}>{headerTitle}</Text>
      </View>

      {/* Content */}
      {viewMode === 'select' && renderSelect()}
      {viewMode === 'onchain' && !selectedToken && renderTokenSelector()}
      {viewMode === 'onchain' && !!selectedToken && renderChainSelector()}
      {viewMode === 'offchain' && renderOffchain()}

      <AppModal config={modal.config} onClose={modal.hide} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'column', alignItems: 'flex-start', gap: 14, marginBottom: 16 },
  backBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stack: { gap: 14 },

  // Selection cards
  choiceCard: { position: 'relative', overflow: 'hidden', padding: 22, borderRadius: 24, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 4 },
  choiceTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  choiceBadgesRow: { flexDirection: 'row', gap: 8 },
  assetBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14 },
  miniLogo: { width: 16, height: 16, borderRadius: 8 },

  // Token cards
  tokenCard: { position: 'relative', overflow: 'hidden', padding: 16, borderRadius: 20, borderWidth: 1 },
  tokenCardRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  tokenLogoWrap: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  tokenLogo: { width: 34, height: 34, borderRadius: 17 },
  tokenNameRow: { flexDirection: 'row', alignItems: 'center' },
  chainPillsRow: { flexDirection: 'row', gap: 6, marginTop: 6 },
  chainPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },

  // Selected token banner
  selectedTokenBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, borderWidth: 1 },
  bannerLogo: { width: 22, height: 22, borderRadius: 11 },
  changePill: { marginLeft: 'auto' as any, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(148,163,184,0.15)' },

  // Chain tabs
  chainTabRow: { flexDirection: 'row', gap: 10 },
  chainTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 28, borderWidth: 1 },
  activeDot: { width: 6, height: 6, borderRadius: 3 },

  // Single chain info
  singleChainInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 18, borderWidth: 1 },

  // Address card
  addressCard: { position: 'relative', overflow: 'hidden', padding: 22, borderRadius: 24, borderWidth: 1, alignItems: 'center' },
  qrFrame: { width: 168, height: 168, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginVertical: 8, position: 'relative' },
  qrBadge: { position: 'absolute', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 2.5, borderColor: '#FFF' },
  addrBox: { width: '100%', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 14 },
  addrText: { textAlign: 'center', fontSize: 12, lineHeight: 19, fontFamily: 'monospace' },
  copyBtn: { width: '100%', height: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },

  // Info row
  infoRow: { flexDirection: 'row', gap: 10 },
  infoBox: { flex: 1, padding: 12, borderRadius: 18, borderWidth: 1, alignItems: 'center', gap: 2 },

  // Warning
  warningBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1 },

  // Virtual account
  virtualCard: { position: 'relative', overflow: 'hidden', padding: 20, borderRadius: 22, borderWidth: 1 },
  vaHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currencyPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  accNumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, borderWidth: 1, marginVertical: 14 },
  miniCopy: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  accMetaRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },

  // Notice
  noticeCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, borderWidth: 1 },

  // Background pattern
  ring1: { position: 'absolute', top: -60, right: -50, width: 220, height: 220, borderRadius: 110, borderWidth: 1.5 },
  ring2: { position: 'absolute', top: -20, right: -10, width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
  glow: { position: 'absolute', top: -30, right: 10, width: 150, height: 150, borderRadius: 75 },
});
