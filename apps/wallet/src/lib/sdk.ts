import { KudiSDK } from '@kudi/sdk';

const PRODUCTION_API_URL = 'https://kudi-api-production.up.railway.app';

function getApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (envUrl) {
    const normalized = envUrl.startsWith('hhttps://')
      ? envUrl.replace('hhttps://', 'https://')
      : envUrl;
    return normalized.replace(/\/+$/, '');
  }
  return PRODUCTION_API_URL;
}

export const API_BASE_URL = getApiBaseUrl();
console.log('[Kudi SDK] Target API_BASE_URL:', PRODUCTION_API_URL);

// Export single shared SDK instance across the app
export const sdk = new KudiSDK({
  baseUrl: PRODUCTION_API_URL
});
