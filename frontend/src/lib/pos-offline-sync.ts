/** Shared offline queue flush for POS shell + checkout page. */

import api from "@/lib/api";
import {
  listPendingOps,
  listPendingSales,
  pendingAllCount,
  pendingSalesCount,
  removePendingOp,
  removePendingSale,
} from "@/lib/pos-offline-queue";

export type FlushOfflineResult = {
  synced: number;
  remaining: number;
  failed: boolean;
};

export async function flushPendingPosSales(): Promise<FlushOfflineResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const remaining = await pendingAllCount();
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

  const ops = await listPendingOps();
  for (const op of ops) {
    try {
      if (op.kind === "void") {
        await api.voidPosSale(op.invoiceId, op.payload as { approval?: never });
      } else if (op.kind === "refund") {
        await api.refundPosSale(
          op.invoiceId,
          op.payload as {
            items: { productId: string; quantity: number }[];
            reason?: string;
          },
        );
      }
      await removePendingOp(op.id);
      synced += 1;
    } catch {
      failed = true;
      break;
    }
  }

  const remaining = await pendingAllCount();
  return { synced, remaining, failed: failed || remaining > 0 };
}

export { pendingSalesCount, pendingAllCount };
