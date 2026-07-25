"use client";

import { FormEvent, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

const API_PUBLIC_ORIGIN = (
  process.env.NEXT_PUBLIC_API_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/api\/?$/, "") ||
  "https://hisaby-api.onrender.com"
).replace(/\/$/, "");

export default function DisputePage({ params }: { params: { code: string } }) {
  const code = params.code;
  const [reason, setReason] = useState("");
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 5) {
      setError("يرجى كتابة سبب البلاغ (٥ أحرف على الأقل) / Please enter a reason (min 5 characters)");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_PUBLIC_ORIGIN}/api/public/documents/c/${encodeURIComponent(code)}/dispute`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            reason: reason.trim(),
            reporterName: reporterName.trim() || undefined,
            reporterPhone: reporterPhone.trim() || undefined,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        invoiceNumber?: string;
        message?: string | string[];
      };
      if (!res.ok) {
        const msg = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message || "Submit failed";
        throw new Error(msg);
      }
      setInvoiceNumber(data.invoiceNumber || null);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white px-4 py-10">
      <div className="mx-auto w-full max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <ShieldAlert className="w-8 h-8 text-amber-400 shrink-0" />
          <div>
            <h1 className="text-xl font-bold">بلاغ معاملة مشبوهة</h1>
            <p className="text-sm text-slate-400">Report a suspicious transaction</p>
          </div>
        </div>

        {done ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2">
            <p className="font-semibold text-emerald-200">تم استلام البلاغ</p>
            <p className="text-sm text-slate-300">
              Your report was submitted
              {invoiceNumber ? ` (invoice ${invoiceNumber})` : ""}. The merchant will be notified.
            </p>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 space-y-4"
          >
            <p className="text-sm text-slate-400">
              Document code: <span className="text-slate-200 font-mono">{code}</span>
            </p>
            <label className="block space-y-1">
              <span className="text-sm text-slate-300">السبب / Reason *</span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                required
                minLength={5}
                className="w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-amber-400/50"
                placeholder="وصف المشكلة…"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-slate-300">اسمك / Your name (optional)</span>
              <input
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm text-white"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm text-slate-300">هاتفك / Phone (optional)</span>
              <input
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                inputMode="tel"
                className="w-full h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm text-white"
              />
            </label>
            {error ? <p className="text-sm text-rose-300">{error}</p> : null}
            <button
              type="submit"
              disabled={submitting || reason.trim().length < 5}
              className="w-full h-11 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-40 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              إرسال البلاغ / Submit
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
