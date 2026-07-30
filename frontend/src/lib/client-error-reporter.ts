"use client";

/**
 * Lightweight browser error beacon → POST /public/client-errors
 * When NEXT_PUBLIC_SENTRY_DSN is set, also forwards to Sentry Browser SDK.
 */

let sentryReady: Promise<boolean> | null = null;

async function ensureSentry(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const dsn = (process.env.NEXT_PUBLIC_SENTRY_DSN || "").trim();
  if (!dsn) return false;
  if (!sentryReady) {
    sentryReady = (async () => {
      try {
        const Sentry = await import("@sentry/browser");
        Sentry.init({
          dsn,
          environment:
            process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ||
            process.env.NODE_ENV ||
            "development",
          tracesSampleRate: Number(
            process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE || 0.1,
          ),
          enabled: process.env.NEXT_PUBLIC_SENTRY_ENABLED !== "false",
          sendDefaultPii: false,
          beforeSend(event) {
            if (event.request?.url) {
              try {
                const url = new URL(event.request.url);
                url.search = "";
                url.hash = "";
                event.request.url = url.toString();
              } catch {
                event.request.url = undefined;
              }
            }
            return event;
          },
        });
        return true;
      } catch {
        return false;
      }
    })();
  }
  return sentryReady;
}

export function reportClientError(payload: {
  message: string;
  stack?: string;
  url?: string;
  source?: string;
}) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({
      message: String(payload.message || "").slice(0, 500),
      stack: payload.stack ? String(payload.stack).slice(0, 2000) : undefined,
      url: payload.url || window.location.href,
      source: payload.source || "browser",
    });
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/backend-api/public/client-errors", blob);
    } else {
      void fetch("/backend-api/public/client-errors", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body,
        credentials: "omit",
        keepalive: true,
      });
    }
  } catch {
    /* never break the app for reporting */
  }

  void (async () => {
    try {
      const ok = await ensureSentry();
      if (!ok) return;
      const Sentry = await import("@sentry/browser");
      Sentry.captureMessage(payload.message, {
        level: "error",
        extra: {
          stack: payload.stack,
          url: payload.url || window.location.href,
          source: payload.source || "browser",
        },
      });
    } catch {
      /* ignore */
    }
  })();
}

export function installClientErrorReporting() {
  if (typeof window === "undefined") return () => undefined;
  void ensureSentry();
  const onError = (event: ErrorEvent) => {
    reportClientError({
      message: event.message || "window.error",
      stack: event.error?.stack,
      source: "window.onerror",
    });
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    reportClientError({
      message:
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : "unhandledrejection",
      stack: reason instanceof Error ? reason.stack : undefined,
      source: "unhandledrejection",
    });
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}
