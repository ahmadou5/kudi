import axios, { AxiosError } from 'axios';
import { apiConfig } from '@kudi/config';

export type BachsVirtualAccount = {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankCode: string;
  provider: 'BACHS';
  bachsAccountId: string;
  status: string;
};

type BachsErrorBody = {
  detail?: string;
  error_code?: string;
  message?: string;
};

const bachs = axios.create({
  baseURL: apiConfig.BACHS_BASE_URL,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' }
});

function bachsError(error: unknown, fallback: string): Error {
  if (error instanceof AxiosError) {
    const body = error.response?.data as BachsErrorBody | undefined;
    const detail = body?.detail || body?.message || error.message;
    const code = body?.error_code ? ` (${body.error_code})` : '';
    return new Error(`[Bachs API] ${detail}${code}`);
  }
  return new Error(`[Bachs API] ${fallback}`);
}

export function isBachsConfigured(): boolean {
  return Boolean(apiConfig.BACHS_SECRET_KEY);
}

function authHeaders(accountId?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiConfig.BACHS_SECRET_KEY}`
  };
  if (accountId) headers['X-Account-Id'] = accountId;
  return headers;
}

/**
 * Creates (or reuses) a Bachs connected account for the user, then provisions
 * a fixed NGN virtual account number for it.
 *
 * Docs: https://docs.bachs.io/api-reference/virtual-accounts/create-a-virtual-account
 *   POST /v1/virtual-accounts  { "currency": "NGN" }  (+ X-Account-Id header)
 *
 * Throws on any failure — callers must never fall back to a fabricated number.
 * Creating twice is idempotent on Bachs' side (same number returned).
 */
export async function createBachsVirtualAccount(params: {
  userId: string;
  fullName: string;
  email: string;
  firstName?: string;
  lastName?: string;
}): Promise<BachsVirtualAccount> {
  if (!isBachsConfigured()) {
    throw new Error('[Bachs API] BACHS_SECRET_KEY is not configured');
  }

  const nameParts = params.fullName.trim().split(/\s+/).filter(Boolean);
  const firstName = params.firstName || nameParts[0] || 'Kudi';
  const lastName = params.lastName || nameParts.slice(1).join(' ') || 'User';

  // 1. Connected account per user (holds the user's own virtual account)
  let accountId: string;
  try {
    const accountRes = await bachs.post(
      '/v1/accounts',
      {
        contact_email: params.email,
        display_name: params.fullName,
        first_name: firstName,
        last_name: lastName,
        country: 'NG',
        entity_type: 'individual',
        configuration: {
          recipient: {
            capabilities: {
              virtual_accounts: { requested: true }
            }
          }
        },
        responsibilities: {
          fees: { collector: 'bachs' }
        }
      },
      { headers: authHeaders() }
    );
    accountId = accountRes.data?.id;
    if (!accountId) throw new Error('Bachs account creation returned no account id');
  } catch (err) {
    throw bachsError(err, 'Failed to create connected account');
  }

  // 2. Fixed NGN virtual account for that connected account
  try {
    const vaRes = await bachs.post(
      '/v1/virtual-accounts',
      { currency: 'NGN' },
      { headers: authHeaders(accountId) }
    );
    const data = vaRes.data as {
      id?: string;
      account_number?: string;
      account_name?: string | null;
      bank_name?: string;
      bank_code?: string | null;
      status?: string;
    };
    if (!data?.account_number) {
      throw new Error('Bachs virtual account creation returned no account number');
    }
    return {
      accountNumber: data.account_number,
      accountName: data.account_name || params.fullName,
      bankName: data.bank_name || 'Bachs Bank',
      bankCode: data.bank_code || '000',
      provider: 'BACHS',
      bachsAccountId: accountId,
      status: data.status || 'active'
    };
  } catch (err) {
    throw bachsError(err, 'Failed to create virtual account');
  }
}
