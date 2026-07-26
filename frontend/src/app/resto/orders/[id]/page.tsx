"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowRight,
  Loader2,
  Plus,
  Printer,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import api, { RestoOrderPayload } from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { useAuthStore } from "@/store/auth";
import { restoCopy } from "@/lib/resto-copy";
import { printRestoGuestCheck } from "@/lib/resto-guest-check";
import { cn, apiErrorMessage } from "@/lib/utils";
import {
  DualApprovalModal,
  type DualApprovalPayload,
} from "@/components/security/dual-approval-modal";

type MenuItem = {
  id: string;
  name: string;
  nameEn: string | null;
  price: string | number;
  category: string;
};

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
};

export default function RestoOrderPage() {
  const params = useParams();
  const orderId = String(params?.id || "");
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const company = useAuthStore((s) => s.company);
  const user = useAuthStore((s) => s.user);
  const [order, setOrder] = useState<RestoOrderPayload | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [menuError, setMenuError] = useState(false);
  const [stations, setStations] = useState<Station[]>([]);
  const [stationsError, setStationsError] = useState(false);
  const [stationId, setStationId] = useState("");
  const [itemNote, setItemNote] = useState("");
  const [tipAmount, setTipAmount] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [cancelDualOpen, setCancelDualOpen] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.getRestoOrder(orderId);
    setOrder(res.data);
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadError(false);
        await refresh();
      } catch {
        if (!cancelled) {
          setLoadError(true);
          toast.error(t.fail);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, t.fail]);

  useEffect(() => {
    if (!showMenu) return;
    let cancelled = false;
    void api
      .getRestoStations()
      .then((res) => {
        if (cancelled) return;
        const list = res.data.stations || [];
        setStations(list);
        setStationsError(false);
        setStationId((prev) => prev || list[0]?.id || "");
      })
      .catch(() => {
        if (!cancelled) {
          setStations([]);
          setStationsError(true);
        }
      });
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.getRestoMenu(q.trim() || undefined);
          if (!cancelled) {
            setMenu(res.data.items || []);
            setMenuError(false);
          }
        } catch {
          if (!cancelled) {
            setMenu([]);
            setMenuError(true);
          }
        }
      })();
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [showMenu, q]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      OPEN: t.open,
      SENT: t.sent,
      PARTIAL: t.partial,
      READY: t.ready,
      CLOSED: t.closed,
      CANCELLED: t.cancelled,
      PENDING: t.pending,
      PREPARING: t.preparing,
      SERVED: t.served,
    };
    return map[s] || s;
  };

  const addProduct = async (productId: string) => {
    setBusy(true);
    try {
      const res = await api.addRestoOrderItem(orderId, {
        productId,
        qty: 1,
        stationId: stationId || undefined,
        notes: itemNote.trim() || undefined,
      });
      setOrder(res.data);
      setItemNote("");
    } catch (err) { toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  const bumpQty = async (itemId: string, qty: number) => {
    if (qty < 1) return;
    setBusy(true);
    try {
      const res = await api.updateRestoOrderItem(orderId, itemId, { qty });
      setOrder(res.data);
    } catch (err) { toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  const saveItemNote = async (itemId: string, notes: string) => {
    setBusy(true);
    try {
      const res = await api.updateRestoOrderItem(orderId, itemId, { notes });
      setOrder(res.data);
    } catch (err) { toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  const saveGuests = async (n: number) => {
    setBusy(true);
    try {
      const res = await api.updateRestoOrder(orderId, { guests: n });
      setOrder(res.data);
    } catch (err) { toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusy(true);
    try {
      const res = await api.removeRestoOrderItem(orderId, itemId);
      setOrder(res.data);
    } catch (err) { toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    setBusy(true);
    try {
      const res = await api.sendRestoOrder(orderId);
      setOrder(res.data);
      toast.success(t.sendOk);
    } catch (err) { toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  const printCheck = () => {
    if (!order) return;
    printRestoGuestCheck({
      order,
      company: company
        ? {
            name: company.name,
            address: company.address,
            city: company.city,
            country: company.country,
            phone: company.phone,
            email: company.email,
            vatNumber: company.vatNumber,
            crNumber: company.crNumber,
            logo: company.logo,
          }
        : { name: "Hisaby" },
      currency: company?.currency || "OMR",
      locale: locale === "en" ? "en" : "ar",
      tipAmount: Number(tipAmount) || 0,
    });
  };

  const close = async (method: "CASH" | "CREDIT_CARD" | "soft" = "CASH") => {
    if (method === "soft") {
      if (!window.confirm(t.closeConfirm)) return;
    }
    setBusy(true);
    try {
      if (method === "soft") {
        await api.closeRestoOrder(orderId, { soft: true });
      } else {
        await api.closeRestoOrder(orderId, {
          paymentMethod: method,
          tipAmount: Number(tipAmount) || undefined,
        });
        toast.success(t.closePaidOk);
      }
      router.push("/resto");
    } catch (err) { toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setCancelDualOpen(true);
  };

  const confirmCancel = async (approval: DualApprovalPayload) => {
    setBusy(true);
    try {
      await api.cancelRestoOrder(orderId, approval);
      toast.success(t.cancelOk);
      setCancelDualOpen(false);
      router.push("/resto");
    } catch (err) {
      toast.error(apiErrorMessage(err, t.fail));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-stone-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (loadError || !order) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center px-4">
        <p className="text-sm text-stone-400">{t.fail}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setLoadError(false);
            void (async () => {
              try {
                await refresh();
              } catch {
                setLoadError(true);
                toast.error(t.fail);
              } finally {
                setLoading(false);
              }
            })();
          }}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white"
        >
          {locale === "en" ? "Retry" : "إعادة المحاولة"}
        </button>
        <Link href="/resto" className="text-xs text-stone-500 hover:text-amber-200">
          {locale === "en" ? "Back to floor" : "العودة للصالة"}
        </Link>
      </div>
    );
  }

  const pendingCount = order.items.filter((i) => i.status === "PENDING").length;
  const closed = order.status === "CLOSED" || order.status === "CANCELLED";

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/resto"
            className="inline-flex items-center gap-1 text-xs text-stone-400 hover:text-amber-200 mb-2"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            {t.floor}
          </Link>
          <h1 className="text-xl font-extrabold">
            {t.order} {order.number}
          </h1>
          <p className="text-sm text-stone-400 mt-1 flex flex-wrap items-center gap-2">
            {order.table
              ? `${t.table} ${order.table.code}${order.table.name ? ` · ${order.table.name}` : ""}`
              : "—"}
            <span>·</span>
            {!closed ? (
              <>
                <span>{t.guestsEdit}</span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={order.guests}
                  disabled={busy}
                  onChange={(e) =>
                    void saveGuests(Math.max(1, Number(e.target.value) || 1))
                  }
                  className="w-14 h-8 rounded-lg bg-[#1a1614] border border-white/10 px-2 text-sm tabular-nums"
                />
              </>
            ) : (
              <span>
                {order.guests} {t.guests}
              </span>
            )}
            <span>· {statusLabel(order.status)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!closed ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => setShowMenu((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15"
              >
                <Plus className="w-4 h-4" />
                {t.addItems}
              </button>
              <button
                type="button"
                disabled={busy || pendingCount === 0}
                onClick={() => void send()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-[#14110f] hover:bg-amber-400 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {t.sendKitchen}
                {pendingCount > 0 ? ` (${pendingCount})` : ""}
              </button>
              <button
                type="button"
                disabled={!order.items.length}
                onClick={printCheck}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5 disabled:opacity-40"
              >
                <Printer className="w-4 h-4" />
                {t.printCheck}
              </button>
              <button
                type="button"
                disabled={busy || order.itemCount === 0}
                onClick={() => void close("CASH")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                {t.payCash}
              </button>
              <button
                type="button"
                disabled={busy || order.itemCount === 0}
                onClick={() => void close("CREDIT_CARD")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-500 disabled:opacity-40"
              >
                {t.payCard}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void close("soft")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5"
              >
                <XCircle className="w-4 h-4" />
                {t.softClose}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void cancel()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 text-rose-200 px-3 py-2 text-xs font-bold hover:bg-rose-500/10"
              >
                {t.cancelOrder}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {!closed ? (
        <label className="inline-flex items-center gap-2 text-sm text-stone-300">
          <span>{t.tipAmount}</span>
          <input
            type="number"
            min={0}
            step="0.001"
            value={tipAmount}
            onChange={(e) => setTipAmount(e.target.value)}
            className="w-28 h-9 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm tabular-nums"
          />
        </label>
      ) : null}

      {showMenu && !closed ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
          {stationsError ? (
            <p className="text-xs text-rose-300">
              {t.loadFailed}{" "}
              <button
                type="button"
                className="underline text-amber-300"
                onClick={() => {
                  setStationsError(false);
                  void api
                    .getRestoStations()
                    .then((res) => {
                      const list = res.data.stations || [];
                      setStations(list);
                      setStationId((prev) => prev || list[0]?.id || "");
                    })
                    .catch(() => setStationsError(true));
                }}
              >
                {t.retry}
              </button>
            </p>
          ) : null}
          {stations.length > 0 ? (
            <label className="block space-y-1">
              <span className="text-[11px] text-stone-400">{t.toStation}</span>
              <select
                value={stationId}
                onChange={(e) => setStationId(e.target.value)}
                className="w-full h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm"
              >
                {stations.map((s) => (
                  <option key={s.id} value={s.id}>
                    {locale === "en" && s.nameEn ? s.nameEn : s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <input
            value={itemNote}
            onChange={(e) => setItemNote(e.target.value)}
            placeholder={t.itemNotesPh}
            className="w-full h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.menuSearch}
            className="w-full h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
          />
          <ul className="max-h-56 overflow-y-auto grid sm:grid-cols-2 gap-2">
            {menuError ? (
              <li className="sm:col-span-2 text-xs text-rose-300 py-2">
                {t.loadFailed}{" "}
                <button
                  type="button"
                  className="underline text-amber-300"
                  onClick={() => {
                    setMenuError(false);
                    void api
                      .getRestoMenu(q.trim() || undefined)
                      .then((res) => setMenu(res.data.items || []))
                      .catch(() => setMenuError(true));
                  }}
                >
                  {t.retry}
                </button>
              </li>
            ) : null}
            {menu.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void addProduct(m.id)}
                  className="w-full text-start rounded-xl border border-white/8 px-3 py-2 hover:bg-amber-500/10 disabled:opacity-50"
                >
                  <span className="font-semibold text-sm">
                    {locale === "en" && m.nameEn ? m.nameEn : m.name}
                  </span>
                  <span className="block text-xs text-amber-200/80 tabular-nums mt-0.5">
                    {Number(m.price).toFixed(3)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-2xl border border-white/10 overflow-hidden">
        {order.items.length === 0 ? (
          <p className="p-8 text-center text-sm text-stone-400">{t.noItems}</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {order.items.map((item) => (
              <li key={item.id} className="px-4 py-3 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {item.unitPrice.toFixed(3)} · {statusLabel(item.status)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.status === "PENDING" && !closed ? (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busy || item.qty <= 1}
                          onClick={() => void bumpQty(item.id, Number(item.qty) - 1)}
                          className="w-8 h-8 rounded-lg border border-white/10 text-sm font-bold disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-7 text-center text-sm tabular-nums">
                          {item.qty}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void bumpQty(item.id, Number(item.qty) + 1)}
                          className="w-8 h-8 rounded-lg border border-white/10 text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="text-sm tabular-nums text-stone-400">
                        ×{item.qty}
                      </span>
                    )}
                    <span className="font-bold tabular-nums text-amber-200">
                      {item.lineTotal.toFixed(3)}
                    </span>
                    {item.status === "PENDING" && !closed ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeItem(item.id)}
                        className="p-1.5 rounded-lg text-stone-400 hover:bg-rose-500/15 hover:text-rose-300"
                        title={t.remove}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
                {item.status === "PENDING" && !closed ? (
                  <input
                    defaultValue={item.notes || ""}
                    placeholder={t.itemNotesPh}
                    disabled={busy}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (item.notes || "")) {
                        void saveItemNote(item.id, v);
                      }
                    }}
                    className="w-full h-9 rounded-lg bg-[#1a1614] border border-white/10 px-3 text-xs"
                  />
                ) : item.notes ? (
                  <p className="text-xs text-amber-200/80">{item.notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <div
          className={cn(
            "flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.02]",
          )}
        >
          <span className="text-sm text-stone-400">{t.subtotal}</span>
          <span className="text-lg font-extrabold tabular-nums text-amber-100">
            {order.subtotal.toFixed(3)}
          </span>
        </div>
      </div>

      <DualApprovalModal
        open={cancelDualOpen}
        action="RESTO_VOID"
        actionLabel={t.cancelOrder}
        payload={{ orderId }}
        summary={t.cancelConfirm}
        actorRole={user?.role}
        busy={busy}
        onCancel={() => !busy && setCancelDualOpen(false)}
        onConfirm={confirmCancel}
      />
    </div>
  );
}
