"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShoppingBag } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";

type TakeawayOrder = {
  id: string;
  number: string;
  status: string;
  guests: number;
  notes: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  createdAt: string;
  itemCount: number;
  total: number;
  items: Array<{ id: string; name: string; qty: number; status: string }>;
};

export default function RestoTakeawayPage() {
  const router = useRouter();
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [orders, setOrders] = useState<TakeawayOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await api.getRestoActiveOrders("TAKEAWAY");
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
    setBusy(true);
    try {
      const res = await api.openRestoOrder({
        channel: "TAKEAWAY",
        guests: 1,
        guestName: guestName.trim() || undefined,
        guestPhone: guestPhone.trim() || undefined,
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
      setGuestName("");
      setGuestPhone("");
      router.push(`/resto/orders/${res.data.id}`);
    } catch {
      toast.error(t.actionFail);
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-amber-400" />
            {t.takeawayTitle}
          </h1>
          <p className="text-sm text-stone-400 mt-1">{t.takeawaySub}</p>
          <p className="text-[11px] text-stone-500 mt-2 leading-relaxed">
            {locale === "en"
              ? "Add a guest phone to auto-notify when the kitchen marks the order ready."
              : "أضف هاتف الضيف لإشعاره تلقائياً عندما يعلّم المطبخ الطلب جاهزاً."}
          </p>
        </div>
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
        <button
          type="button"
          disabled={busy}
          onClick={() => void openNew()}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
        >
          {t.takeawayOpen}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16 text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="text-center py-12 space-y-3">
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
        <p className="text-center text-sm text-stone-400 py-12">{t.takeawayEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => router.push(`/resto/orders/${o.id}`)}
                className="w-full text-start rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:bg-white/[0.06] transition"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold">{o.number}</p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      {new Date(o.createdAt).toLocaleTimeString(
                        locale === "en" ? "en-GB" : "ar",
                        { hour: "2-digit", minute: "2-digit" },
                      )}
                      {" · "}
                      {o.itemCount} · {o.status}
                      {o.guestName ? ` · ${o.guestName}` : ""}
                      {o.guestPhone ? ` · ${o.guestPhone}` : ""}
                    </p>
                    {o.notes ? (
                      <p className="text-xs text-amber-200/80 mt-1">{o.notes}</p>
                    ) : null}
                  </div>
                  <span className="text-sm font-bold text-amber-200">
                    {o.total.toFixed(3)}
                  </span>
                </div>
                {o.items.length > 0 ? (
                  <p className="text-xs text-stone-500 mt-2 line-clamp-2">
                    {o.items.map((i) => `${i.qty}× ${i.name}`).join(" · ")}
                  </p>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
