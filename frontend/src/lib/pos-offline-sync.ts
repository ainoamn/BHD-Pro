/** Shared offline queue flush for POS shell + checkout page. */

import api from "@/lib/api";
import {
  discardAllQuarantined,
  listPendingOps,
  listPendingSales,
  markOpAttempt,
  markSaleAttempt,
  pendingAllCount,
  pendingSalesCount,
  quarantinedAllCount,
  removePendingOp,
  removePendingSale,
} from "@/lib/pos-offline-queue";

export type FlushOfflineResult = {
  synced: number;
  remaining: number;
  quarantined: number;
  failed: boolean;
};

function errMessage(err: unknown): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (err instanceof Error && err.message) return err.message;
  return "Sync failed";
}

export async function flushPendingPosSales(): Promise<FlushOfflineResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const remaining = await pendingAllCount();
    const quarantined = await quarantinedAllCount();
    return {
      synced: 0,
      remaining,
      quarantined,
      failed: remaining > 0,
    };
  }

  const pending = await listPendingSales();
  let synced = 0;
  let failed = false;

  for (const row of pending) {
    if (row.quarantined) continue;
    try {
      await api.createPosSale({
        ...row.payload,
        clientSaleId: row.payload.clientSaleId || row.id,
      });
      await removePendingSale(row.id);
      synced += 1;
    } catch (err) {
      failed = true;
      await markSaleAttempt(row.id, errMessage(err));
      // Continue — do not block the rest of the queue (poison-pill safe)
    }
  }

  const ops = await listPendingOps();
  for (const op of ops) {
    if (op.quarantined) continue;
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
    } catch (err) {
      failed = true;
      await markOpAttempt(op.id, errMessage(err));
    }
  }

  const remaining = await pendingAllCount();
  const quarantined = await quarantinedAllCount();
  return {
    synced,
    remaining,
    quarantined,
    failed: failed || remaining > 0 || quarantined > 0,
  };
}

export { pendingSalesCount, pendingAllCount, quarantinedAllCount, discardAllQuarantined };
