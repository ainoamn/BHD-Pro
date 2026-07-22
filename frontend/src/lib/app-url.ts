/** Rebuild an absolute app URL using the browser's current origin (so QR works on LAN IP, not only localhost). */
export function toAppAbsoluteUrl(pathOrUrl: string): string {
  if (typeof window === "undefined") return pathOrUrl;
  try {
    const origin = window.location.origin;
    if (pathOrUrl.startsWith("/")) {
      return `${origin}${pathOrUrl}`;
    }
    const parsed = new URL(pathOrUrl);
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return pathOrUrl;
  }
}
