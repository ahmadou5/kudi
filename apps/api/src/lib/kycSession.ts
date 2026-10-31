import axios from 'axios';
import { prisma } from '@kudi/database';
import {
  isSumsubConfigured,
  generateSdkAccessToken,
  getApplicantReviewState
} from './sumsub';
import { isDojahConfigured } from './identityVerification';
import { isRealCredential } from './placeholders';

/**
 * Hosted KYC session flow.
 *
 * The wallet opens the active provider's hosted verification UI in a
 * WebView (Dojah hosted widget URL, or a served Sumsub WebSDK page) and
 * polls GET /api/v1/kyc/session/status afterwards. Results are always
 * confirmed server-side — the client never decides the outcome.
 *
 * Session state is stored in the AppConfig key/value table under
 * `kyc_session:<userId>` (one active session per user, TTL-bound) so the
 * status endpoint is bound to the authenticated user — a client-supplied
 * reference id can never complete somebody else's KYC.
 */

export type KycSessionProviderName = 'DOJAH' | 'SUMSUB' | 'SIMULATED';

export type KycSessionRecord = {
  provider: KycSessionProviderName;
  /** Dojah hosted-flow reference id (unique per attempt, bound server-side). */
  referenceId?: string;
  /** Sumsub applicant id for the session. */
  applicantId?: string;
  createdAt: number;
};

export type SessionCheckState = {
  state: 'pending' | 'approved' | 'rejected' | 'abandoned';
  name?: string | null;
  dob?: string | null;
  photo?: string | null;
  message?: string;
};

export const KYC_SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

const sessionKey = (userId: string) => `kyc_session:${userId}`;

export async function saveKycSession(userId: string, record: KycSessionRecord): Promise<void> {
  await prisma.appConfig.upsert({
    where: { key: sessionKey(userId) },
    create: { key: sessionKey(userId), value: JSON.stringify(record) },
    update: { value: JSON.stringify(record) }
  });
}

