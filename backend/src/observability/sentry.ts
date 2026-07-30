import { Logger } from '@nestjs/common';

const logger = new Logger('Sentry');

/**
 * Optional Sentry bootstrap. No-ops when SENTRY_DSN is unset.
 * Safe to call before NestFactory.create.
 */
export async function initSentry(): Promise<boolean> {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  if (!dsn) {
    return false;
  }

  try {
    // Dynamic import keeps boot fast when the package is present but DSN is off.
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      release: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || undefined,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      enabled: process.env.SENTRY_ENABLED !== 'false',
      sendDefaultPii: false,
      beforeSend(event) {
        if (event.request?.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.Authorization;
          delete event.request.headers.cookie;
          delete event.request.headers.Cookie;
        }
        if (event.user) {
          delete event.user.ip_address;
        }
        return event;
      },
    });
    logger.log('Sentry initialized');
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Sentry init skipped: ${message}`);
    return false;
  }
}

export async function captureException(error: unknown, context?: Record<string, unknown>) {
  const dsn = (process.env.SENTRY_DSN || '').trim();
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.withScope((scope) => {
      if (context) {
        for (const [k, v] of Object.entries(context)) {
          scope.setExtra(k, v);
        }
      }
      Sentry.captureException(error);
    });
  } catch {
    /* ignore */
  }
}
