export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeImageSource(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[a-z0-9+/=_-]+$/i.test(raw)) {
    return raw;
  }
  try {
    const parsed = new URL(raw, window.location.origin);
    if (parsed.protocol !== "https:" && parsed.origin !== window.location.origin) {
      return "";
    }
    return parsed.href;
  } catch {
    return "";
  }
}

