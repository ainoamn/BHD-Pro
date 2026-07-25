/** IndexedDB queue for POS sales created while offline. */

const DB_NAME = "hisaby-pos-offline";
const STORE = "pending-sales";
const DB_VERSION = 1;

export type PendingPosSale = {
  id: string;
  createdAt: string;
  payload: {
    items: { productId: string; quantity: number; unitPrice?: number; discount?: number }[];
    paymentMethod?: string;
    warehouseId?: string;
    contactId?: string;
    tipAmount?: number;
    notes?: string;
    /** Idempotency key — same as queue row id */
    clientSaleId?: string;
  };
  receipt: {
    number?: string;
    total: number;
    lines: { name: string; qty: number; lineTotal: number }[];
    paymentMethod?: string;
    warehouseLabel?: string;
  };
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

export async function enqueuePendingSale(sale: PendingPosSale): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listPendingSales(): Promise<PendingPosSale[]> {
  const db = await openDb();
  const rows = await new Promise<PendingPosSale[]>((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve((req.result as PendingPosSale[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removePendingSale(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function pendingSalesCount(): Promise<number> {
  const rows = await listPendingSales();
  return rows.length;
}
