import axios from 'axios';
import { apiConfig } from '@kudi/config';
import { prisma } from '@kudi/database';
import { createSquadVirtualAccount } from './squad';
import { createBachsVirtualAccount, isBachsConfigured } from './bachs';
import { isSumsubConfigured, verifyViaSumsub } from './sumsub';
import { isRealCredential } from './placeholders';

/**
 * Supported identity verification providers (exactly two):
 *  - DOJAH  — GET https://api.dojah.io/api/v1/kyc/{bvn|nin}
 *  - SUMSUB — Nigeria Non-Doc (E-KYC) via https://api.sumsub.com
 *
 * The active provider is selected from the admin dashboard
 * (AppConfig key `identity_provider`), falling back to the
 * IDENTITY_PROVIDER env var, then to whichever provider is configured.
 */
export type IdentityProviderName = 'DOJAH' | 'SUMSUB';
type IdentityCheckType = 'NIN' | 'BVN';

type VerificationResult = {
  verified: boolean;
  name: string | null;
  dob: string | null;
  photo: string | null;
  message?: string;
  /** Which provider produced this result (SIMULATED = dev-only fake pass). */
  provider?: IdentityProviderName | 'SIMULATED';
  virtualAccount?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    provider: 'SQUAD' | 'BACHS';
  };
};

/**
 * Thrown when the identity check passed but no real virtual account could be
 * provisioned. Never fabricates an account number — the request must fail so
 * the user is never handed a number that cannot receive real credits.
 */
export class VaProvisioningError extends Error {
  readonly code = 'VA_PROVISIONING_FAILED';

  constructor(message: string) {
    super(message);
    this.name = 'VaProvisioningError';
  }
}

function normalizeIdentityProvider(value?: string | null): IdentityProviderName | null {
  const upper = value?.trim().toUpperCase();
  if (upper === 'DOJAH' || upper === 'SUMSUB') return upper;
  return null;
}

export function isDojahConfigured(): boolean {
  return isRealCredential(process.env.DOJAH_API_KEY) && isRealCredential(process.env.DOJAH_APP_ID);
}

export const IDENTITY_PROVIDER_CONFIG_KEY = 'identity_provider';

export type IdentityProviderStatus = {
  /** Provider selected by the admin dashboard or IDENTITY_PROVIDER env (null = nothing selected). */
  selected: IdentityProviderName | null;
  /** Provider that will actually run (falls back to the other one if the selection has no credentials). */
  effective: IdentityProviderName | null;
  source: 'admin' | 'env' | 'auto' | 'none';
  configured: Record<IdentityProviderName, boolean>;
  updatedAt: string | null;
};

/**
 * Resolves which identity provider is active:
 *  1. Admin dashboard selection (AppConfig `identity_provider`)
 *  2. IDENTITY_PROVIDER env var
 *  3. Whichever of Dojah/Sumsub has credentials
 * If the selected provider has no credentials but the other one does, it
 * falls back (with a warning) instead of blocking user verification.
 */
export async function getIdentityProviderStatus(): Promise<IdentityProviderStatus> {
  const configured: Record<IdentityProviderName, boolean> = {
    DOJAH: isDojahConfigured(),
    SUMSUB: isSumsubConfigured()
  };

  let selected: IdentityProviderName | null = null;
  let source: IdentityProviderStatus['source'] = 'none';
  let updatedAt: string | null = null;

  try {
    const row = await prisma.appConfig.findUnique({ where: { key: IDENTITY_PROVIDER_CONFIG_KEY } });
    if (row?.value) {
      const parsed = JSON.parse(row.value) as { provider?: string; updatedAt?: string };
      selected = normalizeIdentityProvider(parsed.provider);
      if (selected) {
        source = 'admin';
        updatedAt = parsed.updatedAt || row.updatedAt?.toISOString?.() || null;
      }
    }
  } catch {
    // DB unavailable — fall through to env selection
  }

  if (!selected) {
    selected = normalizeIdentityProvider(process.env.IDENTITY_PROVIDER);
    if (selected) source = 'env';
  }

  if (!selected) {
    selected = configured.DOJAH ? 'DOJAH' : configured.SUMSUB ? 'SUMSUB' : null;
    if (selected) source = 'auto';
  }

  let effective: IdentityProviderName | null = null;
  if (selected && configured[selected]) {
    effective = selected;
  } else if (selected) {
    const other: IdentityProviderName = selected === 'DOJAH' ? 'SUMSUB' : 'DOJAH';
    if (configured[other]) {
      console.warn(
        `[IdentityVerification] Selected identity provider ${selected} has no credentials — falling back to ${other}`
      );
      effective = other;
    }
  }

  return { selected, effective, source, configured, updatedAt };
}

/**
 * Simulated KYC is an explicit opt-in (IDENTITY_SIMULATE=true). Non-production
 * alone is not enough — shared staging/QA must never auto-approve identity or
 * provision trusted accounts. Production always hard-fails (config also
 * rejects IDENTITY_SIMULATE=true at boot).
 */
export function isSimulatedAllowed() {
  if (apiConfig.NODE_ENV === 'production') return false;
  return apiConfig.IDENTITY_SIMULATE === 'true';
}

