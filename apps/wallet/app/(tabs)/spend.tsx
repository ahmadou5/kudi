import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Image,
  ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAppPalette } from '../../lib/theme';
import { useKudiWallet } from '../../src/hooks/useKudiWallet';
import { Typography } from '../../constants/typography';

type SpendType = 'select' | 'offchain' | 'onchain';
type OffchainSubMode = 'BANK' | 'INTERAPP';
type OnchainChain = 'solana' | 'monad';

const NIGERIAN_BANKS = [
  { code: '058', name: 'Guaranty Trust Bank (GTBank)', logoKey: 'gtbank' },
  { code: '057', name: 'Zenith Bank', logoKey: 'zenith' },
  { code: '044', name: 'Access Bank', logoKey: 'access' },
  { code: '033', name: 'United Bank for Africa (UBA)', logoKey: 'uba' },
  { code: '011', name: 'First Bank of Nigeria', logoKey: 'firstbank' },
  { code: '035', name: 'Wema Bank / ALAT', logoKey: 'wema' },
  { code: '232', name: 'Sterling Bank', logoKey: 'sterling' },
  { code: '50515', name: 'Moniepoint MFB', logoKey: 'moniepoint' },
  { code: '999992', name: 'OPay Digital Services', logoKey: 'opay' },
  { code: '999991', name: 'PalmPay', logoKey: 'palmpay' },
  { code: '50211', name: 'Kuda Microfinance Bank', logoKey: 'kuda' }
];

