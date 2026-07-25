"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, UtensilsCrossed } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { restoCopy } from "@/lib/resto-copy";

type MenuItem = {
  id: string;
  name: string;
  nameEn: string | null;
  sku: string;
  barcode: string | null;
  price: string | number;
  unit: string;
  category: string;
  defaultStationId?: string | null;
  defaultStationName?: string | null;
};

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
};

export default function RestoMenuPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "RESTO_MANAGER";
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void api.getRestoStations().then((res) => {
      setStations(res.data.stations || []);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const res = await api.getRestoMenu(q.trim() || undefined);
          if (!cancelled) setItems(res.data.items || []);
        } catch {
          if (!cancelled) setItems([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  const fmt = (price: string | number) => {
    const n = typeof price === "number" ? price : Number(price);
    if (Number.isNaN(n)) return String(price);
    return n.toFixed(3);
  };

  const setStation = async (productId: string, stationId: string) => {
    setBusyId(productId);
    try {
      await api.setRestoProductStation(productId, stationId || null);
      const st = stations.find((s) => s.id === stationId);
      setItems((prev) =>
        prev.map((it) =>
          it.id === productId
            ? {
                ...it,
                defaultStationId: stationId || null,
                defaultStationName: st?.name || null,
              }
            : it,
        ),
      );
      toast.success(locale === "en" ? "Station saved" : "حُفظت المحطة");
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-amber-400" />
            {t.menuTitle}
          </h1>
          <p className="text-sm text-stone-400 mt-1">{t.menuSub}</p>
        </div>
        <p className="text-xs text-stone-500 tabular-nums">
          {items.length} {t.menuCount}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t.menuSearch}
          className="w-full h-11 rounded-xl bg-[#1a1614] border border-white/10 ps-10 pe-3 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-16">{t.menuEmpty}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => {
            const label =
              locale === "en" && item.nameEn ? item.nameEn : item.name;
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">{label}</p>
                    <p className="text-xs text-stone-500 mt-0.5 truncate">
                      {item.category}
                      {item.sku ? ` · ${item.sku}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold tabular-nums text-amber-200">
                    {fmt(item.price)}
                  </p>
                </div>
                {canManage && stations.length > 0 ? (
                  <select
                    value={item.defaultStationId || ""}
                    disabled={busyId === item.id}
                    onChange={(e) => void setStation(item.id, e.target.value)}
                    className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-xs"
                  >
                    <option value="">{t.stationAuto}</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {locale === "en" && s.nameEn ? s.nameEn : s.name}
                      </option>
                    ))}
                  </select>
                ) : item.defaultStationName ? (
                  <p className="text-[11px] text-stone-500">
                    {t.stations}: {item.defaultStationName}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
