"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type DeliveryStatus = "QUEUED" | "KITCHEN" | "READY" | "OUT" | "DELIVERED";

type DeliveryOrder = {
  id: string;
  number: string;
  status: string;
  guests: number;
  notes: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryStatus?: string | null;
  driverName?: string | null;
  driverPhone?: string | null;
  externalChannel?: string | null;
  externalOrderId?: string | null;
  createdAt: string;
  itemCount: number;
  total: number;
  items: Array<{ id: string; name: string; qty: number; status: string }>;
};

const FLOW: DeliveryStatus[] = [
  "QUEUED",
  "KITCHEN",
  "READY",
  "OUT",
  "DELIVERED",
];

export default function RestoDeliveryPage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [address, setAddress] = useState("");
  const [drivers, setDrivers] = useState<
    Record<string, { name: string; phone: string }>
  >({});

  const load = useCallback(async () => {
    try {
      const res = await api.getRestoActiveOrders("DELIVERY");
      setOrders(res.data.orders || []);
      setLoadError(false);
    } catch {
      setOrders([]);
      setLoadError(true);
      toast.error(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), 10000);
    return () => window.clearInterval(id);
  }, [load]);

  const openNew = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast.error(t.guestPhone);
      return;
    }
    setBusy(true);
    try {
      const res = await api.openRestoOrder({
        channel: "DELIVERY",
        guests: 1,
        guestName: guestName.trim(),
        guestPhone: guestPhone.trim(),
        deliveryAddress: address.trim() || undefined,
      });
      const notify = res.data.notify;
      if (notify?.ok) {
        toast.success(
          notify.mock || notify.mode === "mock"
            ? t.orderReceivedMock
            : t.orderReceivedOk,
        );
      } else if (notify?.error === "no_phone") {
        toast.message(t.orderReceivedNoPhone);
      } else if (notify) {
        toast.message(t.orderReceivedFail);
      }
      router.push(`/resto/orders/${res.data.id}`);
    } catch {
      toast.error(t.actionFail);
      setBusy(false);
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      OPEN: t.open,
      SENT: t.sent,
      PARTIAL: t.partial,
      READY: t.ready,
    };
    return map[s] || s;
  };

  const deliveryLabel = (s?: string | null) => {
    const map: Record<string, string> = {
      QUEUED: t.deliveryQueued,
      KITCHEN: t.deliveryKitchen,
      READY: t.deliveryReady,
      OUT: t.deliveryOut,
      DELIVERED: t.deliveryDelivered,
    };
    return (s && map[s]) || t.deliveryQueued;
  };

  const driverFor = (o: DeliveryOrder) =>
    drivers[o.id] || {
      name: o.driverName || "",
      phone: o.driverPhone || "",
    };

  const setDriverField = (
    id: string,
    field: "name" | "phone",
    value: string,
    fallback: DeliveryOrder,
  ) => {
    const cur = drivers[id] || {
      name: fallback.driverName || "",
      phone: fallback.driverPhone || "",
    };
    setDrivers((prev) => ({
      ...prev,
      [id]: { ...cur, [field]: value },
    }));
  };

  const toastNotify = (notify?: {
    ok: boolean;
    channel: string | null;
    error?: string;
    mock?: boolean;
    mode?: string;
  } | null) => {
    if (!notify) return;
    if (notify.ok) {
      if (notify.mock || notify.mode === "mock") {
        toast(
          `${t.notifySentMock}${notify.channel ? ` · ${notify.channel}` : ""}`,
          { icon: "🧪" },
        );
      } else {
        toast.success(
          `${t.notifySent}${notify.channel ? ` · ${notify.channel}` : ""}`,
        );
      }
      return;
    }
    if (notify.error === "no_phone") {
      toast.error(t.notifyNoPhone);
      return;
    }
    toast.error(t.notifyFail);
  };

  const advance = async (o: DeliveryOrder, next: DeliveryStatus) => {
    setBusy(true);
    try {
      const d = driverFor(o);
      const res = await api.updateRestoDelivery(o.id, {
        deliveryStatus: next,
        ...(next === "OUT" || next === "DELIVERED"
          ? {
              driverName: d.name.trim() || undefined,
              driverPhone: d.phone.trim() || undefined,
            }
          : {}),
      });
      toastNotify(res.data?.notify);
      await load();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })
        ?.response?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const nextStatus = (cur?: string | null): DeliveryStatus | null => {
    const i = FLOW.indexOf((cur as DeliveryStatus) || "QUEUED");
    if (i < 0 || i >= FLOW.length - 1) return null;
    return FLOW[i + 1];
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <Truck className="w-6 h-6 text-amber-400" />
          {t.deliveryTitle}
        </h1>
        <p className="text-sm text-stone-400 mt-1">{t.deliverySub}</p>
        <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
          {locale === "en"
            ? "Aggregator ingest: POST /api/resto/external/orders with x-api-key (idempotent by channel + order id)."
            : "استقبال المنصات: POST /api/resto/external/orders مع x-api-key (متكرر آمن عبر القناة ورقم الطلب)."}
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder={t.guestName}
            className="h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm"
          />
          <input
            value={guestPhone}
            onChange={(e) => setGuestPhone(e.target.value)}
            placeholder={t.guestPhone}
            className="h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm"
          />
        </div>
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t.deliveryAddress}
          className="w-full h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => void openNew()}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
        >
          {t.deliveryOpen}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="rounded-xl bg-amber-500 text-[#14110f] px-4 py-2 text-sm font-bold"
          >
            {t.retry}
          </button>
        </div>
      ) : orders.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-16">{t.deliveryEmpty}</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => {
            const next = nextStatus(o.deliveryStatus);
            const d = driverFor(o);
            return (
              <li
                key={o.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 space-y-3"
              >
                <button
                  type="button"
                  onClick={() => router.push(`/resto/orders/${o.id}`)}
                  className="w-full text-start"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{o.number}</p>
                      {o.externalChannel ? (
                        <span className="mt-1 inline-block text-[10px] font-bold uppercase tracking-wide rounded-md bg-sky-500/15 text-sky-200 px-1.5 py-0.5">
                          {o.externalChannel}
                          {o.externalOrderId ? ` · ${o.externalOrderId}` : ""}
                        </span>
                      ) : null}
                      <p className="text-xs text-stone-500 mt-0.5">
                        {o.guestName || "—"}
                        {o.guestPhone ? ` · ${o.guestPhone}` : ""} ·{" "}
                        {statusLabel(o.status)} · {o.itemCount}
                      </p>
                      {o.deliveryAddress ? (
                        <p className="text-xs text-amber-200/80 mt-1">
                          {o.deliveryAddress}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-end shrink-0">
                      <span className="tabular-nums font-bold text-amber-200 block">
                        {o.total.toFixed(3)}
                      </span>
                      <span className="text-[10px] font-bold text-emerald-300/90 mt-1 inline-block rounded-md bg-emerald-500/10 px-1.5 py-0.5">
                        {deliveryLabel(o.deliveryStatus)}
                      </span>
                    </div>
                  </div>
                </button>

                {(next === "OUT" ||
                  o.deliveryStatus === "OUT" ||
                  o.deliveryStatus === "READY") && (
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input
                      value={d.name}
                      onChange={(e) =>
                        setDriverField(o.id, "name", e.target.value, o)
                      }
                      placeholder={t.driverName}
                      className="h-9 rounded-lg bg-[#1a1614] border border-white/10 px-3 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <input
                      value={d.phone}
                      onChange={(e) =>
                        setDriverField(o.id, "phone", e.target.value, o)
                      }
                      placeholder={t.driverPhone}
                      className="h-9 rounded-lg bg-[#1a1614] border border-white/10 px-3 text-xs"
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                )}

                {next ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void advance(o, next)}
                    className="w-full rounded-xl border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 disabled:opacity-50"
                  >
                    {next === "OUT"
                      ? t.deliveryDispatch
                      : `${deliveryLabel(o.deliveryStatus)} → ${deliveryLabel(next)}`}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