export async function loadKycSession(userId: string): Promise<KycSessionRecord | null> {
  try {
    const row = await prisma.appConfig.findUnique({ where: { key: sessionKey(userId) } });
    if (!row?.value) return null;
    const record = JSON.parse(row.value) as KycSessionRecord;
    if (!record?.provider) return null;
    const age = Date.now() - (record.createdAt || 0);
    if (!Number.isFinite(record.createdAt) || age > KYC_SESSION_TTL_MS || age < -60_000) {
      await clearKycSession(userId);
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

export async function clearKycSession(userId: string): Promise<void> {
  try {
    await prisma.appConfig.delete({ where: { key: sessionKey(userId) } });
  } catch {
    // already gone
  }
}

// ---------------------------------------------------------------------------
// Dojah hosted widget
// ---------------------------------------------------------------------------

const DOJAH_WIDGET_BASE = 'https://identity.dojah.io/';

export function isDojahWidgetConfigured(): boolean {
  return isRealCredential(process.env.DOJAH_WIDGET_ID);
}

/**
 * Builds the hosted Dojah verification URL.
 * See https://docs.dojah.io/api-reference/widget-sdks/react-native (WebView fallback).
 */
export function buildDojahWidgetUrl(params: {
  referenceId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}): string {
  const widgetId = process.env.DOJAH_WIDGET_ID?.trim();
  if (!widgetId) {
    throw new Error('DOJAH_WIDGET_ID is not configured — create a flow in EasyOnboard and set the env var');
  }

  const query = new URLSearchParams({ widget_id: widgetId, reference_id: params.referenceId });
  const prefills: Array<[string, string | undefined]> = [
    ['first_name', params.firstName],
    ['last_name', params.lastName],
    ['email', params.email]
  ];
  for (const [field, value] of prefills) {
    const trimmed = value?.trim();
    if (trimmed) query.append(`user_data[${field}]`, trimmed);
  }
  return `${DOJAH_WIDGET_BASE}?${query.toString()}`;
}

function extractDojahName(record: any): string | null {
  const direct = typeof record?.full_name === 'string' && record.full_name.trim();
  if (direct) return (direct as string).trim();
  const top = `${record?.first_name ?? ''} ${record?.last_name ?? ''}`.trim();
  if (top) return top;
  const nested = record?.data?.government_data?.data ?? record?.data?.id?.data ?? record?.data;
  const combined = `${nested?.first_name ?? nested?.firstName ?? ''} ${nested?.last_name ?? nested?.lastName ?? ''}`.trim();
  return combined || null;
}

function extractDojahDob(record: any): string | null {
  const candidates = [
    record?.data?.government_data?.data?.date_of_birth,
    record?.data?.government_data?.data?.dob,
    record?.data?.id?.data?.date_of_birth,
    record?.dob
  ];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
      return value;
    }
  }
  return null;
}

function extractDojahFailure(record: any): string | null {
  const checks = record?.data;
  if (checks && typeof checks === 'object') {
    for (const check of Object.values(checks) as any[]) {
      if (check && typeof check === 'object' && check.status === false) {
        if (typeof check.message === 'string' && check.message.trim()) return check.message;
      }
    }
  }
  if (typeof record?.message === 'string' && record.message.trim()) return record.message;
  return null;
}

/**
 * Confirms a Dojah hosted-flow result server-side by its reference id.
 * 404 means the flow has not produced a record yet (user has not started).
 * Throws on transport/API errors so polling surfaces a real failure.
 */
export async function lookupDojahSession(referenceId: string): Promise<SessionCheckState> {
  if (!isDojahConfigured()) {
    throw new Error('Dojah is not configured (DOJAH_API_KEY / DOJAH_APP_ID missing)');
  }

  const res = await axios.get('https://api.dojah.io/api/v1/kyc/verification', {
    params: { reference_id: referenceId },
    headers: { Authorization: process.env.DOJAH_API_KEY, AppId: process.env.DOJAH_APP_ID },
    validateStatus: () => true,
    timeout: 15_000
  });

  if (res.status === 404) {
    return { state: 'pending', message: 'Verification has not started yet' };
  }
  if (res.status >= 400) {
    const detail = res.data?.message || res.data?.error || `HTTP ${res.status}`;
    throw new Error(`Dojah verification lookup failed: ${detail}`);
  }

  const record = res.data?.entity ?? res.data ?? {};
  const label = String(record.verification_status ?? '').toLowerCase();
  const name = extractDojahName(record);
  const dob = extractDojahDob(record);
  const photo = typeof record.selfie_url === 'string' ? record.selfie_url : null;

  if (label === 'completed') {
    return record.status === true || record.status === 'true'
      ? { state: 'approved', name, dob, photo, message: 'Verified via Dojah' }
      : {
          state: 'rejected',
          name,
          dob,
          photo,
          message: extractDojahFailure(record) || 'Dojah could not verify your identity'
        };
  }
  if (label === 'failed') {
    return {
      state: 'rejected',
      name,
      dob,
      photo,
      message: extractDojahFailure(record) || 'Verification failed'
    };
  }
  if (label === 'abandoned') {
    return { state: 'abandoned', message: 'Verification was exited before completion' };
  }
  // Ongoing / Pending
  return { state: 'pending', name, dob, photo };
}

// ---------------------------------------------------------------------------
// Sumsub WebSDK page (served to the wallet WebView)
// ---------------------------------------------------------------------------

export async function createSumsubWebSdkSession(params: {
  userId: string;
  email?: string;
}): Promise<{ token: string; ttlInSecs: number }> {
  const ttlInSecs = 1800;
  const { token } = await generateSdkAccessToken({
    userId: params.userId,
    email: params.email,
    ttlInSecs
  });
  return { token, ttlInSecs };
}

export async function lookupSumsubSession(userId: string): Promise<SessionCheckState> {
  if (!isSumsubConfigured()) {
    throw new Error('Sumsub is not configured (SUMSUB_APP_TOKEN / SUMSUB_APP_SECRET missing)');
  }
  const review = await getApplicantReviewState(userId);
  if (!review) return { state: 'pending', message: 'Verification has not started yet' };
  return { state: review.state, name: review.name, dob: review.dob, message: review.message };
}

/**
 * Minimal host page for the Sumsub WebSDK inside a React Native WebView.
 * Bridges WebSDK events to `window.ReactNativeWebView.postMessage` so the
 * app can react (and close the WebView) when the flow finishes.
 * See https://docs.sumsub.com/docs/get-started-with-web-sdk (WebView notes).
 */
export function sumsubWebSdkHtml(token: string, lang = 'en'): string {
  const safeToken = JSON.stringify(token);
  const safeLang = JSON.stringify((lang || 'en').slice(0, 5));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; height: 100%; background: #0B0B0F; overflow: hidden; }
  #sumsub-websdk-container { width: 100%; min-height: 100%; }
  #boot-error { display: none; color: #fff; font-family: -apple-system, sans-serif; padding: 24px; text-align: center; }
</style>
</head>
<body>
<div id="sumsub-websdk-container"></div>
<div id="boot-error">Could not load the verification widget. Check your connection and try again.</div>
<script>
  function post(msg) {
    try { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); } catch (e) {}
  }
  window.onerror = function (message) { post({ type: 'error', message: String(message) }); };
</script>
<script src="https://static.sumsub.com/idensic/static/sns-websdk-builder.js"></script>
<script>
  (function () {
    var token = ${safeToken};
    var lang = ${safeLang};
    if (typeof snsWebSdk === 'undefined') {
      document.getElementById('boot-error').style.display = 'block';
      post({ type: 'error', message: 'Failed to load Sumsub WebSDK script' });
      return;
    }
    try {
      var instance = snsWebSdk
        .init(token, function () {
          post({ type: 'tokenExpired' });
          return Promise.reject(new Error('Access token expired — restart verification'));
        })
        .withConf({ lang: lang, theme: 'light' })
        .withOptions({ addViewportTag: false, adaptIframeHeight: true })
        .on('idCheck.onInitialized', function () { post({ type: 'initialized' }); })
        .on('idCheck.onStepCompleted', function (payload) { post({ type: 'step', payload: payload }); })
        .on('idCheck.onApproved', function (payload) { post({ type: 'approved', payload: payload }); })
        .on('idCheck.onDeclined', function (payload) { post({ type: 'declined', payload: payload }); })
        .on('idCheck.onError', function (error) { post({ type: 'error', payload: error }); })
        .build();
      instance.launch('#sumsub-websdk-container');
      post({ type: 'launched' });
    } catch (err) {
      post({ type: 'error', message: String(err && err.message ? err.message : err) });
    }
  })();
</script>
</body>
</html>`;
}
