"use client";

/**
 * Lightweight browser error beacon → POST /public/client-errors
 * Optional: set NEXT_PUBLIC_SENTRY_DSN later for full Sentry SDK.
 */
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
      return;
    }
    void fetch("/backend-api/public/client-errors", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body,
      credentials: "omit",
      keepalive: true,
    });
  } catch {
    /* never break the app for reporting */
  }
}

export function installClientErrorReporting() {
  if (typeof window === "undefined") return () => undefined;
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
