/** Best-effort ping so Render cold-start begins before the user submits login. */
export function wakeApi(): void {
  if (typeof window === "undefined") return;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = window.setTimeout(() => ctrl?.abort(), 25000);
  fetch("/backend-api/health", {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    signal: ctrl?.signal,
  })
    .catch(() => {
      /* ignore — wake is best-effort */
    })
    .finally(() => window.clearTimeout(t));
}
