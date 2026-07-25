"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type ExpoItem = {
  id: string;
  name: string;
  qty: number;
  notes: string | null;
  course: number;
  status: string;
  readyAt: string | null;
  orderId: string;
  orderNumber: string;
  channel: string;
  guestName: string | null;
  stationName: string | null;
  table: { id: string; code: string; name: string | null } | null;
};

export default function RestoExpoPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [items, setItems] = useState<ExpoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getRestoExpo();
      setItems(res.data.items || []);
      setError("");
    } catch {
      setError(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    setLoading(true);
    void load();
    const id = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(id);
  }, [load]);

  const serve = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await api.setRestoKitchenItemStatus(itemId, "SERVED");
      await load();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const courseLabel = (c: number) => {
    if (c === 0) return t.courseDrinks;
    if (c === 2) return t.courseMain;
    if (c === 3) return t.courseDessert;
    return t.courseStarter;
  };

  const ageMin = (readyAt: string | null) => {
    if (!readyAt) return 0;
    return Math.max(
      0,
      Math.floor((Date.now() - new Date(readyAt).getTime()) / 60000),
    );
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold flex items-center gap-2">
          <BellRing className="w-6 h-6 text-amber-400" />
          {t.expoTitle}
        </h1>
        <p className="text-sm text-stone-400 mt-1">{t.expoSub}</p>
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
        <p className="text-center text-sm text-stone-400 py-20">{t.expoEmpty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {items.map((it) => {
            const mins = ageMin(it.readyAt);
            return (
              <li
                key={it.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  mins >= 5
                    ? "border-rose-400/45 bg-rose-500/10"
                    : "border-emerald-400/35 bg-emerald-500/10"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-400">
                      {it.table
                        ? `${t.table} ${it.table.code}`
                        : it.channel === "DELIVERY"
                          ? t.delivery
                          : t.takeaway}
                      {" · "}
                      {it.orderNumber}
                      {it.guestName ? ` · ${it.guestName}` : ""}
                      {it.stationName ? ` · ${it.stationName}` : ""}
                      {" · "}
                      {courseLabel(it.course)}
                    </p>
                    <p className="text-lg font-extrabold mt-0.5">
                      {it.qty}× {it.name}
                    </p>
                    {it.notes ? (
                      <p className="text-xs text-amber-200/90 mt-1">{it.notes}</p>
                    ) : null}
                  </div>
                  <span className="text-xs font-bold tabular-nums shrink-0">
                    {mins}m
                  </span>
                </div>
                <button
                  type="button"
                  disabled={busyId === it.id}
                  onClick={() => void serve(it.id)}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  {t.expoServe}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
