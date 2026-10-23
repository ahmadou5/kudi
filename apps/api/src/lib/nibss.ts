import axios, { AxiosError } from 'axios';
import { apiConfig } from '@kudi/config';

export type NibssBvnResult = {
  verified: boolean;
  name: string | null;
  dob: string | null;
  photo: string | null;
  message: string;
};

const nibss = axios.create({
  baseURL: apiConfig.NIBSS_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' }
});

export function isNibssConfigured(): boolean {
  return Boolean(apiConfig.NIBSS_ORG_CODE && apiConfig.NIBSS_API_KEY);
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

function pickField(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

function normalizeDob(value?: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Validates a BVN directly against NIBSS (Nigeria Inter-Bank Settlement System).
 *
 * Uses the classic BVN management API:
 *   GET {NIBSS_BASE_URL}/bvnmanagementapi/rest/bvn/{bvn}
 *   Authorization: Basic base64(NIBSS_ORG_CODE:NIBSS_API_KEY)
 *
 * Both credentials are required — without them this throws instead of
 * pretending the BVN was verified.
 */
export async function verifyBVNWithNibss(params: {
  bvn: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
  /** NIBSS Consent Hub retrieval token (customer consent for this BVN lookup) */
  retrievalToken?: string;
}): Promise<NibssBvnResult> {
  if (!isNibssConfigured()) {
    throw new Error('[NIBSS API] NIBSS_ORG_CODE and NIBSS_API_KEY must be configured for BVN verification');
  }
  if (!/^\d{11}$/.test(params.bvn)) {
    return { verified: false, name: null, dob: null, photo: null, message: 'Invalid BVN format. BVN must be 11 digits.' };
  }

  const authHeader = `Basic ${Buffer.from(`${apiConfig.NIBSS_ORG_CODE}:${apiConfig.NIBSS_API_KEY}`).toString('base64')}`;

  try {
    const res = await nibss.get(`/bvnmanagementapi/rest/bvn/${params.bvn}`, {
      headers: { Authorization: authHeader },
      // Retrieval token = customer consent (required by NIBSS on newer portal versions)
      params: params.retrievalToken ? { retrievalToken: params.retrievalToken } : undefined
    });
    const body = res.data as Record<string, unknown>;
    const record = (typeof body?.data === 'object' && body.data !== null ? body.data : body) as Record<string, unknown>;

    const enrolledName =
      pickField(record, ['EnrolledName', 'enrolledName', 'FullName', 'fullName']) ??
      [pickField(record, ['FirstName', 'firstName']), pickField(record, ['MiddleName', 'middleName']), pickField(record, ['LastName', 'lastName'])]
        .filter(Boolean)
        .join(' ');

    const recordBvn = pickField(record, ['BVN', 'bvn']);
    if (recordBvn && recordBvn !== params.bvn) {
      return { verified: false, name: null, dob: null, photo: null, message: 'NIBSS returned a mismatched BVN record' };
    }

    const dob = normalizeDob(pickField(record, ['DateOfBirth', 'dateOfBirth', 'DOB', 'dob']));
    if (params.dob && dob && normalizeDob(params.dob) !== dob) {
      return {
        verified: false,
        name: enrolledName,
        dob,
        photo: null,
        message: 'Date of birth does not match the NIBSS BVN record'
      };
    }

    if (!namesOverlap(params.firstName, params.lastName, enrolledName)) {
      return {
        verified: false,
        name: enrolledName,
        dob,
        photo: null,
        message: 'Name does not match the NIBSS BVN record'
      };
    }

    return {
      verified: true,
      name: enrolledName || `${params.firstName ?? ''} ${params.lastName ?? ''}`.trim() || 'Kudi User',
      dob,
      photo: pickField(record, ['Image', 'image', 'Photo', 'photo']),
      message: 'BVN verified via NIBSS'
    };
  } catch (err) {
    if (err instanceof AxiosError) {
      if (err.response?.status === 404) {
        return { verified: false, name: null, dob: null, photo: null, message: 'BVN not found in the NIBSS database' };
      }
      const detail =
        (err.response?.data as Record<string, unknown> | undefined)?.message ||
        (err.response?.data as Record<string, unknown> | undefined)?.responseMessage ||
        err.message;
      throw new Error(`[NIBSS API] ${detail}`);
    }
    throw err;
  }
}