export default function SpendTab() {
  const palette = useAppPalette();
  const isDark = palette.text === '#FFFFFF';
  const { balanceUSDC, rateNGN, resolveAccount, spendToBank } = useKudiWallet();

  // Spend Mode States
  const [spendType, setSpendType] = useState<SpendType>('select');
  const [offchainMode, setOffchainMode] = useState<OffchainSubMode>('BANK');
  const [onchainChain, setOnchainChain] = useState<OnchainChain>('solana');

  // Form Inputs
  const [usdcAmount, setUsdcAmount] = useState('10');
  const [bankCode, setBankCode] = useState('058');
  const [accountNumber, setAccountNumber] = useState('0123456789');
  const [accountName, setAccountName] = useState('Guaranty Trust Bank Account');
  const [isResolving, setIsResolving] = useState(false);
  const [recipientHandle, setRecipientHandle] = useState('');
  const [resolvedUser, setResolvedUser] = useState<string | null>(null);
  const [onchainAddress, setOnchainAddress] = useState('');
  const [pin, setPin] = useState('1234');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [bankPickerOpen, setBankPickerOpen] = useState(false);

  const selectedBank = NIGERIAN_BANKS.find((b) => b.code === bankCode) || NIGERIAN_BANKS[0];

  const calculateNGN = () => {
    const val = parseFloat(usdcAmount) || 0;
    return (val * rateNGN).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Account Number Resolution Trigger
  useEffect(() => {
    if (accountNumber.length === 10 && offchainMode === 'BANK') {
      setIsResolving(true);
      resolveAccount(accountNumber, bankCode).then((name) => {
        setAccountName(name);
        setIsResolving(false);
      });
    }
  }, [accountNumber, bankCode, offchainMode]);

  // Inter-App User Resolution Trigger
  useEffect(() => {
    if (recipientHandle.length >= 3 && offchainMode === 'INTERAPP') {
      setResolvedUser(`Ahmadou S. (${recipientHandle.startsWith('@') ? recipientHandle : '@' + recipientHandle})`);
    } else {
      setResolvedUser(null);
    }
  }, [recipientHandle, offchainMode]);

  const handleExecuteSpend = async () => {
    const amt = parseFloat(usdcAmount) || 0;
    if (amt <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid USDC amount to send.');
      return;
    }

    if (amt > parseFloat(balanceUSDC)) {
      Alert.alert('Insufficient Balance', `Your balance is $${balanceUSDC} USDC.`);
      return;
    }

    if (pin.length < 4) {
      Alert.alert('Invalid PIN', 'Please enter your 4-digit transaction PIN.');
      return;
    }

    if (spendType === 'offchain') {
      if (offchainMode === 'BANK') {
        setStatusMessage('Processing instant bank transfer payout...');
        await spendToBank(amt, bankCode, accountNumber, accountName, pin);
        setStatusMessage(`Successfully sent ₦${calculateNGN()} NGN to ${accountName}!`);
        Alert.alert(
          'Transfer Successful',
          `Sent ₦${calculateNGN()} NGN to ${accountName} (${selectedBank.name}).`
        );
      } else {
        setStatusMessage(`Sending $${amt} USDC to ${resolvedUser || recipientHandle}...`);
        setTimeout(() => {
          setStatusMessage(`Successfully sent $${amt} USDC float to ${resolvedUser || recipientHandle}!`);
          Alert.alert(
            'Inter-App Transfer Sent',
            `Successfully transferred $${amt} USDC to ${resolvedUser || recipientHandle}.`
          );
        }, 800);
      }
    } else {
      if (!onchainAddress || onchainAddress.length < 10) {
        Alert.alert('Invalid Address', 'Please enter a valid on-chain wallet address.');
        return;
      }
      setStatusMessage(`Broadcasting $${amt} ${onchainChain === 'solana' ? 'USDC' : 'AUSD'} to ${onchainChain.toUpperCase()} network...`);
      setTimeout(() => {
        setStatusMessage(`On-Chain transfer confirmed! Reference: TX_${Math.floor(Math.random() * 899999 + 100000)}`);
        Alert.alert(
          'On-Chain Transfer Confirmed',
          `Transferred $${amt} ${onchainChain === 'solana' ? 'USDC' : 'AUSD'} to:\n${onchainAddress}`
        );
      }, 1000);
    }
  };

  // Render Pattern Background for Cards
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
      {/* Dynamic Circle Back Button & Title Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity
          onPress={() => {
            if (spendType === 'select') {
              router.back();
            } else {
              setSpendType('select');
            }
          }}
          style={[styles.circularBackBtn, { backgroundColor: palette.card, borderColor: palette.border }]}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-back" size={20} color={palette.text} />
        </TouchableOpacity>
        <Text style={[Typography.title1, { color: palette.text }]}>
          {spendType === 'select'
            ? 'Send & Spend'
            : spendType === 'onchain'
            ? 'On-Chain Transfer'
            : 'Off-Chain Transfer'}
        </Text>
      </View>

      {/* MODE 1: SELECTION VIEW (MATCHING DEPOSIT SCREEN CARDS) */}
      {spendType === 'select' && (
        <View style={styles.selectionStack}>
          {/* On-Chain Spend Card */}
          <TouchableOpacity
            onPress={() => setSpendType('onchain')}
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
              <View style={styles.typeBadge} />
              <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
            </View>

            <Text style={[Typography.title2, { color: palette.text, marginTop: 12 }]}>
              On-Chain Transfer
            </Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
              Broadcast USDC & crypto float directly to any Solana or Monad EVM wallet address.
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

          {/* Off-Chain Spend Card */}
          <TouchableOpacity
            onPress={() => setSpendType('offchain')}
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
              <View style={styles.typeBadge} />
              <Ionicons name="chevron-forward" size={20} color={palette.textSecondary} />
            </View>

            <Text style={[Typography.title2, { color: palette.text, marginTop: 12 }]}>
              Off-Chain Transfer
            </Text>
            <Text style={[Typography.caption, { color: palette.textSecondary, marginTop: 4, lineHeight: 18 }]}>
              Instant local bank transfer to any Nigerian bank or send to Kudi users.
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

      {/* MODE 2: OFF-CHAIN SPEND VIEW */}
      {spendType === 'offchain' && (
        <View style={styles.flowCardStack}>
          {/* Sub-mode Switcher (Bank Payout vs Inter-App Transfer) */}
          <View style={styles.subModeRow}>
            <TouchableOpacity
              onPress={() => setOffchainMode('BANK')}
              activeOpacity={0.8}
              style={[
                styles.subModePill,
                {
                  backgroundColor: offchainMode === 'BANK' ? '#34D399' : palette.card,
                  borderColor: offchainMode === 'BANK' ? '#34D399' : palette.border
                }
              ]}
            >
              <Ionicons name="business" size={15} color={offchainMode === 'BANK' ? '#0F172A' : palette.text} />
              <Text
                style={[
                  Typography.footnote,
                  {
                    color: offchainMode === 'BANK' ? '#0F172A' : palette.text,
                    fontWeight: offchainMode === 'BANK' ? '800' : '500'
                  }
                ]}
              >
                Bank Transfer
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setOffchainMode('INTERAPP')}
              activeOpacity={0.8}
              style={[
                styles.subModePill,
                {
                  backgroundColor: offchainMode === 'INTERAPP' ? '#34D399' : palette.card,
                  borderColor: offchainMode === 'INTERAPP' ? '#34D399' : palette.border
                }
              ]}
            >
              <Ionicons name="phone-portrait" size={15} color={offchainMode === 'INTERAPP' ? '#0F172A' : palette.text} />
              <Text
                style={[
                  Typography.footnote,
                  {
                    color: offchainMode === 'INTERAPP' ? '#0F172A' : palette.text,
                    fontWeight: offchainMode === 'INTERAPP' ? '800' : '500'
                  }
                ]}
              >
                Inter-App Transfer
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={[styles.mainFormCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {renderPatternBackground('#34D399')}

            {/* BANK TRANSFER FORM */}
            {offchainMode === 'BANK' && (
              <View style={styles.formGroupStack}>
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>SELECT DESTINATION BANK</Text>
                <TouchableOpacity
                  onPress={() => setBankPickerOpen(true)}
                  style={[styles.pickerTrigger, { backgroundColor: palette.bg, borderColor: palette.border }]}
                  activeOpacity={0.7}
                >
                  <View style={styles.pickerLeft}>
                    <Ionicons name="business-outline" size={18} color={palette.textSecondary} />
                    <Text style={[Typography.bodyBold, { color: palette.text }]}>{selectedBank.name}</Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={palette.textSecondary} />
                </TouchableOpacity>

                <Text style={[Typography.caption, { color: palette.textSecondary }]}>NUBAN ACCOUNT NUMBER</Text>
                <View style={[styles.inputWithStatus, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <TextInput
                    value={accountNumber}
                    onChangeText={setAccountNumber}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholder="10-digit NUBAN"
                    placeholderTextColor={palette.textSecondary}
                    style={[Typography.currencySub, styles.inputFlex, { color: palette.text }]}
                  />
                  {isResolving && <ActivityIndicator size="small" color="#34D399" />}
                </View>

                {/* Verified Account Name Badge */}
                {!!accountName && (
                  <View style={[styles.verifiedCard, { backgroundColor: 'rgba(52, 211, 153, 0.12)', borderColor: 'rgba(52, 211, 153, 0.3)' }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#34D399" />
                    <Text style={[Typography.bodyBold, { color: palette.text, flex: 1, fontSize: 13 }]}>
                      {accountName}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* INTER-APP TRANSFER FORM */}
            {offchainMode === 'INTERAPP' && (
              <View style={styles.formGroupStack}>
                <Text style={[Typography.caption, { color: palette.textSecondary }]}>RECIPIENT USERNAME OR PHONE</Text>
                <View style={[styles.inputWithStatus, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <Ionicons name="at-outline" size={18} color={palette.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    value={recipientHandle}
                    onChangeText={setRecipientHandle}
                    placeholder="@username or phone number"
                    placeholderTextColor={palette.textSecondary}
                    style={[Typography.bodyBold, styles.inputFlex, { color: palette.text }]}
                  />
                </View>

                {/* Resolved User Badge */}
                {!!resolvedUser && (
                  <View style={[styles.verifiedCard, { backgroundColor: 'rgba(96, 165, 250, 0.12)', borderColor: 'rgba(96, 165, 250, 0.3)' }]}>
                    <Ionicons name="person-circle" size={20} color="#60A5FA" />
                    <Text style={[Typography.bodyBold, { color: palette.text, flex: 1, fontSize: 13 }]}>
                      {resolvedUser}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Common Amount Section */}
            <View style={styles.amountSection}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>AMOUNT TO SEND (USDC FLOAT)</Text>
              <TextInput
                value={usdcAmount}
                onChangeText={setUsdcAmount}
                keyboardType="numeric"
                style={[Typography.currencySub, styles.inputSingle, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border }]}
              />

              {offchainMode === 'BANK' && (
                <View style={[styles.conversionBox, { backgroundColor: palette.bg, borderColor: palette.border }]}>
                  <Text style={[Typography.caption, { color: palette.textSecondary }]}>RECIPIENT RECEIVES</Text>
                  <Text style={[Typography.currencySub, { color: palette.success, fontSize: 18, fontWeight: '700' }]}>
                    ≈ ₦{calculateNGN()} NGN
                  </Text>
                </View>
              )}
            </View>

            {/* PIN Entry */}
            <View style={styles.pinSection}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>4-DIGIT TRANSACTION PIN</Text>
              <TextInput
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="numeric"
                maxLength={4}
                style={[Typography.currencySub, styles.inputSingle, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border, letterSpacing: 6 }]}
              />
            </View>

            {/* Action Button */}
            <TouchableOpacity onPress={handleExecuteSpend} style={[styles.confirmBtn, { backgroundColor: palette.text }]} activeOpacity={0.8}>
              <Text style={[Typography.bodyBold, { color: palette.bg }]}>
                {offchainMode === 'BANK' ? 'Confirm & Send Naira' : 'Confirm & Transfer Float'}
              </Text>
              <Ionicons name="arrow-forward" size={18} color={palette.bg} />
            </TouchableOpacity>

            {statusMessage && (
              <Text style={[Typography.bodyBold, styles.statusText, { color: palette.success }]}>{statusMessage}</Text>
            )}
          </View>
        </View>
      )}

      {/* MODE 3: ON-CHAIN SPEND VIEW */}
      {spendType === 'onchain' && (
        <View style={styles.flowCardStack}>
          {/* Chain Switcher Tab Bar */}
          <View style={styles.switcherRow}>
            <TouchableOpacity
              onPress={() => setOnchainChain('solana')}
              activeOpacity={0.8}
              style={[
                styles.switcherTab,
                {
                  backgroundColor: onchainChain === 'solana'
                    ? (isDark ? '#1E293B' : '#0F172A')
                    : palette.card,
                  borderColor: palette.border
                }
              ]}
            >
              <Image source={require('../../assets/logos/solana.png')} style={styles.switcherLogo} />
              <Text
                style={[
                  Typography.footnote,
                  {
                    color: onchainChain === 'solana' ? '#FFFFFF' : palette.textSecondary,
                    fontWeight: onchainChain === 'solana' ? '700' : '500'
                  }
                ]}
              >
                Solana (USDC)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setOnchainChain('monad')}
              activeOpacity={0.8}
              style={[
                styles.switcherTab,
                {
                  backgroundColor: onchainChain === 'monad'
                    ? (isDark ? '#1E293B' : '#0F172A')
                    : palette.card,
                  borderColor: palette.border
                }
              ]}
            >
              <Ionicons name="cube" size={16} color={onchainChain === 'monad' ? '#9945FF' : palette.textSecondary} />
              <Text
                style={[
                  Typography.footnote,
                  {
                    color: onchainChain === 'monad' ? '#FFFFFF' : palette.textSecondary,
                    fontWeight: onchainChain === 'monad' ? '700' : '500'
                  }
                ]}
              >
                Monad (AUSD)
              </Text>
            </TouchableOpacity>
          </View>

          {/* Form Card */}
          <View style={[styles.mainFormCard, { backgroundColor: palette.card, borderColor: palette.border }]}>
            {renderPatternBackground('#9945FF')}

            <View style={styles.formGroupStack}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                RECIPIENT {onchainChain === 'solana' ? 'SOLANA (SPL)' : 'MONAD (EVM)'} ADDRESS
              </Text>
              <TextInput
                value={onchainAddress}
                onChangeText={setOnchainAddress}
                placeholder={onchainChain === 'solana' ? 'Solana SPL address...' : '0x... EVM address'}
                placeholderTextColor={palette.textSecondary}
                style={[Typography.currencySub, styles.inputSingle, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border, fontSize: 13 }]}
              />
            </View>

            <View style={styles.amountSection}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>
                AMOUNT TO BROADCAST ({onchainChain === 'solana' ? 'USDC' : 'AUSD'})
              </Text>
              <TextInput
                value={usdcAmount}
                onChangeText={setUsdcAmount}
                keyboardType="numeric"
                style={[Typography.currencySub, styles.inputSingle, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border }]}
              />
            </View>

            <View style={styles.pinSection}>
              <Text style={[Typography.caption, { color: palette.textSecondary }]}>4-DIGIT TRANSACTION PIN</Text>
              <TextInput
                value={pin}
                onChangeText={setPin}
                secureTextEntry
                keyboardType="numeric"
                maxLength={4}
                style={[Typography.currencySub, styles.inputSingle, { color: palette.text, backgroundColor: palette.bg, borderColor: palette.border, letterSpacing: 6 }]}
              />
            </View>

            <TouchableOpacity onPress={handleExecuteSpend} style={[styles.confirmBtn, { backgroundColor: palette.text }]} activeOpacity={0.8}>
              <Text style={[Typography.bodyBold, { color: palette.bg }]}>Confirm & Broadcast On-Chain</Text>
              <Ionicons name="arrow-forward" size={18} color={palette.bg} />
            </TouchableOpacity>

            {statusMessage && (
              <Text style={[Typography.bodyBold, styles.statusText, { color: palette.success }]}>{statusMessage}</Text>
            )}
          </View>
        </View>
      )}

      {/* BANK PICKER MODAL */}
      <Modal visible={bankPickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: palette.bg, borderColor: palette.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[Typography.title2, { color: palette.text }]}>Select Nigerian Bank</Text>
              <TouchableOpacity onPress={() => setBankPickerOpen(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color={palette.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {NIGERIAN_BANKS.map((b) => (
                <TouchableOpacity
                  key={b.code}
                  onPress={() => {
                    setBankCode(b.code);
                    setBankPickerOpen(false);
                  }}
                  style={[
                    styles.bankOptionRow,
                    {
                      backgroundColor: bankCode === b.code
                        ? (isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9')
                        : palette.card,
                      borderColor: palette.border
                    }
                  ]}
                  activeOpacity={0.7}
                >
                  <Ionicons name="business-outline" size={20} color={bankCode === b.code ? '#34D399' : palette.textSecondary} />
                  <Text style={[Typography.bodyBold, { color: palette.text, flex: 1 }]}>{b.name}</Text>
                  {bankCode === b.code && <Ionicons name="checkmark-circle" size={20} color="#34D399" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  patternContainer: { ...StyleSheet.absoluteFillObject },
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
    alignItems: 'center'
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
  flowCardStack: {
    gap: 14
  },
  subModeRow: {
    flexDirection: 'row',
    gap: 10
  },
  subModePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1
  },
  mainFormCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    gap: 16
  },
  formGroupStack: {
    gap: 8
  },
  pickerTrigger: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14
  },
  pickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1
  },
  inputWithStatus: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14
  },
  inputFlex: {
    flex: 1,
    height: '100%'
  },
  inputSingle: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14
  },
  verifiedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 4
  },
  amountSection: {
    gap: 8
  },
  conversionBox: {
    height: 54,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
    gap: 2,
    marginTop: 4
  },
  pinSection: {
    gap: 8
  },
  confirmBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 6
  },
  statusText: {
    textAlign: 'center',
    marginTop: 4
  },
  switcherRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 4
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    height: '65%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 20,
    gap: 14
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bankOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10
  }
});
