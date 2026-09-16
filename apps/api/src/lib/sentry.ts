import * as Sentry from '@sentry/node';
import type { ApiConfig } from '@kudi/config';

let sentryDsn: string | undefined;

export function initSentry(config: ApiConfig) {
  const dsn = config.SENTRY_DSN;
  sentryDsn = dsn;
  if (!dsn || dsn.includes('placeholder')) return;

  Sentry.init({
    dsn,
    environment: config.NODE_ENV,
    tracesSampleRate: config.NODE_ENV === 'production' ? 0.2 : 1.0,
  });

  console.log('⚡ [Sentry] Error monitoring initialized');
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (sentryDsn) {
    Sentry.captureException(error, { extra: context });
  } else {
    console.error('[App Error]', error, context ?? '');
  }
}
