/** IndexedDB queue for POS sales + deferred void/refund ops while offline. */

const DB_NAME = "hisaby-pos-offline";
const STORE = "pending-sales";
const OPS_STORE = "pending-ops";
const DB_VERSION = 3;
export const POS_OFFLINE_MAX_ATTEMPTS = 3;

export type PendingPosSale = {
  id: string;
  createdAt: string;
  payload: {
    items: { productId: string; quantity: number; unitPrice?: number; discount?: number }[];
    paymentMethod?: string;
    warehouseId?: string;
    deferredFulfillment?: boolean;
    contactId?: string;
    tipAmount?: number;
    notes?: string;
    clientSaleId?: string;
    loyaltyPointsToRedeem?: number;
    payments?: { method: string; amount: number }[];
  };
  receipt: {
    number?: string;
    total: number;
    lines: { name: string; qty: number; lineTotal: number }[];
    paymentMethod?: string;
    warehouseLabel?: string;
  };
  attempts?: number;
  lastError?: string | null;
  quarantined?: boolean;
};

export type PendingPosOp = {
  id: string;
  createdAt: string;
  kind: "void" | "refund";
  invoiceId: string;
  /** Skip local OFF-* invoices — only server-known UUIDs */
  payload: Record<string, unknown>;
  attempts?: number;
  lastError?: string | null;
  quarantined?: boolean;
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

async function putSale(sale: PendingPosSale): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(sale);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function putOp(op: PendingPosOp): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(OPS_STORE, "readwrite");
    tx.objectStore(OPS_STORE).put(op);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function enqueuePendingSale(sale: PendingPosSale): Promise<void> {
  await putSale({
    ...sale,
    attempts: sale.attempts ?? 0,
    lastError: sale.lastError ?? null,
    quarantined: sale.quarantined ?? false,
  });
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

export async function markSaleAttempt(
  id: string,
  errorMessage: string,
): Promise<PendingPosSale | null> {
  const rows = await listPendingSales();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  const attempts = (row.attempts || 0) + 1;
  const next: PendingPosSale = {
    ...row,
    attempts,
    lastError: errorMessage.slice(0, 300),
    quarantined: attempts >= POS_OFFLINE_MAX_ATTEMPTS,
  };
  await putSale(next);
  return next;
}

export async function discardQuarantinedSales(): Promise<number> {
  const rows = await listPendingSales();
  const bad = rows.filter((r) => r.quarantined);
  for (const r of bad) await removePendingSale(r.id);
  return bad.length;
}

export async function pendingSalesCount(): Promise<number> {
  const rows = await listPendingSales();
  return rows.filter((r) => !r.quarantined).length;
}

export async function quarantinedSalesCount(): Promise<number> {
  const rows = await listPendingSales();
  return rows.filter((r) => r.quarantined).length;
}

export async function enqueuePendingOp(op: PendingPosOp): Promise<void> {
  if (op.invoiceId.startsWith("OFF-")) {
    throw new Error("Offline-local invoices cannot queue void/refund");
  }
  await putOp({
    ...op,
    attempts: op.attempts ?? 0,
    lastError: op.lastError ?? null,
    quarantined: op.quarantined ?? false,
  });
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

export async function markOpAttempt(
  id: string,
  errorMessage: string,
): Promise<PendingPosOp | null> {
  const rows = await listPendingOps();
  const row = rows.find((r) => r.id === id);
  if (!row) return null;
  const attempts = (row.attempts || 0) + 1;
  const next: PendingPosOp = {
    ...row,
    attempts,
    lastError: errorMessage.slice(0, 300),
    quarantined: attempts >= POS_OFFLINE_MAX_ATTEMPTS,
  };
  await putOp(next);
  return next;
}

export async function discardQuarantinedOps(): Promise<number> {
  const rows = await listPendingOps();
  const bad = rows.filter((r) => r.quarantined);
  for (const r of bad) await removePendingOp(r.id);
  return bad.length;
}

export async function pendingOpsCount(): Promise<number> {
  const rows = await listPendingOps();
  return rows.filter((r) => !r.quarantined).length;
}

export async function pendingAllCount(): Promise<number> {
  const [a, b] = await Promise.all([pendingSalesCount(), pendingOpsCount()]);
  return a + b;
}

export async function quarantinedAllCount(): Promise<number> {
  const [a, b] = await Promise.all([
    quarantinedSalesCount(),
    listPendingOps().then((r) => r.filter((x) => x.quarantined).length),
  ]);
  return a + b;
}

export async function discardAllQuarantined(): Promise<number> {
  const [a, b] = await Promise.all([
    discardQuarantinedSales(),
    discardQuarantinedOps(),
  ]);
  return a + b;
}
