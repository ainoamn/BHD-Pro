"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, UtensilsCrossed } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
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
};

export default function RestoMenuPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [q, setQ] = useState("");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

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
                className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 flex items-start justify-between gap-3"
              >
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
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
