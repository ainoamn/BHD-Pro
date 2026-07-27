/** Session cache for recent POS sales — survive refresh without empty flash. */

const PREFIX = "hisaby-pos-recent-sales";
const TTL_MS = 30 * 60 * 1000;

function key(warehouseId?: string) {
  return `${PREFIX}:${warehouseId || "default"}`;
}

export function saveRecentSalesCache(
  sales: unknown[],
  warehouseId?: string,
): void {
  try {
    sessionStorage.setItem(
      key(warehouseId),
      JSON.stringify({ savedAt: Date.now(), sales }),
    );
  } catch {
    /* quota / private mode */
  }
}

export function loadRecentSalesCache(warehouseId?: string): unknown[] {
  try {
    const raw = sessionStorage.getItem(key(warehouseId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as {
      savedAt?: number;
      sales?: unknown[];
    };
    if (!parsed?.savedAt || Date.now() - parsed.savedAt > TTL_MS) return [];
    return Array.isArray(parsed.sales) ? parsed.sales : [];
  } catch {
    return [];
  }
}
