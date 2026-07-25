import api from "@/lib/api";

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

function mergeFavoriteIds(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b].map(String).filter(Boolean))].slice(0, 200);
}

/** Pull cloud favorites, merge with local cache, push if local had extras. */
export async function syncPosFavoritesFromCloud(
  companyId: string | undefined | null,
): Promise<string[]> {
  if (!companyId) return [];
  const local = loadPosFavorites(companyId);
  try {
    const res = await api.getPosFavorites();
    const cloud = (res.data?.productIds || []).map(String).filter(Boolean);
    const merged = mergeFavoriteIds(cloud, local);
    savePosFavorites(companyId, merged);
    const cloudKey = JSON.stringify([...cloud].sort());
    const mergedKey = JSON.stringify([...merged].sort());
    if (mergedKey !== cloudKey) {
      await api.putPosFavorites(merged);
    }
    return merged;
  } catch {
    return local;
  }
}

async function pushFavorites(companyId: string, ids: string[]): Promise<void> {
  try {
    await api.putPosFavorites(ids);
  } catch {
    /* offline / permission — local cache remains source until next sync */
  }
}

export function togglePosFavorite(companyId: string, productId: string): string[] {
  const current = loadPosFavorites(companyId);
  const next = current.includes(productId)
    ? current.filter((id) => id !== productId)
    : [...current, productId].slice(0, 200);
  savePosFavorites(companyId, next);
  void pushFavorites(companyId, next);
  return next;
}
