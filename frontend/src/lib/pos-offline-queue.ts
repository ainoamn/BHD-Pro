/** IndexedDB queue for POS sales + deferred void/refund ops while offline. */

const DB_NAME = "hisaby-pos-offline";
const STORE = "pending-sales";
const OPS_STORE = "pending-ops";
const DB_VERSION = 2;

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

export type PendingPosOp = {
  id: string;
  createdAt: string;
  kind: "void" | "refund";
  invoiceId: string;
  /** Skip local OFF-* invoices — only server-known UUIDs */
  payload: Record<string, unknown>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(OPS_STORE)) {
        db.createObjectStore(OPS_STORE, { keyPath: "id" });
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

export async function enqueuePendingOp(op: PendingPosOp): Promise<void> {
  if (op.invoiceId.startsWith("OFF-")) {
    throw new Error("Offline-local invoices cannot queue void/refund");
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, "readwrite");
    tx.objectStore(OPS_STORE).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function listPendingOps(): Promise<PendingPosOp[]> {
  const db = await openDb();
  const rows = await new Promise<PendingPosOp[]>((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, "readonly");
    const req = tx.objectStore(OPS_STORE).getAll();
    req.onsuccess = () => resolve((req.result as PendingPosOp[]) || []);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removePendingOp(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, "readwrite");
    tx.objectStore(OPS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function pendingOpsCount(): Promise<number> {
  const rows = await listPendingOps();
  return rows.length;
}

export async function pendingAllCount(): Promise<number> {
  const [a, b] = await Promise.all([pendingSalesCount(), pendingOpsCount()]);
  return a + b;
}