function tokensOf(value?: string | null): string[] {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

function namesOverlap(providedFirst?: string | null, providedLast?: string | null, recordName?: string | null): boolean {
  const given = new Set([...tokensOf(providedFirst), ...tokensOf(providedLast)]);
  const record = new Set(tokensOf(recordName));
  if (given.size === 0) return true;
  for (const token of given) {
    if (token.length >= 3 && record.has(token)) return true;
  }
  return false;
}

function normalizeDob(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function formatCheck(idType: IdentityCheckType, idNumber: string): string | null {
  if (!/^\d{11}$/.test(idNumber)) {
    return `Invalid ${idType} format. ${idType} must be 11 digits.`;
  }
  return null;
}

async function verifyViaDojah(params: {
  checkType: IdentityCheckType;
  idNumber: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<VerificationResult> {
  const endpoint = params.checkType === 'BVN' ? '/api/v1/kyc/bvn' : '/api/v1/kyc/nin';
  const res = await axios.get(`https://api.dojah.io${endpoint}?${params.checkType === 'BVN' ? 'bvn' : 'nin'}=${params.idNumber}`, {
    headers: { Authorization: process.env.DOJAH_API_KEY, AppId: process.env.DOJAH_APP_ID },
    validateStatus: () => true,
    timeout: 20_000
  });
  const data = res.data?.entity;
  if (res.status >= 400 || !data) {
    const detail = res.data?.message || res.data?.error || `HTTP ${res.status}`;
    return {
      verified: false,
      name: null,
      dob: null,
      photo: null,
      provider: 'DOJAH',
      message: `Dojah ${params.checkType} lookup failed: ${detail}`
    };
  }

  const recordName = `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim();
  const dob = normalizeDob(data.date_of_birth);

  if (params.dob && dob && normalizeDob(params.dob) !== dob) {
    return {
      verified: false,
      name: recordName,
      dob,
      photo: null,
      provider: 'DOJAH',
      message: `Date of birth does not match the ${params.checkType} record`
    };
  }

  if (!namesOverlap(params.firstName, params.lastName, recordName)) {
    return {
      verified: false,
      name: recordName,
      dob,
      photo: null,
      provider: 'DOJAH',
      message: `Name does not match the ${params.checkType} record`
    };
  }

  return {
    verified: true,
    name: recordName || `${params.firstName ?? ''} ${params.lastName ?? ''}`.trim() || 'Kudi User',
    dob,
    photo: data.image ?? null,
    provider: 'DOJAH',
    message: `Verified via Dojah (${params.checkType})`
  };
}

function simulatedResult(params: {
  checkType: IdentityCheckType;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): VerificationResult {
  const combinedName = `${params.firstName ?? 'Verified'} ${params.lastName ?? 'User'}`.trim();
  return {
    verified: true,
    name: combinedName,
    dob: params.dob ?? '1995-06-15',
    photo: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    provider: 'SIMULATED',
    message: `Verified identity (Simulated/Dev Mode — no ${params.checkType} provider configured)`
  };
}

/**
 * Runs the identity check through the active provider (admin dashboard
 * selection → env → whichever of Dojah/Sumsub is configured). A configured
 * provider that errors or rejects must surface — there is no silent
 * fallthrough to simulated mode.
 */
async function runIdentityCheck(params: {
  userId: string;
  email?: string;
  checkType: IdentityCheckType;
  idNumber: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  preferredProvider?: IdentityProviderName;
}): Promise<VerificationResult> {
  const status = await getIdentityProviderStatus();
  const provider: IdentityProviderName | null = params.preferredProvider ?? status.effective;

  if (provider === 'DOJAH') {
    return verifyViaDojah(params);
  }

  if (provider === 'SUMSUB') {
    const outcome = await verifyViaSumsub({
      userId: params.userId,
      checkType: params.checkType,
      idNumber: params.idNumber,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      dob: params.dob
    });
    return { ...outcome, provider: 'SUMSUB' };
  }

  // No provider configured — simulated mode only when explicitly allowed (non-prod)
  if (isSimulatedAllowed()) {
    return simulatedResult(params);
  }

  return {
    verified: false,
    name: null,
    dob: null,
    photo: null,
    message: `No ${params.checkType} verification provider configured (add DOJAH_API_KEY/DOJAH_APP_ID or SUMSUB_APP_TOKEN/SUMSUB_APP_SECRET)`
  };
}

/**
 * Provisions a real NGN virtual account with the active payment provider.
 * Throws VaProvisioningError on any failure — never returns a fabricated
 * account number. A simulated account is only issued in explicit dev mode
 * when no real provider is configured.
 */
async function provisionVirtualAccount(params: {
  userId: string;
  email?: string;
  phone?: string;
  checkType?: IdentityCheckType;
  idNumber?: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<NonNullable<VerificationResult['virtualAccount']>> {
  const preferredProvider = (apiConfig.ACTIVE_PAYMENT_PROVIDER || 'BACHS').toUpperCase();
  const customerEmail = params.email || `user_${params.userId}@kudi.app`;

  try {
    if (preferredProvider === 'SQUAD') {
      if (!isRealCredential(apiConfig.SQUAD_SECRET_KEY)) {
        throw new VaProvisioningError('Squad is the active provider but SQUAD_SECRET_KEY is not configured');
      }
      const squadAcc = await createSquadVirtualAccount({
        customerIdentifier: `KUDI_VA_${params.userId}`,
        firstName: params.firstName || 'Kudi',
        lastName: params.lastName || 'User',
        mobileNum: params.phone || '08000000000',
        bvn: params.checkType === 'BVN' && params.idNumber ? params.idNumber : undefined,
        dob: params.dob,
        email: customerEmail,
        address: 'Victoria Island, Lagos, Nigeria'
      });
      return {
        accountNumber: squadAcc.virtual_account_number,
        accountName: squadAcc.account_name,
        bankName: squadAcc.bank_name,
        bankCode: squadAcc.bank_code,
        provider: 'SQUAD'
      };
    }

    if (preferredProvider === 'BACHS') {
      if (!isBachsConfigured()) {
        throw new VaProvisioningError('Bachs is the active provider but BACHS_SECRET_KEY is not configured');
      }
      const bachsAcc = await createBachsVirtualAccount({
        userId: params.userId,
        fullName: params.fullName,
        email: customerEmail,
        firstName: params.firstName,
        lastName: params.lastName
      });
      return {
        accountNumber: bachsAcc.accountNumber,
        accountName: bachsAcc.accountName,
        bankName: bachsAcc.bankName,
        bankCode: bachsAcc.bankCode,
        provider: 'BACHS'
      };
    }

    throw new VaProvisioningError(`Unsupported ACTIVE_PAYMENT_PROVIDER: ${preferredProvider}`);
  } catch (err) {
    if (err instanceof VaProvisioningError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new VaProvisioningError(`Virtual account provisioning failed: ${message}`);
  }
}

function hasConfiguredProvider(): boolean {
  return isRealCredential(apiConfig.SQUAD_SECRET_KEY) || isBachsConfigured();
}

function simulatedVirtualAccount(fullName: string): NonNullable<VerificationResult['virtualAccount']> {
  return {
    accountNumber: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
    accountName: `KUDI / ${fullName}`,
    bankName: 'Kudi Sandbox Bank (Simulated)',
    bankCode: '000',
    provider: 'BACHS'
  };
}

export async function verifyIdentityAndProvisionVirtualAccount(params: {
  userId: string;
  email?: string;
  phone?: string;
  checkType: IdentityCheckType;
  idNumber: string; // BVN or NIN
  firstName?: string;
  lastName?: string;
  dob?: string;
  preferredProvider?: IdentityProviderName;
}): Promise<VerificationResult> {
  // 1. Format gatekeeper (not a verification step)
  const formatError = formatCheck(params.checkType, params.idNumber);
  if (formatError) {
    return { verified: false, name: null, dob: null, photo: null, message: formatError };
  }

  // 2. Identity check via the configured provider chain
  let verificationResult: VerificationResult;
  try {
    verificationResult = await runIdentityCheck(params);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { verified: false, name: null, dob: null, photo: null, message: `${params.checkType} verification failed: ${message}` };
  }

  if (!verificationResult.verified) {
    return verificationResult;
  }

  const fullName = verificationResult.name || `${params.firstName ?? ''} ${params.lastName ?? ''}`.trim() || 'Kudi User';

  // 3. Provision a real virtual account — failure aborts the whole request
  if (!hasConfiguredProvider() && isSimulatedAllowed()) {
    // Explicit dev sandbox: no payment provider keys at all
    verificationResult.virtualAccount = simulatedVirtualAccount(fullName);
    verificationResult.message = `${verificationResult.message ?? 'Verified'}; sandbox virtual account issued (dev only)`;
    return verificationResult;
  }

  verificationResult.virtualAccount = await provisionVirtualAccount({
    userId: params.userId,
    email: params.email,
    phone: params.phone,
    checkType: params.checkType,
    idNumber: params.idNumber,
    fullName,
    firstName: params.firstName,
    lastName: params.lastName,
    dob: params.dob
  });

  return verificationResult;
}

/**
 * Provisions a virtual account for an already-verified user (KYC retry flow).
 * No ID number is required — the identity check already happened. Throws
 * VaProvisioningError on failure; never fabricates an account number outside
 * the explicit dev sandbox.
 */
export async function provisionVirtualAccountForExistingKyc(params: {
  userId: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  dob?: string;
}): Promise<NonNullable<VerificationResult['virtualAccount']>> {
  const fullName =
    params.fullName?.trim() ||
    `${params.firstName ?? ''} ${params.lastName ?? ''}`.trim() ||
    'Kudi User';

  if (!hasConfiguredProvider() && isSimulatedAllowed()) {
    return simulatedVirtualAccount(fullName);
  }

  return provisionVirtualAccount({
    userId: params.userId,
    email: params.email,
    phone: params.phone,
    fullName,
    firstName: params.firstName,
    lastName: params.lastName,
    dob: params.dob
  });
}
