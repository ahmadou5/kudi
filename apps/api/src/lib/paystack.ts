import axios, { AxiosError } from 'axios';

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