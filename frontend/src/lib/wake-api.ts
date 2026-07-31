let wakeInFlight: Promise<void> | null = null;
let lastWakeAt = 0;
const WAKE_TTL_MS = 5 * 60_000;

/** Best-effort ping so Render cold-start begins before the user submits login. */
export function wakeApi(): void {
  if (typeof window === "undefined") return;
  if (wakeInFlight || Date.now() - lastWakeAt < WAKE_TTL_MS) return;

  const publicApi = (
    process.env.NEXT_PUBLIC_API_PUBLIC_URL ||
    "https://hisaby-api.onrender.com"
  ).replace(/\/+$/, "");
  const wakeUrl = `${publicApi}/api/health`;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = window.setTimeout(() => ctrl?.abort(), 60_000);
  lastWakeAt = Date.now();
  wakeInFlight = fetch(wakeUrl, {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    signal: ctrl?.signal,
  })
    .then(() => undefined)
    .catch(() => {
      lastWakeAt = 0;
    })
    .finally(() => {
      wakeInFlight = null;
      window.clearTimeout(t);
    });
}
