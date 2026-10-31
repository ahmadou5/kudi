import crypto from 'crypto';
import axios from 'axios';
import { isRealCredential } from './placeholders';

const SUMSUB_BASE_URL = (process.env.SUMSUB_BASE_URL || 'https://api.sumsub.com').replace(/\/$/, '');

type SumsubCheckType = 'BVN' | 'NIN';

export type SumsubVerificationOutcome = {
  verified: boolean;
  name: string | null;
  dob: string | null;
  photo: string | null;
  message: string;
  applicantId?: string;
};

export function isSumsubConfigured(): boolean {
  return isRealCredential(process.env.SUMSUB_APP_TOKEN) && isRealCredential(process.env.SUMSUB_APP_SECRET);
}

function sumsubLevelName(): string {
  return process.env.SUMSUB_LEVEL_NAME?.trim() || 'basic-kyc-level';
}

/**
 * Sumsub request signature: HMAC-SHA256(secret, ts + METHOD + path(+query) + body)
 * in lowercase hex. See https://docs.sumsub.com/reference/authentication
 */
function signRequest(secret: string, ts: string, method: string, pathWithQuery: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${ts}${method}${pathWithQuery}${body}`).digest('hex');
}

async function sumsubRequest<T>(method: 'GET' | 'POST', pathWithQuery: string, body?: unknown): Promise<T> {
  const token = process.env.SUMSUB_APP_TOKEN;
  const secret = process.env.SUMSUB_APP_SECRET;
  if (!isRealCredential(token) || !isRealCredential(secret)) {
    throw new Error('Sumsub is not configured (SUMSUB_APP_TOKEN / SUMSUB_APP_SECRET missing)');
  }

  const bodyStr = body === undefined ? '' : JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000).toString();

  const res = await axios.request<T>({
    method,
    url: `${SUMSUB_BASE_URL}${pathWithQuery}`,
    data: bodyStr || undefined,
    headers: {
      'X-App-Token': token as string,
      'X-App-Access-Ts': ts,
      'X-App-Access-Sig': signRequest(secret as string, ts, method, pathWithQuery, bodyStr),
      ...(bodyStr ? { 'Content-Type': 'application/json' } : {}),
      Accept: 'application/json'
    },
    validateStatus: () => true,
    timeout: 20_000
  });

  if (res.status >= 400) {
    const detail =
      (res.data as { errorMessage?: string; errorDescription?: string } | undefined)?.errorMessage ||
      (res.data as { errorDescription?: string } | undefined)?.errorDescription ||
      (typeof res.data === 'string' ? res.data : JSON.stringify(res.data ?? {}));
    throw new Error(`Sumsub ${method} ${pathWithQuery} failed (HTTP ${res.status}): ${detail}`);
  }

  return res.data;
}

function externalUserPath(userId: string): string {
  return `/resources/applicants/-;externalUserId=${encodeURIComponent(userId)}/one`;
}

type SumsubApplicant = {
  id: string;
  info?: {
    firstName?: string;
    middleName?: string;
    lastName?: string;
    dob?: string;
    country?: string;
  };
  fixedInfo?: {
    firstName?: string;
    lastName?: string;
    dob?: string;
  };
};

async function findApplicantByExternalUserId(userId: string): Promise<SumsubApplicant | null> {
  try {
    return await sumsubRequest<SumsubApplicant>('GET', externalUserPath(userId));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('HTTP 404')) return null;
    throw err;
  }
}

async function createApplicant(params: {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<SumsubApplicant> {
  const path = `/resources/applicants?levelName=${encodeURIComponent(sumsubLevelName())}`;
  const body: Record<string, unknown> = { externalUserId: params.userId };
  if (params.email) body.email = params.email;

  const info: Record<string, unknown> = { country: 'NGA', nationality: 'NGA' };
  if (params.firstName) info.firstName = params.firstName;
  if (params.lastName) info.lastName = params.lastName;
  if (params.dob) info.dob = params.dob;
  body.fixedInfo = info;

  return sumsubRequest<SumsubApplicant>('POST', path, body);
}

async function ensureApplicant(params: {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<SumsubApplicant> {
  const existing = await findApplicantByExternalUserId(params.userId);
  if (existing?.id) return existing;
  return createApplicant(params);
}

export { ensureApplicant };

/**
 * Generates a short-lived WebSDK access token bound to the user's applicant
 * and verification level. The token is the only credential handed to the
 * client — it can act on that one applicant and nothing else.
 * See https://docs.sumsub.com/reference/generate-access-token
 */
export async function generateSdkAccessToken(params: {
  userId: string;
  email?: string;
  ttlInSecs?: number;
}): Promise<{ token: string; userId: string }> {
  const body: Record<string, unknown> = {
    userId: params.userId,
    levelName: sumsubLevelName(),
    ttlInSecs: params.ttlInSecs ?? 1800
  };
  if (params.email) body.applicantIdentifiers = { email: params.email };
  return sumsubRequest<{ token: string; userId: string }>('POST', '/resources/accessTokens/sdk', body);
}

type EkycSubmitResponse = {
  status: 'completed' | 'skipped' | 'confirmationRequired' | 'rejected';
  confirmationType?: 'otp' | 'oAuth';
  confirmationId?: string;
};

type ReviewStatusResponse = {
  reviewStatus: string;
  reviewResult?: {
    reviewAnswer?: 'GREEN' | 'RED';
    rejectLabels?: string[];
    moderationComment?: string;
    clientComment?: string;
  };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForReviewDecision(applicantId: string): Promise<ReviewStatusResponse | null> {
  const maxAttempts = 15;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await sumsubRequest<ReviewStatusResponse>(
      'GET',
      `/resources/applicants/${applicantId}/status`
    );
    if (status.reviewStatus === 'completed') return status;
    if (status.reviewStatus === 'onHold') return status;
    await sleep(1000);
  }
  return null;
}

function applicantName(applicant: SumsubApplicant | null, fallbackFirst?: string, fallbackLast?: string): string | null {
  const info = applicant?.info ?? applicant?.fixedInfo;
  const combined = `${info?.firstName ?? ''} ${info?.lastName ?? ''}`.trim();
  if (combined) return combined;
  const provided = `${fallbackFirst ?? ''} ${fallbackLast ?? ''}`.trim();
  return provided || null;
}

/**
 * Nigeria Non-Doc (E-KYC) verification via Sumsub.
 *  - BVN basis: info { country: NGA, tin: <bvn> }
 *  - NIN basis: idDoc { country: NGA, idDocType: ID_CARD, number: <nin> }
 *
 * Throws on transport/API errors so the caller can surface a real failure
 * (never silently passes).
 */
export async function verifyViaSumsub(params: {
  userId: string;
  checkType: SumsubCheckType;
  idNumber: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  dob?: string;
}): Promise<SumsubVerificationOutcome> {
  const applicant = await ensureApplicant({
    userId: params.userId,
    email: params.email,
    firstName: params.firstName,
    lastName: params.lastName,
    dob: params.dob
  });

  const payload =
    params.checkType === 'BVN'
      ? { info: { country: 'NGA', tin: params.idNumber } }
      : { idDoc: { country: 'NGA', idDocType: 'ID_CARD', number: params.idNumber } };

  const submit = await sumsubRequest<EkycSubmitResponse>(
    'POST',
    `/resources/applicants/${applicant.id}/ekyc/submit`,
    payload
  );

  const fallbackName = applicantName(applicant, params.firstName, params.lastName);

  if (submit.status === 'rejected' || submit.status === 'skipped') {
    return {
      verified: false,
      name: fallbackName,
      dob: params.dob ?? null,
      photo: null,
      message: `Sumsub ${params.checkType} submission was ${submit.status}`,
      applicantId: applicant.id
    };
  }

  if (submit.status === 'confirmationRequired') {
    return {
      verified: false,
      name: fallbackName,
      dob: params.dob ?? null,
      photo: null,
      message:
        submit.confirmationType === 'otp'
          ? 'Sumsub requires an OTP confirmation to complete verification. Please try again later.'
          : 'Sumsub requires an external confirmation to complete verification. Please try again later.',
      applicantId: applicant.id
    };
  }

  const review = await waitForReviewDecision(applicant.id);
  if (!review) {
    return {
      verified: false,
      name: fallbackName,
      dob: params.dob ?? null,
      photo: null,
      message: 'Sumsub verification is still processing. Please try again shortly.',
      applicantId: applicant.id
    };
  }

  if (review.reviewResult?.reviewAnswer !== 'GREEN') {
    const labels = review.reviewResult?.rejectLabels?.join(', ');
    return {
      verified: false,
      name: fallbackName,
      dob: params.dob ?? null,
      photo: null,
      message:
        review.reviewResult?.moderationComment ||
        (labels ? `Verification rejected: ${labels}` : 'Identity could not be verified with Sumsub'),
      applicantId: applicant.id
    };
  }

  const fresh = await findApplicantByExternalUserId(params.userId).catch(() => null);
  return {
    verified: true,
    name: applicantName(fresh ?? applicant, params.firstName, params.lastName),
    dob: fresh?.info?.dob ?? fresh?.fixedInfo?.dob ?? params.dob ?? null,
    photo: null,
    message: `Verified via Sumsub (${params.checkType})`,
    applicantId: applicant.id
  };
}

export type ApplicantReviewState = {
  state: 'pending' | 'approved' | 'rejected';
  name: string | null;
  dob: string | null;
  message?: string;
};

/**
 * Reads the applicant's current review decision (WebSDK / hosted flow result).
 * Returns null when the applicant does not exist yet — nothing was started.
 * Throws on transport errors so callers surface a real failure.
 */
export async function getApplicantReviewState(userId: string): Promise<ApplicantReviewState | null> {
  const applicant = await findApplicantByExternalUserId(userId);
  if (!applicant?.id) return null;

  const name = applicantName(applicant);
  const dob = applicant.info?.dob ?? applicant.fixedInfo?.dob ?? null;

  try {
    const status = await sumsubRequest<ReviewStatusResponse>(
      'GET',
      `/resources/applicants/${applicant.id}/status`
    );
    const answer = status.reviewResult?.reviewAnswer;
    const rejectionMessage = () => {
      const labels = status.reviewResult?.rejectLabels?.join(', ');
      return (
        status.reviewResult?.moderationComment ||
        status.reviewResult?.clientComment ||
        (labels ? `Verification rejected: ${labels}` : 'Identity could not be verified with Sumsub')
      );
    };

    if (status.reviewStatus === 'completed') {
      return answer === 'GREEN'
        ? { state: 'approved', name, dob, message: 'Verified via Sumsub' }
        : { state: 'rejected', name, dob, message: rejectionMessage() };
    }
    if (status.reviewStatus === 'rejected') {
      return { state: 'rejected', name, dob, message: rejectionMessage() };
    }
    if (status.reviewStatus === 'onHold') {
      return { state: 'pending', name, dob, message: 'Verification is under manual review' };
    }
    return { state: 'pending', name, dob };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('HTTP 404')) return null;
    throw err;
  }
}
