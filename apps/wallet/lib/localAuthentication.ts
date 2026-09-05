export const LocalAuthentication = {
  async hasHardwareAsync(): Promise<boolean> {
    return true;
  },
  async isEnrolledAsync(): Promise<boolean> {
    return true;
  },
  async authenticateAsync(options?: { promptMessage?: string; cancelLabel?: string }) {
    console.log(`[LocalAuth] Prompting biometrics: ${options?.promptMessage || 'Unlock App'}`);
    return { success: true };
  }
};
