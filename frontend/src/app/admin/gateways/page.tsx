"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

type Gateway = {
  slug: string;
  nameAr: string;
  nameEn: string;
  isEnabled: boolean;
  isTestMode: boolean;
  configJson?: Record<string, string>;
};

export default function AdminGatewaysPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [rows, setRows] = useState<Gateway[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.getAdminPaymentGateways();
      setRows(res.data as Gateway[]);
      setError(null);
    } catch {
      setError(
        en
          ? "Could not load gateways — ensure platform admin access."
          : "تعذر تحميل بوابات الدفع — تأكد أن حسابك مشرف منصة.",
      );
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const patch = async (
    slug: string,
    data: { isEnabled?: boolean; isTestMode?: boolean },
  ) => {
    setBusy(slug);
    try {
      await api.updateAdminPaymentGateway(slug, data);
      await load();
    } catch {
      setError(en ? "Update failed" : "تعذر التحديث");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {t.gateways}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Enable Stripe / Thawani / PayPal for platform subscriptions"
            : "تفعيل Stripe / Thawani / PayPal لاشتراكات المنصة"}
        </p>
      </div>
      {error ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          {error}
        </p>
      ) : null}
      <div className="space-y-3">
        {rows.map((g) => (
          <div
            key={g.slug}
            className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="font-bold text-teal-950">
                {en ? g.nameEn : g.nameAr}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {g.slug} ·{" "}
                {g.isTestMode
                  ? en
                    ? "Test mode"
                    : "وضع تجريبي"
                  : en
                    ? "Live"
                    : "إنتاج"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === g.slug}
                className={`rounded-xl px-3 py-1.5 text-sm font-bold disabled:opacity-50 ${
                  g.isTestMode
                    ? "bg-amber-100 text-amber-900 border border-amber-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200"
                }`}
                onClick={() =>
                  void patch(g.slug, { isTestMode: !g.isTestMode })
                }
              >
                {g.isTestMode
                  ? en
                    ? "Test"
                    : "تجريبي"
                  : en
                    ? "Live"
                    : "إنتاج"}
              </button>
              <button
                type="button"
                disabled={busy === g.slug}
                className={`rounded-xl px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50 ${
                  g.isEnabled ? "bg-emerald-600" : "bg-slate-400"
                }`}
                onClick={() => void patch(g.slug, { isEnabled: !g.isEnabled })}
              >
                {g.isEnabled ? t.active : t.inactive}
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && !error ? (
          <p className="text-sm text-slate-500">{t.empty}</p>
        ) : null}
      </div>
    </div>
  );
}
