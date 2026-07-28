/** Honest POS customer-notify toasts (sale / void / refund / blind / offline flush). */

import toast from "react-hot-toast";

export type CustomerNotifySummary = {
  whatsapp?: string;
  email?: string;
  sms?: string;
} | null | undefined;

export type CustomerNotifyCopy = {
  saleNotifyOk: string;
  saleNotifyMock: string;
  saleNotifyPartial: string;
  saleNotifyFail: string;
};

export type FlushNotifyAgg = {
  live: number;
  mock: number;
  fail: number;
};

export function classifyCustomerNotify(
  notify: CustomerNotifySummary,
): "ok" | "mock" | "fail" | "partial" | "none" {
  if (!notify) return "none";
  const statuses = ["whatsapp", "email", "sms"].map(
    (c) => notify[c as "whatsapp" | "email" | "sms"] || "skipped",
  );
  const live = statuses.filter((s) => s === "ok").length;
  const mock = statuses.filter((s) => s === "mock").length;
  const fail = statuses.filter((s) => s === "fail").length;
  if (mock > 0 && live === 0) return "mock";
  if (fail > 0 && live === 0 && mock === 0) return "fail";
  if (mock > 0 || fail > 0) return "partial";
  if (live > 0) return "ok";
  return "none";
}

export function toastPosCustomerNotify(
  notify: CustomerNotifySummary,
  copy: CustomerNotifyCopy,
) {
  const kind = classifyCustomerNotify(notify);
  if (kind === "mock") {
    toast(copy.saleNotifyMock, { icon: "🧪", duration: 6000 });
  } else if (kind === "fail") {
    toast(copy.saleNotifyFail, { icon: "⚠️", duration: 6000 });
  } else if (kind === "partial") {
    toast(copy.saleNotifyPartial, { icon: "🧪", duration: 6000 });
  } else if (kind === "ok") {
    toast.success(copy.saleNotifyOk, { duration: 4000 });
  }
}

/** One summary toast after offline flush (avoids N toasts for N sales). */
export function toastFlushCustomerNotify(
  agg: FlushNotifyAgg | null | undefined,
  copy: CustomerNotifyCopy,
) {
  if (!agg) return;
  const { live, mock, fail } = agg;
  if (mock > 0 && live === 0) {
    toast(copy.saleNotifyMock, { icon: "🧪", duration: 6000 });
  } else if (fail > 0 && live === 0 && mock === 0) {
    toast(copy.saleNotifyFail, { icon: "⚠️", duration: 6000 });
  } else if (mock > 0 || fail > 0) {
    toast(copy.saleNotifyPartial, { icon: "🧪", duration: 6000 });
  } else if (live > 0) {
    toast.success(copy.saleNotifyOk, { duration: 4000 });
  }
}

export function accumulateFlushNotify(
  agg: FlushNotifyAgg,
  notify: CustomerNotifySummary,
): FlushNotifyAgg {
  const kind = classifyCustomerNotify(notify);
  if (kind === "ok") return { ...agg, live: agg.live + 1 };
  if (kind === "mock") return { ...agg, mock: agg.mock + 1 };
  if (kind === "fail") return { ...agg, fail: agg.fail + 1 };
  if (kind === "partial") {
    return { ...agg, mock: agg.mock + 1, fail: agg.fail + 1 };
  }
  return agg;
}

export type TipNotifySummary = {
  ok: boolean;
  channel?: string | null;
  error?: string;
  mock?: boolean;
} | null | undefined;

export type TipNotifyCopy = {
  tipNotifyOk: string;
  tipNotifyMock: string;
  tipNotifyFail: string;
  tipNotifyNoContact: string;
};

export function toastTipNotify(
  notify: TipNotifySummary,
  copy: TipNotifyCopy,
) {
  if (!notify) return;
  if (notify.ok) {
    if (notify.mock) {
      toast(copy.tipNotifyMock, { icon: "🧪", duration: 5000 });
    } else {
      toast.success(
        `${copy.tipNotifyOk}${notify.channel ? ` · ${notify.channel}` : ""}`,
        { duration: 4000 },
      );
    }
    return;
  }
  if (
    notify.error === "no_phone_or_email" ||
    notify.error === "no_assignee"
  ) {
    toast(copy.tipNotifyNoContact, { icon: "⚠️", duration: 5000 });
    return;
  }
  toast(copy.tipNotifyFail, { icon: "⚠️", duration: 5000 });
}
