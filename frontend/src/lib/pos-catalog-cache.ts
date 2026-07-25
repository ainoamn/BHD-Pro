/** Offline POS catalog cache (IndexedDB) — last successful product search snapshot. */

const DB_NAME = "hisaby-pos-catalog";
const STORE = "catalog";
const DB_VERSION = 1;
const KEY = "latest";

export type CachedPosProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  salePrice: number | string;
  quantity: number | string;
  isTracked: boolean;
};

type CatalogSnapshot = {
  id: string;
  savedAt: string;
  warehouseId?: string;
  products: CachedPosProduct[];
};

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
    id: KEY,
    savedAt: new Date().toISOString(),
    warehouseId,
    products,
  };
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(row);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadCatalogCache(warehouseId?: string): Promise<CachedPosProduct[]> {
  const db = await openDb();
  const row = await new Promise<CatalogSnapshot | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve(req.result as CatalogSnapshot | undefined);
    req.onerror = () => reject(req.error);
  });
  db.close();
  if (!row?.products?.length) return [];
  if (warehouseId && row.warehouseId && row.warehouseId !== warehouseId) {
    // Still usable as fallback when offline
  }
  return row.products;
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
