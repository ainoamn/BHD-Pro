function storageKey(companyId: string): string {
  return `hisaby-pos-favorites:${companyId}`;
}

export function loadPosFavorites(companyId: string | undefined | null): string[] {
  if (!companyId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(String).filter(Boolean);
  } catch {
    return [];
  }
}

export function savePosFavorites(companyId: string, ids: string[]): void {
  if (!companyId || typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function togglePosFavorite(companyId: string, productId: string): string[] {
  const current = loadPosFavorites(companyId);
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [...current, productId];
  savePosFavorites(companyId, next);
  return next;
}
