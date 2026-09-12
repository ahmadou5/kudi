import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../src/lib/sdk';

// Guard: setNotificationHandler crashes in Expo Go (no native module).
// Wrap in try/catch so the module loads safely even without a dev build.
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10B981',
    }).catch(() => {});
  }
} catch (err) {
  // Running in Expo Go without native push support — safe to ignore.
  console.warn('[Notifications] Native push module not available (Expo Go). Skipping handler setup.');
}

export async function getPushPermissionStatus(): Promise<Notifications.PermissionStatus> {
  try {
    const settings = await Notifications.getPermissionsAsync();
    return settings.status;
  } catch {
    return Notifications.PermissionStatus.UNDETERMINED;
  }
}

export async function registerPushToken(userId?: string): Promise<{ success: boolean; token?: string; error?: string }> {
  try {
    if (Platform.OS === 'web') {
      return { success: false, error: 'Push notifications not supported on web' };
    }

    // Gracefully bail out if the native module isn't available (Expo Go)
    let existingStatus: Notifications.PermissionStatus;
    try {
      const perms = await Notifications.getPermissionsAsync();
      existingStatus = perms.status;
    } catch {
      return { success: false, error: 'ExpoPushTokenManager native module not available. Use a development build.' };
    }

    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return { success: false, error: 'Push notification permission was not granted' };
    }

    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;

    let token: string | undefined;
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
      token = tokenData.data;
    } catch (err: any) {
      return { success: false, error: `getExpoPushTokenAsync failed: ${err?.message}` };
    }

    if (token) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/auth/push-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, userId })
        });
        if (!res.ok) {
          console.warn('[PushToken] Server registration failed with status:', res.status);
        }
      } catch (err: any) {
        console.warn('[PushToken] Server registration network error:', err?.message);
      }
    }

    return { success: true, token };
  } catch (err: any) {
    console.warn('[PushToken] Unexpected error:', err?.message || err);
    return { success: false, error: err?.message || String(err) };
  }
}

export async function triggerLocalTestNotification(title?: string, body?: string): Promise<string | null> {
  try {
    return await Notifications.scheduleNotificationAsync({
      content: {
        title: title || 'Kudi Wallet Alert 🚀',
        body: body || 'Push notifications are fully active and configured on your device.',
        sound: 'default',
      },
      trigger: null,
    });
  } catch (err: any) {
    console.warn('[Notifications] scheduleNotificationAsync failed (needs dev build):', err?.message);
    return null;
  }
}
