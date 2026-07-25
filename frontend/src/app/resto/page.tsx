"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
  LayoutGrid,
} from "lucide-react";
import api, { type RestoOrderPayload } from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type FloorTable = {
  id: string;
  code: string;
  name: string | null;
  seats: number;
  status: string;
  openOrder: {
    id: string;
    number: string;
    status: string;
    guests: number;
    itemCount: number;
    total?: number;
    createdAt?: string;
  } | null;
};

type FloorZone = {
  id: string;
  name: string;
  nameEn: string | null;
  tables: FloorTable[];
};

type MenuItem = {
  id: string;
  name: string;
  nameEn: string | null;
  price: string | number;
  category: string;
  image?: string | null;
  images?: string[];
  defaultStationId?: string | null;
};

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
};

function statusStyle(status: string, occupied: boolean) {
  if (occupied || status === "OCCUPIED") {
    return "border-amber-400/50 bg-amber-500/20 text-amber-50";
  }
  if (status === "BILLING") {
    return "border-sky-400/40 bg-sky-500/15 text-sky-50";
  }
  if (status === "RESERVED") {
    return "border-violet-400/40 bg-violet-500/15 text-violet-50";
  }
  return "border-emerald-500/30 bg-emerald-500/10 text-emerald-50 hover:border-emerald-400/50";
}

