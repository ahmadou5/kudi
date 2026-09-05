import React, { useState } from 'react';
import { StyleSheet, ScrollView, SafeAreaView, View } from 'react-native';
import { Header } from './src/components/Header';
import { BalanceCard } from './src/components/BalanceCard';
import { TabBar } from './src/components/TabBar';
import { HomeScreen } from './src/screens/HomeScreen';
import { DepositScreen } from './src/screens/DepositScreen';
import { SpendScreen } from './src/screens/SpendScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { OnboardingAuthScreen } from './src/screens/OnboardingAuthScreen';
import { AuthLockScreen } from './src/screens/AuthLockScreen';
import { useKudiWallet } from './src/hooks/useKudiWallet';
import { useAuthStore } from './src/store/authStore';
import { useAppFonts } from './lib/fonts';

export default function App() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');
  const { isAuthenticated, isUnlocked, lock } = useAuthStore();
  useAppFonts();

  const {
    activeTab,
    setActiveTab,
    balanceUSDC,
    rateNGN,
    spendSuccess,
    resolveAccount,
    spendToBank
  } = useKudiWallet();

  const isLight = mode === 'light';

  // 1. Not Authenticated -> Onboarding & Privy Auth Screen
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F' }]}>
        <OnboardingAuthScreen mode={mode} />
      </SafeAreaView>
    );
  }

  // 2. Authenticated but Session Locked -> PIN & Biometrics Re-access Lock Screen
  if (!isUnlocked) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F' }]}>
        <AuthLockScreen mode={mode} />
      </SafeAreaView>
    );
  }

  // 3. Authenticated & Unlocked -> Main Wallet Application
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isLight ? '#FFFFFF' : '#090A0F' }]}>
      <Header
        mode={mode}
        onToggleMode={() => setMode(mode === 'light' ? 'dark' : 'light')}
        onOpenSettings={() => lock()}
        onOpenScanner={() => setActiveTab('deposit')}
      />

      <View style={{ flex: 1, position: 'relative' }}>
        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
          <BalanceCard
            balanceUSDC={balanceUSDC}
            rateNGN={rateNGN}
            mode={mode}
            onNavigateDeposit={() => setActiveTab('deposit')}
            onNavigateSpend={() => setActiveTab('spend')}
          />

          {activeTab === 'home' && <HomeScreen onNavigate={setActiveTab} mode={mode} />}
          {activeTab === 'deposit' && <DepositScreen />}
          {activeTab === 'spend' && (
            <SpendScreen
              rateNGN={rateNGN}
              onSpendSubmit={spendToBank}
              onResolveAccount={resolveAccount}
            />
          )}
          {activeTab === 'history' && <HistoryScreen spendSuccess={spendSuccess} />}
        </ScrollView>

        {/* Floating Glassmorphism Pill Bottom Navigation Bar */}
        <TabBar activeTab={activeTab} onTabChange={setActiveTab} mode={mode} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12 }
});
