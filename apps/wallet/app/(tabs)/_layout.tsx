import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPalette } from '../../src/lib/theme';
import { useAuthStore, AuthState } from '../../src/store/auth.store';
import { FloatingTabBar } from '../../src/components/FloatingTabBar';
import { ProfileOnboardingModal } from '../../src/components/ProfileOnboardingModal';

export default function TabsLayout() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated);
  const isUnlocked = useAuthStore((s: AuthState) => s.isUnlocked);
  const hasPin = useAuthStore((s: AuthState) => s.hasPin);
  const unlock = useAuthStore((s: AuthState) => s.unlock);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/welcome');
    } else if (!hasPin) {
      // Without a PIN there is nothing to verify — never trap the user on the lock screen
      if (!isUnlocked) unlock();
    } else if (!isUnlocked) {
      router.replace('/auth-lock');
    }
  }, [isAuthenticated, isUnlocked, hasPin]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <ProfileOnboardingModal />
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarStyle: styles.pillTabBarContainer
        }}
        tabBar={(props) => <FloatingTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="card" options={{ title: 'Card' }} />
        <Tabs.Screen name="history" options={{ title: 'History' }} />
        <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
        <Tabs.Screen name="deposit" options={{ href: null }} />
        <Tabs.Screen name="spend" options={{ href: null }} />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pillTabBarContainer: { display: 'none' }
});

