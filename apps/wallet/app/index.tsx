import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useAuthStore, AuthState } from '../store/auth.store';
import { useAppPalette } from '../lib/theme';

export default function IndexScreen() {
  const palette = useAppPalette();
  const isAuthenticated = useAuthStore((s: AuthState) => s.isAuthenticated);
  const isUnlocked = useAuthStore((s: AuthState) => s.isUnlocked);
  const isLoading = useAuthStore((s: AuthState) => s.isLoading);

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      if (isUnlocked) {
        router.replace('/(tabs)');
      } else {
        router.replace('/auth-lock');
      }
    } else {
      router.replace('/(auth)/welcome');
    }
  }, [isLoading, isAuthenticated, isUnlocked]);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <ActivityIndicator size="large" color={palette.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center'
  }
});
