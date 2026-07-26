"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { GatewayLogo } from "@/components/admin/gateway-logo";
import { cn } from "@/lib/utils";

type Gateway = {
  slug: string;
  nameAr: string;
  nameEn: string;
  isEnabled: boolean;
  isTestMode: boolean;
  online?: boolean;
  hasCredentials?: boolean;
};

export default function AdminGatewaysPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [rows, setRows] = useState<Gateway[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await api.getAdminPaymentGateways();
      setRows(res.data as Gateway[]);
    } catch {
      setRows([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-950">
          {t.gateways}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Choose a gateway to configure credentials, enable it for subscription checkout."
            : "اختر بوابة لإعداد المفاتيح وتفعيلها لدفع الاشتراكات عند الترقية."}
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
          <p className="text-sm text-rose-700">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-bold"
          >
            {t.retry}
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-200/70 animate-pulse" />
          ))}
        </div>
      ) : !error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((g) => (
            <Link
              key={g.slug}
              href={`/admin/gateways/${g.slug}`}
              className={cn(
                "group relative flex flex-col items-center gap-4 rounded-2xl border-2 bg-white p-6 transition-all",
                "hover:border-teal-600 hover:shadow-lg hover:-translate-y-0.5",
                g.isEnabled ? "border-teal-500/40" : "border-slate-200 opacity-95",
              )}
            >
              <GatewayLogo slug={g.slug} size="lg" />
              <div className="text-center">
                <p className="font-bold text-lg text-slate-900">
                  {en ? g.nameEn : g.nameAr}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {g.isEnabled ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      {en ? "Enabled" : "مفعّلة"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {en ? "Disabled" : "معطّلة"}
                    </span>
                  )}
                  {g.isTestMode ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900">
                      {en ? "Test" : "تجريبي"}
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-900">
                      {en ? "Live" : "إنتاج"}
                    </span>
                  )}
                  {g.hasCredentials ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-800">
                      {en ? "Keys set" : "مفاتيح جاهزة"}
                    </span>
                  ) : null}
                </div>
              </div>
              <ChevronLeft className="absolute top-4 start-4 h-5 w-5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity rtl:rotate-180" />
            </Link>
          ))}
        </div>
      ) : null}

      {!loading && rows.length === 0 && !error ? (
        <p className="text-sm text-slate-500">{t.empty}</p>
      ) : null}
    </div>
  );
}
