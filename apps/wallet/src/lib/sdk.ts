import { KudiSDK } from '@kudi/sdk';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getApiBaseUrl(): string {
  let envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) {
    envUrl = envUrl.trim();
    if (envUrl.startsWith('hhttps://')) {
      envUrl = envUrl.replace('hhttps://', 'https://');
    }
    return envUrl;
  }

  // In Expo Go or development, extract the host machine IP address
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (hostUri) {
    const hostIp = hostUri.split(':')[0];
    if (hostIp && hostIp !== 'localhost' && hostIp !== '127.0.0.1') {
      return `http://${hostIp}:4000`;
    }
  }

  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000';
  }

  return 'http://localhost:4000';
}

export const API_BASE_URL = getApiBaseUrl();
console.log('[Kudi SDK] Target API_BASE_URL:', API_BASE_URL);

// Export single shared SDK instance across the app
export const sdk = new KudiSDK({
  baseUrl: API_BASE_URL
});
