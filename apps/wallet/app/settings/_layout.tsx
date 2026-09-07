import React from 'react';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppPalette } from '../../lib/theme';
import { StyleSheet } from 'react-native';

export default function SettingsLayout() {

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="appearance" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="security" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pillTabBarContainer: { display: 'none' }
});
