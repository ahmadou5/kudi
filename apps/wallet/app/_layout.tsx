import '../lib/polyfills';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useAppPalette, buildNavigationTheme, isLight } from '../lib/theme';
import { useAuthStore, AuthState } from '../store/auth.store';
import { usePreferencesStore, PreferencesState } from '../store/preferences.store';
import { connectSocket, disconnectSocket } from '../lib/socket';

import { SafeAreaProvider } from 'react-native-safe-area-context';
import { PrivyProvider } from '@privy-io/expo';
import { AppModalProvider } from '../components/ui/AppModal';

// Prevent splash screen from auto-hiding until fonts are loaded (Percel pattern)
SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();
const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || 'cmtqc3mw8007e0cjxtcsip65e';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono_400Regular: require('../assets/fonts/SpaceMono-Regular.ttf'),
    'Space Mono': require('../assets/fonts/SpaceMono-Regular.ttf'),
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Nunito_400Regular: require('../assets/fonts/Nunito-Regular.ttf'),
    Nunito_700Bold: require('../assets/fonts/Nunito-Bold.ttf'),
    Nunito: require('../assets/fonts/Nunito-Bold.ttf'),
    SmoochSans_800ExtraBold: require('../assets/fonts/SmoochSans-ExtraBold.ttf'),
    ShareTechMono_400Regular: require('../assets/fonts/ShareTechMono-Regular.ttf'),
    Inter_700Bold: require('../assets/fonts/Inter-Bold.ttf'),
    'Smooch Sans': require('../assets/fonts/SmoochSans-ExtraBold.ttf'),
    'Share Tech Mono': require('../assets/fonts/ShareTechMono-Regular.ttf'),
    'Inter': require('../assets/fonts/Inter-Bold.ttf'),
    ...FontAwesome.font,
    ...Ionicons.font,
  });

  const palette = useAppPalette();
  const hydrateAuth = useAuthStore((s: AuthState) => s.hydrate);
  const hydratePreferences = usePreferencesStore((s: PreferencesState) => s.hydrate);
  const user = useAuthStore((s: AuthState) => s.user);
  const accessToken = useAuthStore((s: AuthState) => s.accessToken);
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    void hydrateAuth();
    void hydratePreferences();
  }, [hydrateAuth, hydratePreferences]);

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      connectSocket(user.id, accessToken);
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, user?.id, accessToken]);

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);


  if (!loaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.bg }} />
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PrivyProvider appId={PRIVY_APP_ID}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={buildNavigationTheme(palette)}>
              <AppModalProvider>
                <StatusBar style={isLight(palette.bg) ? 'dark' : 'light'} />
                <Stack screenOptions={{ headerShown: false }}>
                  <Stack.Screen name="(auth)" />
                  <Stack.Screen name="auth-lock" />
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="settings" />
                  <Stack.Screen name="qr-scanner" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="transaction-details" options={{ presentation: 'modal' }} />
                </Stack>
              </AppModalProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </PrivyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

