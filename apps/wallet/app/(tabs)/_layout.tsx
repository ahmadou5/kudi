import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPalette } from '../../lib/theme';
import { useAuthStore, AuthState } from '../../store/auth.store';
import { FloatingTabBar } from '../../components/FloatingTabBar';

export default function TabsLayout() {
  const palette = useAppPalette();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated);
  const isUnlocked = useAuthStore((s: AuthState) => s.isUnlocked);

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/(auth)/welcome');
    } else if (!isUnlocked) {
      router.replace('/auth-lock');
    }
  }, [isAuthenticated, isUnlocked]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
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

