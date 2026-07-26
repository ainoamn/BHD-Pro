"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, UtensilsCrossed, Pencil } from "lucide-react";
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
  basePrice?: string | number;
  dayPartPrices?: Partial<
    Record<"breakfast" | "lunch" | "dinner" | "late", number>
  >;
  unit: string;
  category: string;
  image?: string | null;
  images?: string[];
  allergens?: string[];
  dietaryTags?: string[];
  dayParts?: string[];
  defaultStationId?: string | null;
  defaultStationName?: string | null;
};

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
};

const ALLERGEN_CODES = [
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
] as const;

const DIETARY_TAGS = [
  "halal",
  "vegan",
  "vegetarian",
  "gluten_free",
  "dairy_free",
  "spicy",
  "nuts_free",
  "keto",
  "organic",
] as const;

const DAY_PARTS = ["breakfast", "lunch", "dinner", "late"] as const;

function DayPartPriceEditor({
  item,
  busy,
  labels,
  onSave,
}: {
  item: MenuItem;
  busy: boolean;
  labels: {
    title: string;
    hint: string;
    base: string;
    save: string;
    part: (code: string) => string;
  };
  onSave: (
    draft: Partial<Record<(typeof DAY_PARTS)[number], string>>,
  ) => Promise<void>;
}) {
  const [draft, setDraft] = useState<
    Partial<Record<(typeof DAY_PARTS)[number], string>>
  >(() => {
    const init: Partial<Record<(typeof DAY_PARTS)[number], string>> = {};
    for (const key of DAY_PARTS) {
      const v = item.dayPartPrices?.[key];
      init[key] = v != null ? String(v) : "";
    }
    return init;
  });

  useEffect(() => {
    const init: Partial<Record<(typeof DAY_PARTS)[number], string>> = {};
    for (const key of DAY_PARTS) {
      const v = item.dayPartPrices?.[key];
      init[key] = v != null ? String(v) : "";
    }
    setDraft(init);
  }, [item.id, item.dayPartPrices]);

  const base =
    item.basePrice != null
      ? typeof item.basePrice === "number"
        ? item.basePrice
        : Number(item.basePrice)
      : typeof item.price === "number"
        ? item.price
        : Number(item.price);

  return (
    <div className="space-y-1.5 rounded-xl border border-amber-500/15 bg-amber-500/5 p-2">
      <p className="text-[10px] text-stone-400">
        {labels.title}{" "}
        <span className="text-stone-600">({labels.hint})</span>
      </p>
      <p className="text-[10px] text-amber-100/70 tabular-nums">
        {labels.base}: {Number.isFinite(base) ? base.toFixed(3) : "—"}
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {DAY_PARTS.map((code) => (
          <label key={code} className="block space-y-0.5">
            <span className="text-[9px] text-stone-500">{labels.part(code)}</span>
            <input
              type="number"
              min={0}
              step="0.001"
              disabled={busy}
              value={draft[code] ?? ""}
              placeholder="—"
              onChange={(e) =>
                setDraft((d) => ({ ...d, [code]: e.target.value }))
              }
              className="w-full h-8 rounded-lg bg-black/30 border border-white/10 px-1.5 text-xs tabular-nums"
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSave(draft)}
        className="w-full rounded-lg bg-amber-500/90 py-1.5 text-[10px] font-bold text-[#14110f] disabled:opacity-50"
      >
        {labels.save}
      </button>
    </div>
  );
}

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
  const [stationsError, setStationsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [eightySix, setEightySix] = useState<
    Array<{
      productId: string;
      note: string | null;
      auto?: boolean;
      product: { name: string; nameEn: string | null } | null;
    }>
  >([]);
  const [reconciling, setReconciling] = useState(false);

  const load86 = async () => {
    try {
      const res = await api.getRestoMenu86();
      setEightySix(res.data.items || []);
    } catch {
      /* ignore */
    }
  };

  const reconcile86 = async () => {
    setReconciling(true);
    try {
      await api.reconcileRestoMenu86();
      await load86();
      const res = await api.getRestoMenu(q.trim() || undefined);
      setItems(res.data.items || []);
      toast.success(t.menu86ReconcileOk);
    } catch {
      toast.error(t.actionFail);
    } finally {
      setReconciling(false);
    }
  };

  const loadStations = useCallback(async () => {
    try {
      const res = await api.getRestoStations();
      setStations(res.data.stations || []);
      setStationsError(false);
    } catch {
      setStations([]);
      setStationsError(true);
    }
  }, []);

  useEffect(() => {
    void loadStations();
    void load86();
  }, [loadStations]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        setLoadError(false);
        try {
          const res = await api.getRestoMenu(q.trim() || undefined);
          if (!cancelled) setItems(res.data.items || []);
        } catch {
          if (!cancelled) {
            setItems([]);
            setLoadError(true);
          }
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

  const reloadMenu = () => {
    setLoading(true);
    setLoadError(false);
    void (async () => {
      try {
        const res = await api.getRestoMenu(q.trim() || undefined);
        setItems(res.data.items || []);
      } catch {
        setItems([]);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    })();
  };

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

  const toggleAllergen = async (productId: string, code: string) => {
    const item = items.find((i) => i.id === productId);
    if (!item) return;
    const current = item.allergens || [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setBusyId(productId);
    try {
      await api.setRestoProductAllergens(productId, next);
      setItems((prev) =>
        prev.map((it) =>
          it.id === productId ? { ...it, allergens: next } : it,
        ),
      );
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const toggleDietary = async (productId: string, code: string) => {
    const item = items.find((i) => i.id === productId);
    if (!item) return;
    const current = item.dietaryTags || [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setBusyId(productId);
    try {
      await api.setRestoProductDietary(productId, next);
      setItems((prev) =>
        prev.map((it) =>
          it.id === productId ? { ...it, dietaryTags: next } : it,
        ),
      );
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const toggleDayPart = async (productId: string, code: string) => {
    const item = items.find((i) => i.id === productId);
    if (!item) return;
    const current = item.dayParts || [];
    const next = current.includes(code)
      ? current.filter((c) => c !== code)
      : [...current, code];
    setBusyId(productId);
    try {
      await api.setRestoProductDayParts(productId, next);
      setItems((prev) =>
        prev.map((it) =>
          it.id === productId ? { ...it, dayParts: next } : it,
        ),
      );
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const saveDayPartPrices = async (
    productId: string,
    draft: Partial<Record<(typeof DAY_PARTS)[number], string>>,
  ) => {
    setBusyId(productId);
    try {
      const payload: Partial<
        Record<(typeof DAY_PARTS)[number], number | null>
      > = {};
      for (const key of DAY_PARTS) {
        const raw = (draft[key] ?? "").trim();
        payload[key] = raw === "" ? null : Number(raw);
      }
      const res = await api.setRestoProductDayPartPrices(productId, payload);
      setItems((prev) =>
        prev.map((it) =>
          it.id === productId
            ? {
                ...it,
                dayPartPrices: res.data.dayPartPrices,
              }
            : it,
        ),
      );
      toast.success(t.dayPartPriceSaved);
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const dayPartLabel = (code: string) => {
    if (code === "breakfast") return t.dayPartBreakfast;
    if (code === "lunch") return t.dayPartLunch;
    if (code === "dinner") return t.dayPartDinner;
    if (code === "late") return t.dayPartLate;
    return code;
  };

  const mark86 = async (productId: string) => {
    setBusyId(productId);
    try {
      await api.setRestoMenu86({ productId });
      setItems((prev) => prev.filter((it) => it.id !== productId));
      await load86();
      toast.success(t.menu86Mark);
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusyId(null);
    }
  };

  const clear86 = async (productId: string) => {
    setBusyId(productId);
    try {
      await api.clearRestoMenu86(productId);
      await load86();
      const res = await api.getRestoMenu(q.trim() || undefined);
      setItems(res.data.items || []);
      toast.success(t.menu86Clear);
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

      {stationsError && canManage ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => void loadStations()}
            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-[#14110f]"
          >
            {t.retry}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => reloadMenu()}
            className="rounded-xl bg-amber-500 text-[#14110f] px-4 py-2 text-sm font-bold"
          >
            {t.retry}
          </button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-stone-400 py-16">{t.menuEmpty}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const label =
              locale === "en" && item.nameEn ? item.nameEn : item.name;
            const img = item.image || item.images?.[0] || null;
            return (
              <li
                key={item.id}
                className="rounded-2xl border border-white/8 bg-white/[0.03] overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] bg-black/40 relative">
                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={label}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-stone-600">
                      <UtensilsCrossed className="w-10 h-10 opacity-40" />
                    </div>
                  )}
                </div>
                <div className="px-3 py-3 space-y-2 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2">
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
                  {canManage ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-stone-500">{t.allergens}</p>
                      <div className="flex flex-wrap gap-1">
                        {ALLERGEN_CODES.map((code) => {
                          const on = (item.allergens || []).includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void toggleAllergen(item.id, code)}
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${
                                on
                                  ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                                  : "border-white/10 text-stone-500 hover:border-white/25"
                              }`}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (item.allergens || []).length > 0 ? (
                    <p className="text-[10px] text-amber-200/80">
                      {t.allergens}: {(item.allergens || []).join(", ")}
                    </p>
                  ) : null}
                  {canManage ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-stone-500">{t.dietary}</p>
                      <div className="flex flex-wrap gap-1">
                        {DIETARY_TAGS.map((code) => {
                          const on = (item.dietaryTags || []).includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void toggleDietary(item.id, code)}
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${
                                on
                                  ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                                  : "border-white/10 text-stone-500 hover:border-white/25"
                              }`}
                            >
                              {code}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (item.dietaryTags || []).length > 0 ? (
                    <p className="text-[10px] text-emerald-200/80">
                      {t.dietary}: {(item.dietaryTags || []).join(", ")}
                    </p>
                  ) : null}
                  {canManage ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-stone-500">
                        {t.dayParts}{" "}
                        <span className="text-stone-600">({t.dayPartsHint})</span>
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {DAY_PARTS.map((code) => {
                          const on = (item.dayParts || []).includes(code);
                          return (
                            <button
                              key={code}
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void toggleDayPart(item.id, code)}
                              className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${
                                on
                                  ? "border-sky-400/50 bg-sky-500/20 text-sky-100"
                                  : "border-white/10 text-stone-500 hover:border-white/25"
                              }`}
                            >
                              {dayPartLabel(code)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (item.dayParts || []).length > 0 ? (
                    <p className="text-[10px] text-sky-200/80">
                      {t.dayParts}:{" "}
                      {(item.dayParts || []).map(dayPartLabel).join(", ")}
                    </p>
                  ) : (
                    <p className="text-[10px] text-stone-500">{t.dayPartAll}</p>
                  )}
                  {canManage ? (
                    <DayPartPriceEditor
                      item={item}
                      busy={busyId === item.id}
                      labels={{
                        title: t.dayPartPrices,
                        hint: t.dayPartPricesHint,
                        base: t.basePrice,
                        save: t.dayPartSave,
                        part: dayPartLabel,
                      }}
                      onSave={(draft) => saveDayPartPrices(item.id, draft)}
                    />
                  ) : Object.keys(item.dayPartPrices || {}).length > 0 ? (
                    <p className="text-[10px] text-amber-200/80">
                      {t.dayPartPrices}:{" "}
                      {DAY_PARTS.filter(
                        (c) => item.dayPartPrices?.[c] != null,
                      )
                        .map(
                          (c) =>
                            `${dayPartLabel(c)} ${Number(item.dayPartPrices?.[c]).toFixed(3)}`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                  {canManage ? (
                    <div className="flex items-center justify-between gap-2 mt-auto">
                      <Link
                        href="/inventory"
                        className="inline-flex items-center gap-1 text-[11px] text-amber-300/90 hover:text-amber-200"
                      >
                        <Pencil className="w-3 h-3" />
                        {t.editInInventory}
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void mark86(item.id)}
                        className="text-[11px] font-bold text-rose-300/90 hover:text-rose-200"
                      >
                        {t.menu86Mark}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold text-rose-100">{t.menu86Title}</h2>
            <p className="text-xs text-stone-400 mt-0.5">{t.menu86Sub}</p>
          </div>
          {canManage ? (
            <button
              type="button"
              disabled={reconciling}
              onClick={() => void reconcile86()}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-rose-400/30 bg-rose-500/10 text-xs font-bold text-rose-100 hover:bg-rose-500/20 disabled:opacity-50"
            >
              {reconciling ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              {t.menu86Reconcile}
            </button>
          ) : null}
        </div>
        {eightySix.length === 0 ? (
          <p className="text-sm text-stone-500">{t.menu86Empty}</p>
        ) : (
          <ul className="space-y-2">
            {eightySix.map((row) => {
              const label =
                locale === "en" && row.product?.nameEn
                  ? row.product.nameEn
                  : row.product?.name || row.productId;
              return (
                <li
                  key={row.productId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <div className="min-w-0 flex items-center gap-2">
                    <span className="font-semibold text-rose-100/90 truncate">
                      {label}
                    </span>
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                        row.auto
                          ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                          : "bg-white/10 text-stone-300 border border-white/15"
                      }`}
                    >
                      {row.auto ? t.menu86Auto : t.menu86Manual}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === row.productId}
                    onClick={() => void clear86(row.productId)}
                    className="text-[11px] font-bold text-emerald-300 hover:text-emerald-200 shrink-0"
                  >
                    {t.menu86Clear}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
