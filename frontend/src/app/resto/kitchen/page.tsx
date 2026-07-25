"use client";

import { useCallback, useEffect, useState } from "react";
import { ChefHat, Loader2, RefreshCw } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type KitchenItem = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  status: string;
  sentAt: string | null;
  orderId: string;
  orderNumber: string;
  table: { id: string; code: string; name: string | null } | null;
};

export default function RestoKitchenPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [items, setItems] = useState<KitchenItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getRestoKitchen();
      setItems(res.data.items || []);
      setError("");
    } catch {
      setError(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), 8000);
    return () => window.clearInterval(id);
  }, [load]);

  const setStatus = async (
    itemId: string,
    status: "PREPARING" | "READY" | "SERVED",
  ) => {
    setBusyId(itemId);
    try {
      await api.setRestoKitchenItemStatus(itemId, status);
      await load();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const ageMin = (sentAt: string | null) => {
    if (!sentAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(sentAt).getTime()) / 60000));
  };

  const cardTone = (status: string, minutes: number) => {
    if (status === "READY") return "border-emerald-400/40 bg-emerald-500/10";
    if (minutes >= 15) return "border-rose-400/50 bg-rose-500/15";
    if (minutes >= 8) return "border-amber-400/45 bg-amber-500/15";
    return "border-white/10 bg-white/[0.04]";
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ChefHat className="w-6 h-6 text-amber-400" />
            {t.kitchenTitle}
          </h1>
          <p className="text-sm text-stone-400 mt-1">{t.kitchenSub}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-stone-300 hover:bg-white/5"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t.refresh}
        </button>
      </div>

      {error ? (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-20">{t.kitchenEmpty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((it) => {
            const minutes = ageMin(it.sentAt);
            const busy = busyId === it.id;
            return (
              <li
                key={it.id}
                className={`rounded-2xl border p-4 space-y-3 ${cardTone(it.status, minutes)}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-400">
                      {t.table} {it.table?.code || "—"} · {it.orderNumber}
                    </p>
                    <p className="text-lg font-extrabold mt-0.5">
                      {it.qty}× {it.name}
                    </p>
                    {it.notes ? (
                      <p className="text-xs text-amber-200/90 mt-1">{it.notes}</p>
                    ) : null}
                  </div>
                  <span className="text-xs font-bold tabular-nums text-stone-300 shrink-0">
                    {minutes}m
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {it.status === "SENT" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(it.id, "PREPARING")}
                      className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-xs font-bold text-[#14110f] disabled:opacity-50"
                    >
                      {t.markPreparing}
                    </button>
                  ) : null}
                  {it.status === "SENT" || it.status === "PREPARING" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(it.id, "READY")}
                      className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold text-[#0f1410] disabled:opacity-50"
                    >
                      {t.markReady}
                    </button>
                  ) : null}
                  {it.status === "READY" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void setStatus(it.id, "SERVED")}
                      className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold text-stone-100 disabled:opacity-50"
                    >
                      {t.markServed}
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
