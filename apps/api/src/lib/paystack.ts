import axios, { AxiosError } from 'axios';

export interface PaystackIdentificationPayload {
  country: 'NG';
  type: 'bank_account';
  account_number: string;
  bvn: string;
  bank_code: string;
  first_name: string;
  last_name: string;
}

export interface PaystackDedicatedAccount {
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  customer_code: string;
}

const paystack = axios.create({
  baseURL: 'https://api.paystack.co',
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY ?? ''}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

function wrapPaystackError(error: unknown, fallbackMsg: string): never {
  if (error instanceof AxiosError) {
    const message = error.response?.data?.message ?? fallbackMsg;
    throw new Error(`[Paystack API] ${message}`);
  }
  throw new Error(`[Paystack API] ${fallbackMsg}`);
}

export async function resolvePaystackAccount(accountNumber: string, bankCode: string) {
  try {
    const res = await paystack.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
    return res.data.data as { account_number: string; account_name: string };
  } catch (err) {
    wrapPaystackError(err, 'Failed to resolve bank account');
  }
}

export async function createPaystackCustomer(email: string, firstName: string, lastName: string, phone: string) {
  try {
    const res = await paystack.post('/customer', {
      email,
      first_name: firstName,
      last_name: lastName,
      phone,
    });
    return res.data.data.customer_code as string;
  } catch (err) {
    wrapPaystackError(err, 'Failed to create Paystack customer');
  }
}

export async function createPaystackDedicatedAccount(customerCode: string, preferredBank = 'wema-bank'): Promise<PaystackDedicatedAccount> {
  if (!process.env.PAYSTACK_SECRET_KEY) {
    throw new Error('[Paystack API] PAYSTACK_SECRET_KEY is not configured — cannot issue dedicated accounts');
  }
  try {
    const res = await paystack.post('/dedicated_account', {
      customer: customerCode,
      preferred_bank: preferredBank,
    });
    const data = res.data.data;
    if (!data?.account_number) {
      throw new Error('Paystack returned no dedicated account number');
    }
    return {
      account_number: data.account_number,
      account_name: data.account_name ?? 'Kudi Wallet',
      bank_name: data.bank?.name ?? 'Wema Bank',
      bank_code: data.bank?.slug ?? '035',
      customer_code: customerCode,
    };
  } catch (err) {
    wrapPaystackError(err, 'Failed to create Paystack dedicated account');
  }
}

export async function initiatePaystackTransfer(amountNGN: number, recipientCode: string, reference: string, narration?: string) {
  try {
    const res = await paystack.post('/transfer', {
      source: 'balance',
      amount: Math.round(amountNGN * 100), // in kobo
      recipient: recipientCode,
      reference,
      reason: narration ?? 'Kudi Instant Payout',
    });
    return res.data.data as { transfer_code: string; status: string; reference: string };
  } catch (err) {
    wrapPaystackError(err, 'Failed to initiate Paystack transfer');
  }
}

export type PaystackBvnRecord = {
  bvn: string;
  first_name: string;
  last_name: string;
  phone?: string;
  dob?: string;
};

export function isPaystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

/**
 * Resolves a BVN to the enrolled identity record via Paystack
 * (GET /bank/resolve_bvn/{bvn} — ₦10 per call, 10 free per month).
 * Throws on API errors; callers enforce name/DOB matching.
 */
export async function resolvePaystackBvn(bvn: string): Promise<PaystackBvnRecord> {
  try {
    const res = await paystack.get(`/bank/resolve_bvn/${bvn}`);
    const data = res.data?.data as PaystackBvnRecord | undefined;
    if (!data?.bvn) {
      throw new Error('Paystack returned no BVN record');
    }
    return data;
  } catch (err) {
    wrapPaystackError(err, 'Failed to resolve BVN via Paystack');
  }
}