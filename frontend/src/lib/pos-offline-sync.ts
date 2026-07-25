/** Shared offline queue flush for POS shell + checkout page. */

import api from "@/lib/api";
import {
  listPendingSales,
  pendingSalesCount,
  removePendingSale,
} from "@/lib/pos-offline-queue";

export type FlushOfflineResult = {
  synced: number;
  remaining: number;
  failed: boolean;
};

export async function flushPendingPosSales(): Promise<FlushOfflineResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const remaining = await pendingSalesCount();
    return { synced: 0, remaining, failed: remaining > 0 };
  }

  const pending = await listPendingSales();
  let synced = 0;
  let failed = false;

  for (const row of pending) {
    try {
      await api.createPosSale({
        ...row.payload,
        clientSaleId: row.payload.clientSaleId || row.id,
      });
      await removePendingSale(row.id);
      synced += 1;
    } catch {
      failed = true;
      break;
    }
  }

  const remaining = await pendingSalesCount();
  return { synced, remaining, failed: failed || remaining > 0 };
}

export { pendingSalesCount };
