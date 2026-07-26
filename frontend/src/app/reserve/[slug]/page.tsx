"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarDays, Loader2, CheckCircle2, XCircle } from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/backend-api" : "http://localhost:3001/api");

type BookingPage = {
  slug: string;
  company: {
    name: string;
    logo: string | null;
    currency: string;
    language: string;
    timezone: string;
  };
  rules: {
    maxParty: number;
    minParty: number;
    slotMinutes: number;
    horizonDays: number;
    openHour: number;
    closeHour: number;
    requirePhone: boolean;
  };
};

type Slot = { at: string; available: boolean };

export default function PublicReservePage() {
  const params = useParams();
  const slug = String(params?.slug || "");
  const [page, setPage] = useState<BookingPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locale, setLocale] = useState<"ar" | "en">("ar");
  const [guests, setGuests] = useState(2);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState(false);
  const [selectedAt, setSelectedAt] = useState<string | null>(null);
  const [guestName, setGuestName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{
    manageUrl: string;
    reservedAt: string;
    status: string;
    tableCode: string | null;
  } | null>(null);

  const ar = locale === "ar";

  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? navigator.language : "ar";
    setLocale(nav.toLowerCase().startsWith("en") ? "en" : "ar");
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setDate(tomorrow.toISOString().slice(0, 10));
  }, []);

  const loadPage = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/public/resto/book/${encodeURIComponent(slug)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error("missing");
      const data = (await res.json()) as BookingPage;
      setPage(data);
      if (data.company.language?.toLowerCase().startsWith("en")) {
        setLocale("en");
      } else if (data.company.language?.toLowerCase().startsWith("ar")) {
        setLocale("ar");
      }
      setGuests(Math.max(data.rules.minParty, 2));
    } catch {
      setPage(null);
      setError(
        ar
          ? "صفحة الحجز غير متاحة"
          : "This booking page is unavailable",
      );
    } finally {
      setLoading(false);
    }
  }, [slug, ar]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const loadSlots = useCallback(async () => {
    if (!slug || !date || !page) return;
    setSlotsLoading(true);
    setSlotsError(false);
    setSelectedAt(null);
    try {
      const res = await fetch(
        `${API}/public/resto/book/${encodeURIComponent(slug)}/availability?date=${encodeURIComponent(date)}&guests=${guests}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error("fail");
      const data = (await res.json()) as { slots: Slot[] };
      setSlots(data.slots || []);
    } catch {
      setSlots([]);
      setSlotsError(true);
    } finally {
      setSlotsLoading(false);
    }
  }, [slug, date, guests, page]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  const openSlots = useMemo(
    () => slots.filter((s) => s.available),
    [slots],
  );

  const dateOptions = useMemo(() => {
    const days = page?.rules.horizonDays || 14;
    const out: string[] = [];
    const start = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d.toISOString().slice(0, 10));
    }
    return out;
  }, [page?.rules.horizonDays]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAt || !guestName.trim() || !phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/public/resto/book/${encodeURIComponent(slug)}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            guestName: guestName.trim(),
            phone: phone.trim(),
            guests,
            reservedAt: selectedAt,
            notes: notes.trim() || undefined,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          typeof data?.message === "string"
            ? data.message
            : ar
              ? "تعذّر إتمام الحجز"
              : "Could not complete booking",
        );
      }
      setDone({
        manageUrl: data.manageUrl,
        reservedAt: data.reservation?.reservedAt || selectedAt,
        status: data.reservation?.status || "PENDING",
        tableCode: data.reservation?.tableCode || null,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : ar
            ? "تعذّر إتمام الحجز"
            : "Could not complete booking",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#14110f] text-stone-100 flex items-start justify-center p-4 py-10"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 15% 0%, rgba(245,158,11,0.14), transparent 48%), radial-gradient(ellipse at 90% 80%, rgba(90,60,30,0.25), transparent 40%)",
      }}
    >
      <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 space-y-5 shadow-2xl">
        {loading ? (
          <div className="flex justify-center py-20 text-stone-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : error && !page ? (
          <div className="text-center space-y-3 py-10">
            <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <p className="text-sm text-stone-300">{error}</p>
          </div>
        ) : done && page ? (
          <div className="text-center space-y-4 py-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-lg font-extrabold">{page.company.name}</p>
            <p className="text-sm text-stone-300">
              {ar ? "تم استلام حجزكم" : "Your reservation was received"}
            </p>
            <div className="rounded-2xl bg-black/25 border border-white/8 px-4 py-3 text-sm text-start space-y-1">
              <p>
                {new Date(done.reservedAt).toLocaleString(ar ? "ar" : "en-GB", {
                  dateStyle: "full",
                  timeStyle: "short",
                })}
              </p>
              <p>
                {guests} {ar ? "ضيوف" : "guests"}
                {done.tableCode
                  ? ` · ${ar ? "طاولة" : "Table"} ${done.tableCode}`
                  : ""}
              </p>
              <p className="text-amber-200 font-semibold">{done.status}</p>
            </div>
            <p className="text-xs text-stone-400">
              {ar
                ? "تحقق من واتساب/الرسائل لإدارة الحجز"
                : "Check WhatsApp/SMS for your manage link"}
            </p>
            <a
              href={done.manageUrl}
              className="inline-block rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-[#14110f]"
            >
              {ar ? "إدارة الحجز" : "Manage reservation"}
            </a>
          </div>
        ) : page ? (
          <>
            <div className="text-center space-y-2">
              {page.company.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={page.company.logo}
                  alt=""
                  className="h-14 w-14 rounded-full object-cover mx-auto border border-white/10"
                />
              ) : (
                <CalendarDays className="w-10 h-10 text-amber-400 mx-auto" />
              )}
              <h1 className="text-2xl font-extrabold tracking-tight">
                {page.company.name}
              </h1>
              <p className="text-sm text-stone-400">
                {ar ? "احجز طاولتك أونلاين" : "Reserve your table online"}
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-3">
              <label className="block space-y-1">
                <span className="text-[11px] text-stone-400">
                  {ar ? "عدد الضيوف" : "Guests"}
                </span>
                <input
                  type="number"
                  min={page.rules.minParty}
                  max={page.rules.maxParty}
                  value={guests}
                  onChange={(e) =>
                    setGuests(
                      Math.max(
                        page.rules.minParty,
                        Math.min(
                          page.rules.maxParty,
                          Number(e.target.value) || page.rules.minParty,
                        ),
                      ),
                    )
                  }
                  className="w-full h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-[11px] text-stone-400">
                  {ar ? "التاريخ" : "Date"}
                </span>
                <select
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
                >
                  {dateOptions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>

              <div className="space-y-2">
                <p className="text-[11px] text-stone-400">
                  {ar ? "الوقت المتاح" : "Available times"}
                </p>
                {slotsLoading ? (
                  <div className="flex justify-center py-6 text-stone-400">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                ) : slotsError ? (
                  <div className="space-y-2 py-3">
                    <p className="text-sm text-rose-300">
                      {ar ? "تعذر تحميل الأوقات" : "Could not load times"}
                    </p>
                    <button
                      type="button"
                      onClick={() => void loadSlots()}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-[#14110f]"
                    >
                      {ar ? "إعادة المحاولة" : "Retry"}
                    </button>
                  </div>
                ) : openSlots.length === 0 ? (
                  <p className="text-sm text-stone-500 py-3">
                    {ar
                      ? "لا توجد أوقات متاحة لهذا اليوم"
                      : "No open slots for this day"}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {openSlots.map((s) => {
                      const label = new Date(s.at).toLocaleTimeString(
                        ar ? "ar" : "en-GB",
                        { hour: "2-digit", minute: "2-digit" },
                      );
                      const active = selectedAt === s.at;
                      return (
                        <button
                          key={s.at}
                          type="button"
                          onClick={() => setSelectedAt(s.at)}
                          className={`rounded-xl px-3 py-2 text-xs font-bold tabular-nums ${
                            active
                              ? "bg-amber-500 text-[#14110f]"
                              : "border border-white/15 hover:bg-white/5"
                          }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <input
                required
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder={ar ? "اسم الضيف" : "Guest name"}
                className="w-full h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
              />
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={ar ? "رقم الجوال" : "Mobile phone"}
                className="w-full h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
                dir="ltr"
              />
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={ar ? "ملاحظات (اختياري)" : "Notes (optional)"}
                className="w-full h-11 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
              />

              {error ? (
                <p className="text-sm text-rose-300 text-center">{error}</p>
              ) : null}

              <button
                type="submit"
                disabled={busy || !selectedAt || !guestName.trim() || !phone.trim()}
                className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-[#14110f] disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                ) : ar ? (
                  "تأكيد الحجز"
                ) : (
                  "Book table"
                )}
              </button>
            </form>
          </>
        ) : null}
      </div>
    </div>
  );
}
