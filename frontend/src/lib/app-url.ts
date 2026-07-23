/** Prefer the public production URL so QR codes work on phones (avoid apex/LAN origins). */
export function getPublicAppOrigin(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** Absolute app URL for share/QR links. Always prefers NEXT_PUBLIC_APP_URL when set. */
export function toAppAbsoluteUrl(pathOrUrl: string): string {
  const origin = getPublicAppOrigin();
  try {
    if (pathOrUrl.startsWith("/")) {
      return `${origin}${pathOrUrl}`;
    }
    const parsed = new URL(pathOrUrl);
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return pathOrUrl;
  }
}
