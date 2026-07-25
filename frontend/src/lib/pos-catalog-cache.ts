/** Offline POS catalog cache (IndexedDB) — full warehouse snapshot + search/barcode. */

const DB_NAME = "hisaby-pos-catalog";
const STORE = "catalog";
const DB_VERSION = 2;
const STALE_MS = 30 * 60 * 1000; // 30 min

export type CachedPosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  salePrice: number | string;
  quantity: number | string;
  isTracked: boolean;
  minQuantity?: number | string | null;
};

type CatalogSnapshot = {
  id: string;
  savedAt: string;
  warehouseId?: string;
  products: CachedPosProduct[];
};

function snapshotKey(warehouseId?: string) {
  return `wh:${warehouseId || "default"}`;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCatalogCache(
  products: CachedPosProduct[],
  warehouseId?: string,
): Promise<void> {
  const db = await openDb();
  const row: CatalogSnapshot = {
    id: snapshotKey(warehouseId),
    savedAt: new Date().toISOString(),
    warehouseId,
    products,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.objectStore(STORE).put({ ...row, id: "latest" });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readSnapshot(warehouseId?: string): Promise<CatalogSnapshot | undefined> {
  const db = await openDb();
  const key = snapshotKey(warehouseId);
  const row = await new Promise<CatalogSnapshot | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const store = tx.objectStore(STORE);
    const req = store.get(key);
    req.onsuccess = () => {
      const hit = req.result as CatalogSnapshot | undefined;
      if (hit?.products?.length) {
        resolve(hit);
        return;
      }
      const legacy = store.get("latest");
      legacy.onsuccess = () => resolve(legacy.result as CatalogSnapshot | undefined);
      legacy.onerror = () => reject(legacy.error);
    };
    req.onerror = () => reject(req.error);
  });
  db.close();
  return row;
}

export async function loadCatalogCache(warehouseId?: string): Promise<CachedPosProduct[]> {
  const row = await readSnapshot(warehouseId);
  return row?.products?.length ? row.products : [];
}

export async function loadCatalogCacheMeta(warehouseId?: string): Promise<{
  products: CachedPosProduct[];
  savedAt: string | null;
  count: number;
}> {
  const row = await readSnapshot(warehouseId);
  return {
    products: row?.products || [],
    savedAt: row?.savedAt || null,
    count: row?.products?.length || 0,
  };
}

export function isCatalogStale(savedAt: string | null | undefined): boolean {
  if (!savedAt) return true;
  const t = Date.parse(savedAt);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > STALE_MS;
}

export async function catalogCacheMeta(
  warehouseId?: string,
): Promise<{ savedAt: string | null; count: number }> {
  const meta = await loadCatalogCacheMeta(warehouseId);
  return { savedAt: meta.savedAt, count: meta.count };
}

export function filterCachedCatalog(
  products: CachedPosProduct[],
  q?: string,
): CachedPosProduct[] {
  const term = (q || "").trim().toLowerCase();
  if (!term) return products.slice(0, 80);
  return products
    .filter((p) => {
      const hay = `${p.name} ${p.sku} ${p.barcode || ""}`.toLowerCase();
      return hay.includes(term);
    })
    .slice(0, 80);
}

export async function lookupCachedProduct(
  code: string,
  warehouseId?: string,
): Promise<CachedPosProduct | null> {
  const products = await loadCatalogCache(warehouseId);
  const c = code.trim().toLowerCase();
  if (!c) return null;
  return (
    products.find(
      (p) =>
        String(p.barcode || "").toLowerCase() === c ||
        String(p.sku || "").toLowerCase() === c,
    ) || null
  );
}

/** Optimistic local stock decrement after an offline sale. */
export async function adjustCachedStock(
  lines: { productId: string; quantity: number }[],
  warehouseId?: string,
): Promise<void> {
  const products = await loadCatalogCache(warehouseId);
  if (!products.length || !lines.length) return;
  const delta = new Map(lines.map((l) => [l.productId, l.quantity]));
  const next = products.map((p) => {
    const q = delta.get(p.id);
    if (!q) return p;
    return { ...p, quantity: Number((Number(p.quantity) - q).toFixed(3)) };
  });
  await saveCatalogCache(next, warehouseId);
}

/** Merge incremental stock/catalog deltas into the offline cache. */
export async function mergeCatalogDeltas(
  deltas: CachedPosProduct[],
  warehouseId?: string,
): Promise<number> {
  if (!deltas.length) return 0;
  const existing = await loadCatalogCache(warehouseId);
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const row of deltas) {
    const prev = byId.get(row.id);
    byId.set(row.id, prev ? { ...prev, ...row } : row);
  }
  await saveCatalogCache(Array.from(byId.values()), warehouseId);
  return deltas.length;
}
