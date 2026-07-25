"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Send, Trash2, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import api, { RestoOrderPayload } from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { cn } from "@/lib/utils";

type MenuItem = {
  id: string;
  name: string;
  nameEn: string | null;
  price: string | number;
  category: string;
};

export default function RestoOrderPage() {
  const params = useParams();
  const orderId = String(params?.id || "");
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [order, setOrder] = useState<RestoOrderPayload | null>(null);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const refresh = useCallback(async () => {
    const res = await api.getRestoOrder(orderId);
    setOrder(res.data);
  }, [orderId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) toast.error(t.fail);
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
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await api.getRestoMenu(q.trim() || undefined);
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
      const res = await api.addRestoOrderItem(orderId, { productId, qty: 1 });
      setOrder(res.data);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.fail);
    } finally {
      setBusy(false);
    }
  };

  const removeItem = async (itemId: string) => {
    setBusy(true);
    try {
      const res = await api.removeRestoOrderItem(orderId, itemId);
      setOrder(res.data);
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.fail);
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
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.fail);
    } finally {
      setBusy(false);
    }
  };

  const close = async () => {
    if (!window.confirm(t.closeConfirm)) return;
    setBusy(true);
    try {
      const res = await api.closeRestoOrder(orderId);
      setOrder(res.data);
      toast.success(t.closeOk);
      router.push("/resto");
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response
        ?.data?.message;
      toast.error(typeof msg === "string" ? msg : t.fail);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !order) {
    return (
      <div className="flex justify-center py-24 text-stone-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const pendingCount = order.items.filter((i) => i.status === "PENDING").length;
  const closed =
    order.status === "CLOSED" || order.status === "CANCELLED";

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
          <p className="text-sm text-stone-400 mt-1">
            {order.table
              ? `${t.table} ${order.table.code}${order.table.name ? ` · ${order.table.name}` : ""}`
              : "—"}
            {" · "}
            {order.guests} {t.guests}
            {" · "}
            {statusLabel(order.status)}
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
                disabled={busy}
                onClick={() => void close()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5"
              >
                <XCircle className="w-4 h-4" />
                {t.closeOrder}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {showMenu && !closed ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.menuSearch}
            className="w-full h-10 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
          />
          <ul className="max-h-56 overflow-y-auto grid sm:grid-cols-2 gap-2">
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
              <li
                key={item.id}
                className="flex items-start justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-semibold">{item.name}</p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {item.qty} × {item.unitPrice.toFixed(3)} · {statusLabel(item.status)}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
    </div>
  );
}