export default function RestoFloorPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [companyName, setCompanyName] = useState("");
  const [zones, setZones] = useState<FloorZone[]>([]);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<RestoOrderPayload | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuQ, setMenuQ] = useState("");
  const [guests, setGuests] = useState(2);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationId, setStationId] = useState("");

  const loadFloor = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.getRestoFloor();
      setCompanyName(res.data.companyName);
      setZones(res.data.zones || []);
      setEmpty(!!res.data.empty);
    } catch {
      setError(t.actionFail);
    } finally {
      setLoading(false);
    }
  }, [t.actionFail]);

  useEffect(() => {
    void loadFloor();
  }, [loadFloor]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await api.getRestoStations();
        setStations(res.data.stations || []);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  useEffect(() => {
    if (!order) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.getRestoMenu(menuQ.trim() || undefined);
          if (!cancelled) setMenu(res.data.items || []);
        } catch {
          if (!cancelled) setMenu([]);
        }
      })();
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [order, menuQ]);

  const itemStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      PENDING: t.pending,
      SENT: t.sent,
      PREPARING: t.preparing,
      READY: t.ready,
      SERVED: t.served,
      CANCELLED: t.cancelled,
    };
    return map[s] || s;
  };

  const onSeed = async () => {
    setSeeding(true);
    setError("");
    try {
      await api.seedRestoFloor(8);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setSeeding(false);
    }
  };

  const openTable = async (table: FloorTable) => {
    setBusy(true);
    setError("");
    try {
      if (table.openOrder?.id) {
        const res = await api.getRestoOrder(table.openOrder.id);
        setOrder(res.data);
      } else {
        const res = await api.openRestoOrder({
          tableId: table.id,
          guests,
        });
        setOrder(res.data);
        await loadFloor();
      }
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const refreshOrder = async (id: string) => {
    const res = await api.getRestoOrder(id);
    setOrder(res.data);
    await loadFloor();
  };

  const addProduct = async (productId: string, defaultStationId?: string | null) => {
    if (!order) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.addRestoOrderItem(order.id, {
        productId,
        qty: 1,
        stationId: stationId || defaultStationId || undefined,
      });
      setOrder(res.data);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await api.removeRestoOrderItem(order.id, itemId);
      setOrder(res.data);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const sendKitchen = async () => {
    if (!order) return;
    setBusy(true);
    try {
      const res = await api.sendRestoOrder(order.id);
      setOrder(res.data);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const closeOrder = async (
    method: "CASH" | "CREDIT_CARD" | "soft" = "CASH",
  ) => {
    if (!order) return;
    setBusy(true);
    try {
      if (method === "soft") {
        await api.closeRestoOrder(order.id, { soft: true });
      } else {
        await api.closeRestoOrder(order.id, { paymentMethod: method });
      }
      setOrder(null);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const cancelOrder = async () => {
    if (!order) return;
    if (!window.confirm(t.cancelConfirm)) return;
    setBusy(true);
    try {
      await api.cancelRestoOrder(order.id);
      setOrder(null);
      await loadFloor();
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const openTakeaway = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await api.openRestoOrder({
        channel: "TAKEAWAY",
        guests: 1,
      });
      setOrder(res.data);
    } catch {
      setError(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  const fmt = (n: number) => n.toFixed(3);
  const pendingCount =
    order?.items.filter((i) => i.status === "PENDING").length ?? 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-amber-400" />
            {t.floor}
          </h1>
          {companyName ? (
            <p className="text-sm text-stone-400 mt-1">{companyName}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-stone-400 flex items-center gap-2">
            {t.guests}
            <input
              type="number"
              min={1}
              max={50}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value) || 1)}
              className="w-14 h-9 rounded-lg bg-[#1a1614] border border-white/10 px-2 text-sm tabular-nums"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void openTakeaway()}
            className="h-9 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 text-xs font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
          >
            {t.takeaway}
          </button>
          <button
            type="button"
            onClick={() => void loadFloor()}
            className="h-9 rounded-lg border border-white/10 px-3 text-xs font-semibold text-stone-300 hover:bg-white/5"
          >
            {t.refresh}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-20 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : empty ? (
        <div className="rounded-3xl border border-dashed border-amber-500/25 bg-gradient-to-br from-amber-500/10 via-transparent to-stone-900/40 p-8 sm:p-12 text-center space-y-4">
          <p className="text-lg font-bold text-amber-100">{t.floorEmptyTitle}</p>
          <p className="text-sm text-stone-400 max-w-md mx-auto leading-relaxed">
            {t.floorEmptyBody}
          </p>
          <button
            type="button"
            disabled={seeding}
            onClick={() => void onSeed()}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#14110f] hover:bg-amber-400 disabled:opacity-60"
          >
            {seeding ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            {seeding ? t.seeding : t.seedFloor}
          </button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,380px)]">
          <div className="space-y-6">
            {zones.map((zone) => {
              const zoneLabel =
                locale === "en" && zone.nameEn ? zone.nameEn : zone.name;
              return (
                <section key={zone.id} className="space-y-3">
                  <h2 className="text-sm font-bold text-stone-300 tracking-wide">
                    {zoneLabel}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {zone.tables.map((table) => {
                      const occupied = !!table.openOrder;
                      return (
                        <button
                          key={table.id}
                          type="button"
                          disabled={busy}
                          onClick={() => void openTable(table)}
                          className={`rounded-2xl border p-4 text-start transition min-h-[110px] ${statusStyle(
                            table.status,
                            occupied,
                          )}`}
                        >
                          <p className="text-lg font-extrabold tracking-tight">
                            {table.code}
                          </p>
                          <p className="text-xs opacity-70 mt-0.5">
                            {table.seats} {t.seats}
                          </p>
                          {table.openOrder ? (
                            <div className="mt-3 space-y-0.5">
                              <p className="text-xs font-semibold">
                                {table.openOrder.number}
                              </p>
                              <p className="text-[11px] opacity-80">
                                {table.openOrder.itemCount} ·{" "}
                                {itemStatusLabel(table.openOrder.status)}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs font-semibold opacity-80">
                              {t.free}
                            </p>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <aside className="rounded-2xl border border-white/10 bg-[#1a1614]/80 p-4 space-y-3 lg:sticky lg:top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto">
            {!order ? (
              <p className="text-sm text-stone-400 py-8 text-center">
                {t.openOrder}
              </p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs text-stone-500">
                      {t.table} {order.table?.code}
                    </p>
                    <p className="font-bold text-amber-100">{order.number}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {t.guests}: {order.guests} · {itemStatusLabel(order.status)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrder(null)}
                    className="rounded-lg p-1.5 text-stone-400 hover:bg-white/5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <ul className="space-y-2">
                  {order.items.length === 0 ? (
                    <li className="text-xs text-stone-500 py-2">{t.noItems}</li>
                  ) : (
                    order.items.map((it) => (
                      <li
                        key={it.id}
                        className="flex items-start justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {it.qty}× {it.name}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {itemStatusLabel(it.status)} · {fmt(it.lineTotal)}
                          </p>
                        </div>
                        {it.status === "PENDING" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void removeItem(it.id)}
                            className="text-stone-500 hover:text-rose-300 p-1"
                            title={t.remove}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>

                <div className="flex items-center justify-between text-sm font-bold border-t border-white/10 pt-3">
                  <span>{t.orderTotal}</span>
                  <span className="tabular-nums text-amber-200">
                    {fmt(order.subtotal)}
                  </span>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    disabled={busy || pendingCount === 0}
                    onClick={() => void sendKitchen()}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-bold text-[#14110f] disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {t.sendKitchen}
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy || (order?.itemCount ?? 0) === 0}
                      onClick={() => void closeOrder("CASH")}
                      className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {t.payCash}
                    </button>
                    <button
                      type="button"
                      disabled={busy || (order?.itemCount ?? 0) === 0}
                      onClick={() => void closeOrder("CREDIT_CARD")}
                      className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {t.payCard}
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void closeOrder("soft")}
                    className="w-full rounded-xl border border-white/15 px-3 py-2 text-[11px] font-semibold text-stone-300 hover:bg-white/5 disabled:opacity-50"
                  >
                    {t.softClose}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancelOrder()}
                    className="w-full rounded-xl border border-rose-500/35 text-rose-200 px-3 py-2 text-[11px] font-semibold hover:bg-rose-500/10 disabled:opacity-50"
                  >
                    {t.cancelOrder}
                  </button>
                  <p className="text-[11px] text-stone-500 leading-relaxed">
                    {t.closePaidHint}
                  </p>
                </div>

                <div className="border-t border-white/10 pt-3 space-y-2">
                  <p className="text-xs font-bold text-stone-300">{t.addItems}</p>
                  {stations.length > 0 ? (
                    <select
                      value={stationId}
                      onChange={(e) => setStationId(e.target.value)}
                      className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-2 text-sm"
                    >
                      <option value="">{t.stationAuto}</option>
                      {stations.map((s) => (
                        <option key={s.id} value={s.id}>
                          {locale === "en" && s.nameEn ? s.nameEn : s.name}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  <input
                    value={menuQ}
                    onChange={(e) => setMenuQ(e.target.value)}
                    placeholder={t.menuSearch}
                    className="w-full h-9 rounded-lg bg-black/30 border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
                  />
                  <ul className="max-h-56 overflow-y-auto space-y-1">
                    {menu.slice(0, 40).map((m) => {
                      const label =
                        locale === "en" && m.nameEn ? m.nameEn : m.name;
                      const price =
                        typeof m.price === "number"
                          ? m.price
                          : Number(m.price);
                      const img = m.image || m.images?.[0] || null;
                      return (
                        <li key={m.id}>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              void addProduct(m.id, m.defaultStationId)
                            }
                            className="w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-start text-sm hover:bg-white/5 disabled:opacity-50"
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {img ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={img}
                                  alt=""
                                  className="w-9 h-9 rounded-lg object-cover shrink-0 border border-white/10"
                                />
                              ) : (
                                <span className="w-9 h-9 rounded-lg bg-white/5 shrink-0" />
                              )}
                              <span className="truncate">{label}</span>
                            </span>
                            <span className="text-xs text-stone-500 tabular-nums shrink-0">
                              {Number.isNaN(price) ? "—" : price.toFixed(3)}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <button
                  type="button"
                  className="hidden"
                  onClick={() => order && void refreshOrder(order.id)}
                />
              </>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
