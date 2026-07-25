"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Bell, CheckCircle2, Loader2, Minus, Plus, ShoppingBag } from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/backend-api" : "http://localhost:3001/api");

type MenuItem = {
  id: string;
  name: string;
  nameEn: string | null;
  price: string | number;
  category: string;
  image?: string | null;
};

type CartLine = {
  productId: string;
  name: string;
  price: number;
  qty: number;
  notes: string;
};

type Session = {
  company: { id: string; name: string; logo: string | null; currency: string };
  table: { id: string; code: string; name: string | null; seats: number; zoneName: string };
  menu: MenuItem[];
  openOrder: {
    id: string;
    number: string;
    status: string;
    items: Array<{
      id: string;
      name: string;
      qty: number;
      lineTotal: number;
      status: string;
    }>;
    subtotal: number;
  } | null;
};

export default function GuestOrderPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState("");
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/public/resto/t/${encodeURIComponent(token)}`, {
        credentials: "omit",
      });
      if (!res.ok) throw new Error("fail");
      const data = (await res.json()) as Session;
      setSession(data);
    } catch {
      setError(
        locale === "en"
          ? "This table link is invalid or unavailable."
          : "رابط الطاولة غير صالح أو غير متاح.",
      );
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, [token, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const fmt = (n: number) => n.toFixed(3);
  const currency = session?.company.currency || "OMR";

  const filtered = useMemo(() => {
    const list = session?.menu || [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (m) =>
        m.name.toLowerCase().includes(needle) ||
        (m.nameEn || "").toLowerCase().includes(needle) ||
        (m.category || "").toLowerCase().includes(needle),
    );
  }, [session?.menu, q]);

  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const addToCart = (m: MenuItem) => {
    const price = typeof m.price === "number" ? m.price : Number(m.price);
    setCart((prev) => {
      const i = prev.findIndex((x) => x.productId === m.id);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      const name = locale === "en" && m.nameEn ? m.nameEn : m.name;
      return [...prev, { productId: m.id, name, price, qty: 1, notes: "" }];
    });
  };

  const bump = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.productId === productId ? { ...l, qty: l.qty + delta } : l,
        )
        .filter((l) => l.qty > 0),
    );
  };

  const submit = async () => {
    if (!cart.length || !token) return;
    setBusy(true);
    setOkMsg("");
    setError("");
    try {
      const res = await fetch(
        `${API}/public/resto/t/${encodeURIComponent(token)}/items`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "omit",
          body: JSON.stringify({
            items: cart.map((l) => ({
              productId: l.productId,
              qty: l.qty,
              notes: l.notes || undefined,
            })),
          }),
        },
      );
      if (!res.ok) throw new Error("fail");
      setCart([]);
      setOkMsg(
        locale === "en"
          ? "Order sent — kitchen will prepare shortly."
          : "أُرسل الطلب — سيجهّزه المطبخ قريباً.",
      );
      await load();
    } catch {
      setError(
        locale === "en" ? "Could not send order." : "تعذر إرسال الطلب.",
      );
    } finally {
      setBusy(false);
    }
  };

  const callStaff = async (type: "WAITER" | "CHECK" | "WATER") => {
    setBusy(true);
    try {
      const res = await fetch(
        `${API}/public/resto/t/${encodeURIComponent(token)}/call`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify({ type }),
        },
      );
      if (!res.ok) throw new Error("fail");
      setOkMsg(
        locale === "en"
          ? "Staff notified."
          : type === "CHECK"
            ? "طُلبت الفاتورة — النادل في الطريق."
            : type === "WATER"
              ? "طُلب الماء — النادل في الطريق."
              : "طُلب النادل.",
      );
    } catch {
      setError(locale === "en" ? "Call failed." : "تعذر استدعاء النادل.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#14110f] text-stone-100 flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!session) {
    return (
      <div
        className="min-h-screen bg-[#14110f] text-stone-100 flex items-center justify-center p-6"
        dir={locale === "en" ? "ltr" : "rtl"}
      >
        <p className="text-center text-stone-400">{error || "—"}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#14110f] text-stone-100"
      dir={locale === "en" ? "ltr" : "rtl"}
    >
      <header className="sticky top-0 z-30 border-b border-amber-500/20 bg-[#14110f]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-extrabold truncate text-amber-100">
              {session.company.name}
            </p>
            <p className="text-xs text-stone-400">
              {locale === "en" ? "Table" : "طاولة"} {session.table.code}
              {session.table.name ? ` · ${session.table.name}` : ""}
              {" · "}
              {session.table.zoneName}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLocale((l) => (l === "ar" ? "en" : "ar"))}
            className="text-xs font-bold rounded-lg border border-white/15 px-2.5 py-1.5 hover:bg-white/5"
          >
            {locale === "ar" ? "EN" : "ع"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4 pb-36">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["WAITER", locale === "en" ? "Call waiter" : "استدعاء النادل"],
              ["WATER", locale === "en" ? "Water" : "ماء"],
              ["CHECK", locale === "en" ? "Request check" : "طلب الفاتورة"],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              disabled={busy}
              onClick={() => void callStaff(type)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/5 disabled:opacity-50"
            >
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              {label}
            </button>
          ))}
        </div>

        {okMsg ? (
          <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            {okMsg}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {session.openOrder ? (
          <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
            <p className="text-xs font-bold text-stone-400">
              {locale === "en" ? "Current check" : "الطلب الحالي"}{" "}
              {session.openOrder.number}
            </p>
            <ul className="space-y-1">
              {session.openOrder.items.map((it) => (
                <li
                  key={it.id}
                  className="flex justify-between gap-2 text-sm"
                >
                  <span>
                    {it.qty}× {it.name}
                  </span>
                  <span className="tabular-nums text-amber-200">
                    {fmt(it.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-sm font-bold flex justify-between border-t border-white/10 pt-2">
              <span>{locale === "en" ? "Subtotal" : "المجموع"}</span>
              <span className="tabular-nums text-amber-100">
                {fmt(session.openOrder.subtotal)} {currency}
              </span>
            </p>
          </section>
        ) : null}

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={locale === "en" ? "Search menu…" : "ابحث في القائمة…"}
          className="w-full h-11 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm focus:outline-none focus:border-amber-500"
        />

        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((m) => {
            const label = locale === "en" && m.nameEn ? m.nameEn : m.name;
            const price = typeof m.price === "number" ? m.price : Number(m.price);
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => addToCart(m)}
                  className="w-full text-start rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden hover:border-amber-500/35"
                >
                  <div className="aspect-[16/10] bg-black/40 relative">
                    {m.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.image}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-stone-600">
                        <ShoppingBag className="w-8 h-8 opacity-40" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{label}</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        {m.category}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums text-amber-200">
                      {fmt(price)}
                    </p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </main>

      {cart.length > 0 ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-amber-500/25 bg-[#1a1614]/98 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl px-4 py-3 space-y-2">
            <ul className="max-h-28 overflow-y-auto space-y-1">
              {cart.map((l) => (
                <li
                  key={l.productId}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">{l.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => bump(l.productId, -1)}
                      className="w-7 h-7 rounded-md border border-white/15 grid place-items-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-center tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => bump(l.productId, 1)}
                      className="w-7 h-7 rounded-md border border-white/15 grid place-items-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="w-full rounded-xl bg-amber-500 py-3 text-sm font-extrabold text-[#14110f] disabled:opacity-50"
            >
              {locale === "en" ? "Send order" : "إرسال الطلب"} · {fmt(cartTotal)}{" "}
              {currency}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
