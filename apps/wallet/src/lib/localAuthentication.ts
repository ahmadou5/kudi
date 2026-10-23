import { Platform } from 'react-native';
import * as LocalAuth from 'expo-local-authentication';

export interface BiometricAvailability {
  hasHardware: boolean;
  enrolled: boolean;
  available: boolean;
}

export const getBiometricAvailability = async (): Promise<BiometricAvailability> => {
  if (Platform.OS === 'web') {
    return { hasHardware: false, enrolled: false, available: false };
  }
  try {
    const [hasHardware, enrolled] = await Promise.all([
      LocalAuth.hasHardwareAsync(),
      LocalAuth.isEnrolledAsync()
    ]);
    return { hasHardware, enrolled, available: hasHardware && enrolled };
  } catch (err) {
    console.warn('[LocalAuth] Failed to check biometric availability:', err);
    return { hasHardware: false, enrolled: false, available: false };
  }
};

export const isBiometricAvailable = async (): Promise<boolean> => {
  const { available } = await getBiometricAvailability();
  return available;
};

export const authenticateBiometric = async (promptMessage = 'Unlock Kudi Wallet'): Promise<boolean> => {
  if (Platform.OS === 'web') return false;
  try {
    const result = await LocalAuth.authenticateAsync({
      promptMessage,
      cancelLabel: 'Use PIN',
      disableDeviceFallback: false
    });
    return result.success;
  } catch (err) {
    console.warn('[LocalAuth] Biometric prompt failed:', err);
    return false;
  }
};
