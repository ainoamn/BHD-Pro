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
import {
  accumulateFlushNotify,
  type CustomerNotifySummary,
  type FlushNotifyAgg,
} from "@/lib/pos-notify-toast";

export type FlushOfflineResult = {
  synced: number;
  remaining: number;
  quarantined: number;
  failed: boolean;
  /** Aggregated server delivery honesty across synced sale/void/refund. */
  notifyAgg: FlushNotifyAgg;
};

function errMessage(err: unknown): string {
  const msg = (err as { response?: { data?: { message?: string } } })?.response
    ?.data?.message;
  if (typeof msg === "string" && msg.trim()) return msg;
  if (err instanceof Error && err.message) return err.message;
  return "Sync failed";
}

function notifyFromData(data: unknown): CustomerNotifySummary {
  if (!data || typeof data !== "object") return null;
  const n = (data as { customerNotify?: CustomerNotifySummary }).customerNotify;
  return n ?? null;
}

export async function flushPendingPosSales(): Promise<FlushOfflineResult> {
  const emptyAgg: FlushNotifyAgg = { live: 0, mock: 0, fail: 0 };

  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const remaining = await pendingAllCount();
    const quarantined = await quarantinedAllCount();
    return {
      synced: 0,
      remaining,
      quarantined,
      failed: remaining > 0,
      notifyAgg: emptyAgg,
    };
  }

  const pending = await listPendingSales();
  let synced = 0;
  let failed = false;
  let notifyAgg = emptyAgg;

  for (const row of pending) {
    if (row.quarantined) continue;
    try {
      const res = await api.createPosSale({
        ...row.payload,
        clientSaleId: row.payload.clientSaleId || row.id,
      });
      notifyAgg = accumulateFlushNotify(notifyAgg, notifyFromData(res.data));
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
        const res = await api.voidPosSale(
          op.invoiceId,
          op.payload as { approval?: never },
        );
        notifyAgg = accumulateFlushNotify(notifyAgg, notifyFromData(res.data));
      } else if (op.kind === "refund") {
        const res = await api.refundPosSale(
          op.invoiceId,
          op.payload as {
            items: { productId: string; quantity: number }[];
            reason?: string;
          },
        );
        notifyAgg = accumulateFlushNotify(notifyAgg, notifyFromData(res.data));
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
    notifyAgg,
  };
}

export { pendingSalesCount, pendingAllCount, quarantinedAllCount, discardAllQuarantined };
