import { useCallback, useEffect, useState } from 'react';
import { authenticateBiometric, isBiometricAvailable } from '../lib/localAuthentication';
import { usePreferencesStore } from '../store/preferences.store';
import { useAuthStore } from '../store/auth.store';

/**
 * Biometric-gated confirmation for send/transfer flows.
 *
 * The transaction PIN is stored locally in SecureStore (see auth.store) and is
 * still verified server-side; biometrics only gate access to it. When the user
 * has biometrics enabled, a device is enrolled and a local PIN exists,
 * `authorize()` runs the system prompt and returns the stored PIN on success.
 * Otherwise (or on cancel/failure) it returns `null` so the caller can fall
 * back to the regular PIN modal.
 */
export function useSendAuth() {
  const biometricsEnabled = usePreferencesStore((s) => s.biometricsEnabled);
  const pin = useAuthStore((s) => s.pin);
  const [deviceAvailable, setDeviceAvailable] = useState(false);

  useEffect(() => {
    let alive = true;
    void isBiometricAvailable().then((ok) => {
      if (alive) setDeviceAvailable(ok);
    });
    return () => {
      alive = false;
    };
  }, []);

  const bioReady = biometricsEnabled && deviceAvailable && pin.length === 4;

  const authorize = useCallback(
    async (promptMessage: string): Promise<string | null> => {
      if (!(biometricsEnabled && deviceAvailable && pin.length === 4)) return null;
      const success = await authenticateBiometric(promptMessage);
      return success ? pin : null;
    },
    [biometricsEnabled, deviceAvailable, pin]
  );

  return { bioReady, authorize };
}
