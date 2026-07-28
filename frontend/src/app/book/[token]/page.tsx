"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CalendarCheck, Loader2, XCircle } from "lucide-react";

const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/backend-api" : "http://localhost:3001/api");

type PublicReservation = {
  guestName: string;
  guests: number;
  reservedAt: string;
  status: string;
  notes: string | null;
  tableCode: string | null;
  company: { name: string; logo: string | null };
  canConfirm: boolean;
  canCancel: boolean;
};

export default function BookConfirmPage() {
  const params = useParams();
  const token = String(params?.token || "");
  const [row, setRow] = useState<PublicReservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [locale, setLocale] = useState<"ar" | "en">("ar");

  useEffect(() => {
    const nav = typeof navigator !== "undefined" ? navigator.language : "ar";
    setLocale(nav.toLowerCase().startsWith("en") ? "en" : "ar");
  }, []);

  const ar = locale === "ar";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/public/resto/reservations/${encodeURIComponent(token)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) throw new Error("not_found");
      const data = (await res.json()) as PublicReservation;
      setRow(data);
    } catch {
      setRow(null);
      setError(
        ar
          ? "رابط الحجز غير صالح أو منتهي"
          : "This reservation link is invalid or expired",
      );
    } finally {
      setLoading(false);
    }
  }, [token, ar]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (action: "confirm" | "cancel") => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch(
        `${API}/public/resto/reservations/${encodeURIComponent(token)}/${action}`,
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: "{}",
        },
      );
      if (!res.ok) throw new Error("fail");
      const data = (await res.json().catch(() => ({}))) as {
        companyNotify?: { status?: string; targets?: number };
      };
      const wa = data.companyNotify?.status;
      const base =
        action === "confirm"
          ? ar
            ? "تم تأكيد حجزكم. نتشرف بزيارتكم."
            : "Your reservation is confirmed. We look forward to seeing you."
          : ar
            ? "تم إلغاء الحجز."
            : "Your reservation has been cancelled.";
      const waNote =
        wa === "ok"
          ? ar
            ? " وأُبلغ المطعم عبر واتساب."
            : " The restaurant was notified on WhatsApp."
          : wa === "mock"
            ? ar
              ? " إشعار المطعم في وضع mock (لم يُسلَّم)."
              : " Restaurant notify is mock (not delivered)."
            : wa === "fail"
              ? ar
                ? " تعذّر إشعار المطعم عبر واتساب."
                : " Could not WhatsApp the restaurant."
              : ar
                ? " (لم يُرسل واتساب للمطعم — سيظهر في لوحة الحجوزات)."
                : " (No WhatsApp to restaurant — it will show on their bookings board).";
      setMessage(`${base}${waNote}`);
      await load();
    } catch {
      setError(ar ? "تعذّر إكمال الطلب" : "Could not complete the request");
    } finally {
      setBusy(false);
    }
  };

  const statusLabel = (s: string) => {
    const map: Record<string, string> = ar
      ? {
          PENDING: "بانتظار التأكيد",
          CONFIRMED: "مؤكد",
          SEATED: "جالس",
          CANCELLED: "ملغى",
          NO_SHOW: "لم يحضر",
        }
      : {
          PENDING: "Pending",
          CONFIRMED: "Confirmed",
          SEATED: "Seated",
          CANCELLED: "Cancelled",
          NO_SHOW: "No-show",
        };
    return map[s] || s;
  };

  return (
    <div
      dir={ar ? "rtl" : "ltr"}
      className="min-h-screen bg-[#14110f] text-stone-100 flex items-center justify-center p-4"
      style={{
        backgroundImage:
          "radial-gradient(ellipse at 20% 0%, rgba(245,158,11,0.12), transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(120,80,40,0.2), transparent 45%)",
      }}
    >
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.04] backdrop-blur-sm p-6 space-y-5 shadow-2xl">
        {loading ? (
          <div className="flex justify-center py-16 text-stone-400">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
        ) : error && !row ? (
          <div className="text-center space-y-3 py-8">
            <XCircle className="w-10 h-10 text-rose-400 mx-auto" />
            <p className="text-sm text-stone-300">{error}</p>
          </div>
        ) : row ? (
          <>
            <div className="text-center space-y-2">
              {row.company.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={row.company.logo}
                  alt=""
                  className="h-12 w-12 rounded-full object-cover mx-auto border border-white/10"
                />
              ) : (
                <CalendarCheck className="w-10 h-10 text-amber-400 mx-auto" />
              )}
              <p className="text-lg font-extrabold tracking-tight">
                {row.company.name}
              </p>
              <p className="text-xs text-stone-400">
                {ar ? "إدارة الحجز" : "Manage reservation"}
              </p>
            </div>

            <div className="rounded-2xl bg-black/25 border border-white/8 px-4 py-3 space-y-1.5 text-sm">
              <p>
                <span className="text-stone-500">
                  {ar ? "الضيف" : "Guest"}:{" "}
                </span>
                <span className="font-bold">{row.guestName}</span>
              </p>
              <p>
                <span className="text-stone-500">
                  {ar ? "الوقت" : "When"}:{" "}
                </span>
                {new Date(row.reservedAt).toLocaleString(ar ? "ar" : "en-GB", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
              <p>
                <span className="text-stone-500">
                  {ar ? "الضيوف" : "Guests"}:{" "}
                </span>
                {row.guests}
                {row.tableCode
                  ? ` · ${ar ? "طاولة" : "Table"} ${row.tableCode}`
                  : ""}
              </p>
              <p>
                <span className="text-stone-500">
                  {ar ? "الحالة" : "Status"}:{" "}
                </span>
                <span className="font-bold text-amber-200">
                  {statusLabel(row.status)}
                </span>
              </p>
              {row.notes ? (
                <p className="text-xs text-amber-100/70 pt-1">{row.notes}</p>
              ) : null}
            </div>

            {message ? (
              <p className="text-center text-sm text-emerald-300 font-semibold">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="text-center text-sm text-rose-300">{error}</p>
            ) : null}

            <div className="flex flex-col gap-2">
              {row.canConfirm ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("confirm")}
                  className="rounded-xl bg-amber-500 py-3 text-sm font-bold text-[#14110f] disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : ar ? (
                    "تأكيد الحجز"
                  ) : (
                    "Confirm reservation"
                  )}
                </button>
              ) : null}
              {row.canCancel ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act("cancel")}
                  className="rounded-xl border border-rose-500/40 text-rose-200 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {ar ? "إلغاء الحجز" : "Cancel reservation"}
                </button>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
