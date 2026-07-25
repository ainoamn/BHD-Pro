"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Bell, CheckCircle2, Loader2, Minus, Plus, ShoppingBag, X } from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/backend-api" : "http://localhost:3001/api");

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

type MenuItem = {
  id: string;
  name: string;
  nameEn: string | null;
  price: string | number;
  category: string;
  image?: string | null;
  allergens?: string[];
  dietaryTags?: string[];
  dayParts?: string[];
};

type Modifier = {
  id: string;
  name: string;
  nameEn: string | null;
  priceDelta: number;
};

type CartLine = {
  key: string;
  productId: string;
  name: string;
  price: number;
  qty: number;
  notes: string;
  course: number;
  modifiers: Array<{ name: string; priceDelta: number }>;
};

type Session = {
  company: { id: string; name: string; logo: string | null; currency: string };
  table: { id: string; code: string; name: string | null; seats: number; zoneName: string };
  menu: MenuItem[];
  dayPart?: string | null;
  modifiers?: Modifier[];
  openOrder: {
    id: string;
    number: string;
    status: string;
    invoiceId?: string | null;
    paymentStatus?: string | null;
    payUrl?: string | null;
    items: Array<{
      id: string;
      name: string;
      qty: number;
      lineTotal: number;
      status: string;
      course?: number;
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
  const [hideAllergens, setHideAllergens] = useState<string[]>([]);
  const [needDietary, setNeedDietary] = useState<string[]>([]);
  const [course, setCourse] = useState(1);
  const [pickedMods, setPickedMods] = useState<string[]>([]);
  const [lineNote, setLineNote] = useState("");
  const [composeFor, setComposeFor] = useState<MenuItem | null>(null);
  const [payTip, setPayTip] = useState("");
  const [paying, setPaying] = useState(false);

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
  const modifiers = session?.modifiers || [];

  const courseLabel = (c: number) => {
    if (locale === "en") {
      return ["Drinks", "Starters", "Mains", "Dessert"][c] || String(c);
    }
    return ["مشروبات", "مقبلات", "رئيسية", "حلويات"][c] || String(c);
  };

  const filtered = useMemo(() => {
    const list = session?.menu || [];
    const needle = q.trim().toLowerCase();
    return list.filter((m) => {
      if (
        hideAllergens.length > 0 &&
        (m.allergens || []).some((a) => hideAllergens.includes(a))
      ) {
        return false;
      }
      if (
        needDietary.length > 0 &&
        !needDietary.every((d) => (m.dietaryTags || []).includes(d))
      ) {
        return false;
      }
      if (!needle) return true;
      return (
        m.name.toLowerCase().includes(needle) ||
        (m.nameEn || "").toLowerCase().includes(needle) ||
        (m.category || "").toLowerCase().includes(needle) ||
        (m.dietaryTags || []).some((d) => d.includes(needle))
      );
    });
  }, [session?.menu, q, hideAllergens, needDietary]);

  const dayPartLabel = (code: string | null | undefined) => {
    if (!code) return "";
    if (locale === "en") {
      return (
        (
          {
            breakfast: "Breakfast",
            lunch: "Lunch",
            dinner: "Dinner",
            late: "Late night",
          } as Record<string, string>
        )[code] || code
      );
    }
    return (
      (
        {
          breakfast: "فطور",
          lunch: "غداء",
          dinner: "عشاء",
          late: "ليلي",
        } as Record<string, string>
      )[code] || code
    );
  };

  const cartTotal = cart.reduce((s, l) => s + l.price * l.qty, 0);

  const openCompose = (m: MenuItem) => {
    setComposeFor(m);
    setPickedMods([]);
    setLineNote("");
  };

  const confirmCompose = () => {
    if (!composeFor) return;
    const base =
      typeof composeFor.price === "number"
        ? composeFor.price
        : Number(composeFor.price);
    const mods = modifiers
      .filter((m) => pickedMods.includes(m.id))
      .map((m) => ({
        name: locale === "en" && m.nameEn ? m.nameEn : m.name,
        priceDelta: Number(m.priceDelta) || 0,
      }));
    const delta = mods.reduce((s, m) => s + m.priceDelta, 0);
    const name =
      locale === "en" && composeFor.nameEn ? composeFor.nameEn : composeFor.name;
    const key = `${composeFor.id}|${course}|${mods.map((m) => m.name).join(",")}|${lineNote}`;
    setCart((prev) => {
      const i = prev.findIndex((x) => x.key === key);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: next[i].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          key,
          productId: composeFor.id,
          name: mods.length ? `${name} (+)` : name,
          price: base + delta,
          qty: 1,
          notes: lineNote.trim(),
          course,
          modifiers: mods,
        },
      ];
    });
    setComposeFor(null);
  };

  const bump = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.key === key ? { ...l, qty: l.qty + delta } : l))
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
              course: l.course,
              modifiers: l.modifiers.length ? l.modifiers : undefined,
            })),
          }),
        },
      );
      if (!res.ok) throw new Error("fail");
      setCart([]);
      setOkMsg(
        locale === "en"
          ? "Order sent to kitchen."
          : "أُرسل الطلب مباشرة إلى المطبخ.",
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

  const startPay = async () => {
    if (!token) return;
    setPaying(true);
    setError("");
    try {
      const tip = Number(payTip) || 0;
      const res = await fetch(
        `${API}/public/resto/t/${encodeURIComponent(token)}/pay`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          credentials: "omit",
          body: JSON.stringify({
            tipAmount: tip > 0 ? tip : undefined,
          }),
        },
      );
      if (!res.ok) throw new Error("fail");
      const data = (await res.json()) as {
        payUrl?: string | null;
        alreadyPaid?: boolean;
      };
      if (data.alreadyPaid) {
        setOkMsg(
          locale === "en" ? "Already paid — thank you." : "مدفوع مسبقاً — شكراً.",
        );
        await load();
        return;
      }
      if (data.payUrl) {
        window.location.href = data.payUrl;
        return;
      }
      throw new Error("fail");
    } catch {
      setError(
        locale === "en"
          ? "Could not start payment."
          : "تعذر بدء الدفع أونلاين.",
      );
    } finally {
      setPaying(false);
    }
  };

  const toggleHide = (code: string) => {
    setHideAllergens((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const toggleDietaryNeed = (code: string) => {
    setNeedDietary((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
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
              {session.dayPart
                ? ` · ${dayPartLabel(session.dayPart)}`
                : ""}
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

      <main className="mx-auto max-w-3xl px-4 py-4 space-y-4 pb-40">
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
                <li key={it.id} className="flex justify-between gap-2 text-sm">
                  <span>
                    {it.qty}× {it.name}
                    {it.course != null ? (
                      <span className="text-[10px] text-stone-500 ms-1">
                        ({courseLabel(it.course)})
                      </span>
                    ) : null}
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
            {session.openOrder.payUrl ? (
              <a
                href={session.openOrder.payUrl}
                className="block w-full text-center rounded-xl bg-emerald-600 py-2.5 text-sm font-extrabold text-white"
              >
                {locale === "en" ? "Continue payment" : "متابعة الدفع"}
              </a>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex gap-1.5">
                  {["0", "1", "2", "5"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setPayTip(v === "0" ? "" : v)}
                      className={`flex-1 rounded-lg py-1.5 text-[11px] font-bold border ${
                        (payTip || "0") === v
                          ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                          : "border-white/10 text-stone-400"
                      }`}
                    >
                      {v === "0"
                        ? locale === "en"
                          ? "No tip"
                          : "بدون بقشيش"
                        : `+${v}`}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={paying || session.openOrder.items.length === 0}
                  onClick={() => void startPay()}
                  className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-extrabold text-white disabled:opacity-50"
                >
                  {paying
                    ? "…"
                    : locale === "en"
                      ? "Pay online"
                      : "ادفع أونلاين"}
                </button>
              </div>
            )}
          </section>
        ) : null}

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-stone-400">
            {locale === "en" ? "Hide items containing" : "أخفِ ما يحتوي"}
          </p>
          <div className="flex flex-wrap gap-1">
            {ALLERGEN_CODES.map((code) => {
              const on = hideAllergens.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleHide(code)}
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${
                    on
                      ? "border-rose-400/50 bg-rose-500/20 text-rose-100"
                      : "border-white/10 text-stone-500"
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold text-stone-400">
            {locale === "en" ? "Must include" : "يحتوي على"}
          </p>
          <div className="flex flex-wrap gap-1">
            {DIETARY_TAGS.map((code) => {
              const on = needDietary.includes(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => toggleDietaryNeed(code)}
                  className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold border ${
                    on
                      ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-100"
                      : "border-white/10 text-stone-500"
                  }`}
                >
                  {code}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {([0, 1, 2, 3] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCourse(c)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold border ${
                course === c
                  ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                  : "border-white/10 text-stone-400"
              }`}
            >
              {courseLabel(c)}
            </button>
          ))}
        </div>

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
                  onClick={() => openCompose(m)}
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
                        {(m.dietaryTags || []).length > 0
                          ? ` · ${(m.dietaryTags || []).slice(0, 3).join(", ")}`
                          : ""}
                        {(m.allergens || []).length > 0
                          ? ` · ${(m.allergens || []).slice(0, 2).join(", ")}`
                          : ""}
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

      {composeFor ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-3">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1a1614] p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-bold">
                  {locale === "en" && composeFor.nameEn
                    ? composeFor.nameEn
                    : composeFor.name}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">{courseLabel(course)}</p>
              </div>
              <button
                type="button"
                onClick={() => setComposeFor(null)}
                className="text-stone-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {modifiers.length > 0 ? (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-stone-400">
                  {locale === "en" ? "Modifiers" : "إضافات"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {modifiers.map((m) => {
                    const on = pickedMods.includes(m.id);
                    const label = locale === "en" && m.nameEn ? m.nameEn : m.name;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          setPickedMods((prev) =>
                            on
                              ? prev.filter((id) => id !== m.id)
                              : [...prev, m.id],
                          )
                        }
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold border ${
                          on
                            ? "border-amber-400/50 bg-amber-500/20 text-amber-100"
                            : "border-white/10 text-stone-400"
                        }`}
                      >
                        {label}
                        {Number(m.priceDelta) > 0
                          ? ` +${fmt(Number(m.priceDelta))}`
                          : ""}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
            <input
              value={lineNote}
              onChange={(e) => setLineNote(e.target.value)}
              placeholder={
                locale === "en" ? "Kitchen note…" : "ملاحظة للمطبخ…"
              }
              className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
            />
            <button
              type="button"
              onClick={confirmCompose}
              className="w-full rounded-xl bg-amber-500 py-2.5 text-sm font-extrabold text-[#14110f]"
            >
              {locale === "en" ? "Add to cart" : "أضف للسلة"}
            </button>
          </div>
        </div>
      ) : null}

      {cart.length > 0 ? (
        <div className="fixed bottom-0 inset-x-0 z-40 border-t border-amber-500/25 bg-[#1a1614]/98 backdrop-blur-xl">
          <div className="mx-auto max-w-3xl px-4 py-3 space-y-2">
            <ul className="max-h-28 overflow-y-auto space-y-1">
              {cart.map((l) => (
                <li
                  key={l.key}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate">
                    {l.name}
                    <span className="text-[10px] text-stone-500 ms-1">
                      ({courseLabel(l.course)})
                    </span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => bump(l.key, -1)}
                      className="w-7 h-7 rounded-md border border-white/15 grid place-items-center"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-5 text-center tabular-nums">{l.qty}</span>
                    <button
                      type="button"
                      onClick={() => bump(l.key, 1)}
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
