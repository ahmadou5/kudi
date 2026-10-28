import axios from 'axios';
import { createMonnifyReservedAccount } from './monnify';
import { createSquadVirtualAccount } from './squad';
import { createBachsVirtualAccount, isBachsConfigured } from './bachs';
import { verifyBVNWithNibss, isNibssConfigured } from './nibss';
import { resolvePaystackBvn, isPaystackConfigured } from './paystack';

type IdentityProviderName = 'NIBSS' | 'PAYSTACK' | 'SMILE' | 'DOJAH' | 'PREMBLY' | 'NONE';
type IdentityCheckType = 'NIN' | 'BVN';

type VerificationResult = {
  verified: boolean;
  name: string | null;
  dob: string | null;
  photo: string | null;
  message?: string;
  virtualAccount?: {
    accountNumber: string;
    accountName: string;
    bankName: string;
    bankCode: string;
    provider: 'MONNIFY' | 'SQUAD' | 'BACHS';
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

function normalizeIdentityProvider(value?: string | null): IdentityProviderName {
  const upper = value?.trim().toUpperCase();
  if (upper === 'NIBSS' || upper === 'PAYSTACK' || upper === 'SMILE' || upper === 'DOJAH' || upper === 'PREMBLY') return upper;
  return 'NONE';
}

function isSimulatedAllowed() {
  return process.env.NODE_ENV !== 'production' || process.env.IDENTITY_SIMULATE === 'true';
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

/**
 * BVN verification via Paystack's resolve endpoint. Enforces name and DOB
 * match against the bank-enrolled record.
 */
async function verifyViaPaystack(params: {
  bvn: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<VerificationResult> {
  const record = await resolvePaystackBvn(params.bvn);
  const recordName = `${record.first_name ?? ''} ${record.last_name ?? ''}`.trim();
  const dob = normalizeDob(record.dob);

  if (params.dob && dob && normalizeDob(params.dob) !== dob) {
    return {
      verified: false,
      name: recordName,
      dob,
      photo: null,
      message: 'Date of birth does not match the BVN record'
    };
  }

  if (!namesOverlap(params.firstName, params.lastName, recordName)) {
    return {
      verified: false,
      name: recordName,
      dob,
      photo: null,
      message: 'Name does not match the BVN record'
    };
  }

  return {
    verified: true,
    name: recordName || `${params.firstName ?? ''} ${params.lastName ?? ''}`.trim() || 'Kudi User',
    dob,
    photo: null,
    message: 'BVN verified via Paystack'
  };
}

async function verifyViaSmile(params: {
  checkType: IdentityCheckType;
  idNumber: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<VerificationResult> {
  const res = await axios.post('https://api.smileidentity.com/v1/id_verification', {
    partner_id: process.env.SMILE_IDENTITY_PARTNER_ID,
    api_key: process.env.SMILE_IDENTITY_API_KEY,
    id_type: params.checkType,
    id_number: params.idNumber,
    first_name: params.firstName,
    last_name: params.lastName
  });
  const data = res.data;
  return {
    verified: data.ResultCode === '1012' || data.verified === true,
    name: data.FullName ?? `${params.firstName ?? ''} ${params.lastName ?? ''}`.trim(),
    dob: data.DOB ?? params.dob ?? null,
    photo: data.Photo ?? null,
    message: data.ResultText ?? 'Verified via Smile Identity'
  };
}

async function verifyViaDojah(params: {
  checkType: IdentityCheckType;
  idNumber: string;
}): Promise<VerificationResult> {
  const endpoint = params.checkType === 'BVN' ? '/api/v1/kyc/bvn' : '/api/v1/kyc/nin';
  const res = await axios.get(`https://api.dojah.io${endpoint}?${params.checkType === 'BVN' ? 'bvn' : 'nin'}=${params.idNumber}`, {
    headers: { Authorization: process.env.DOJAH_API_KEY, AppId: process.env.DOJAH_APP_ID }
  });
  const data = res.data?.entity;
  return {
    verified: Boolean(data),
    name: `${data?.first_name ?? ''} ${data?.last_name ?? ''}`.trim(),
    dob: data?.date_of_birth ?? null,
    photo: data?.image ?? null,
    message: 'Verified via Dojah'
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
    message: `Verified identity (Simulated/Dev Mode — no ${params.checkType} provider configured)`
  };
}

/**
 * Runs the identity check through the first *configured* provider. A configured
 * provider that errors or rejects must surface — there is no silent fallthrough
 * to another provider or to simulated mode.
 */
async function runIdentityCheck(params: {
  checkType: IdentityCheckType;
  idNumber: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  retrievalToken?: string;
  preferredProvider?: IdentityProviderName;
}): Promise<VerificationResult> {
  const preferred = params.preferredProvider ?? normalizeIdentityProvider(process.env.IDENTITY_PROVIDER);
  const smileConfigured = Boolean(process.env.SMILE_IDENTITY_PARTNER_ID && process.env.SMILE_IDENTITY_API_KEY);
  const dojahConfigured = Boolean(process.env.DOJAH_API_KEY && process.env.DOJAH_APP_ID);

  // 1. NIBSS — primary source for BVN whenever credentials are present
  if (params.checkType === 'BVN' && (preferred === 'NIBSS' || (preferred === 'NONE' && isNibssConfigured()))) {
    if (!isNibssConfigured()) {
      throw new Error('IDENTITY_PROVIDER is NIBSS but NIBSS_ORG_CODE/NIBSS_API_KEY are not configured');
    }
    return verifyBVNWithNibss({
      bvn: params.idNumber,
      firstName: params.firstName,
      lastName: params.lastName,
      dob: params.dob,
      retrievalToken: params.retrievalToken
    });
  }

  // 2. Paystack — BVN resolve (usually already configured for payouts)
  if (params.checkType === 'BVN' && (preferred === 'PAYSTACK' || (preferred === 'NONE' && isPaystackConfigured() && !isNibssConfigured()))) {
    if (!isPaystackConfigured()) {
      throw new Error('IDENTITY_PROVIDER is PAYSTACK but PAYSTACK_SECRET_KEY is not configured');
    }
    return verifyViaPaystack({
      bvn: params.idNumber,
      firstName: params.firstName,
      lastName: params.lastName,
      dob: params.dob
    });
  }

  // 3. Smile Identity
  if (preferred === 'SMILE' || (preferred === 'NONE' && smileConfigured && !isNibssConfigured() && !isPaystackConfigured())) {
    if (!smileConfigured) {
      throw new Error('IDENTITY_PROVIDER is SMILE but Smile Identity credentials are not configured');
    }
    return verifyViaSmile(params);
  }

  // 4. Dojah
  if (preferred === 'DOJAH' || (preferred === 'NONE' && dojahConfigured && !isNibssConfigured() && !isPaystackConfigured() && !smileConfigured)) {
    if (!dojahConfigured) {
      throw new Error('IDENTITY_PROVIDER is DOJAH but Dojah credentials are not configured');
    }
    return verifyViaDojah(params);
  }

  // 5. No provider configured — simulated mode only when explicitly allowed
  if (isSimulatedAllowed()) {
    return simulatedResult(params);
  }

  return {
    verified: false,
    name: null,
    dob: null,
    photo: null,
    message: `No ${params.checkType} verification provider configured (set IDENTITY_PROVIDER and its credentials)`
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
  checkType: IdentityCheckType;
  idNumber: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<NonNullable<VerificationResult['virtualAccount']>> {
  const preferredProvider = (process.env.ACTIVE_PAYMENT_PROVIDER || 'MONNIFY').toUpperCase();
  const customerEmail = params.email || `user_${params.userId}@kudi.app`;

  try {
    if (preferredProvider === 'MONNIFY') {
      if (!process.env.MONNIFY_API_KEY || !process.env.MONNIFY_SECRET_KEY) {
        throw new VaProvisioningError('Monnify is the active provider but MONNIFY_API_KEY/MONNIFY_SECRET_KEY are not configured');
      }
      const monnifyAcc = await createMonnifyReservedAccount(`KUDI_VA_${params.userId}`, params.fullName, customerEmail, params.idNumber);
      return {
        accountNumber: monnifyAcc.accountNumber,
        accountName: monnifyAcc.accountName,
        bankName: monnifyAcc.bankName,
        bankCode: monnifyAcc.bankCode,
        provider: 'MONNIFY'
      };
    }

    if (preferredProvider === 'SQUAD') {
      if (!process.env.SQUAD_SECRET_KEY) {
        throw new VaProvisioningError('Squad is the active provider but SQUAD_SECRET_KEY is not configured');
      }
      const squadAcc = await createSquadVirtualAccount({
        customerIdentifier: `KUDI_VA_${params.userId}`,
        firstName: params.firstName || 'Kudi',
        lastName: params.lastName || 'User',
        mobileNum: params.phone || '08000000000',
        bvn: params.checkType === 'BVN' ? params.idNumber : undefined,
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

export async function verifyIdentityAndProvisionVirtualAccount(params: {
  userId: string;
  email?: string;
  phone?: string;
  checkType: IdentityCheckType;
  idNumber: string; // BVN or NIN
  firstName?: string;
  lastName?: string;
  dob?: string;
  retrievalToken?: string;
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
  const hasRealProvider =
    Boolean(process.env.MONNIFY_API_KEY && process.env.MONNIFY_SECRET_KEY) ||
    Boolean(process.env.SQUAD_SECRET_KEY) ||
    isBachsConfigured();

  if (!hasRealProvider && isSimulatedAllowed()) {
    // Explicit dev sandbox: no payment provider keys at all
    verificationResult.virtualAccount = {
      accountNumber: `99${Math.floor(10000000 + Math.random() * 90000000)}`,
      accountName: `KUDI / ${fullName}`,
      bankName: 'Kudi Sandbox Bank (Simulated)',
      bankCode: '000',
      provider: 'BACHS'
    };
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
