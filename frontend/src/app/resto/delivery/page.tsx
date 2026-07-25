"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Truck } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type DeliveryOrder = {
  id: string;
  number: string;
  status: string;
  guests: number;
  notes: string | null;
  createdAt: string;
  itemCount: number;
  total: number;
  items: Array<{ id: string; name: string; qty: number; status: string }>;
};

export default function RestoDeliveryPage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api.getRestoActiveOrders("DELIVERY");
      setOrders(res.data.orders || []);
    } catch {
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
    setBusy(true);
    try {
      const res = await api.openRestoOrder({
        channel: "DELIVERY",
        guests: 1,
      });
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

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Truck className="w-6 h-6 text-amber-400" />
            {t.deliveryTitle}
          </h1>
          <p className="text-sm text-stone-400 mt-1">{t.deliverySub}</p>
        </div>
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
      ) : orders.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-16">{t.deliveryEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => router.push(`/resto/orders/${o.id}`)}
                className="w-full text-start rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:border-amber-500/30 hover:bg-amber-500/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{o.number}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {statusLabel(o.status)} · {o.itemCount} ·{" "}
                      {new Date(o.createdAt).toLocaleTimeString(
                        locale === "en" ? "en" : "ar",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                    </p>
                    {o.notes ? (
                      <p className="text-xs text-amber-200/80 mt-1">{o.notes}</p>
                    ) : null}
                  </div>
                  <span className="tabular-nums font-bold text-amber-200">
                    {o.total.toFixed(3)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
