"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

type Overview = {
  companies: {
    total: number;
    active: number;
    posLinked?: number;
    restoLinked?: number;
  };
  users: {
    total: number;
    active: number;
    registeredThisMonth: number;
    avgPerCompany: number;
  };
  visits: {
    today: number;
    yesterday?: number;
    last7Days: number;
    uniqueIps7d: number;
    byCountry?: { country: string; count: number }[];
  };
  subscriptions: {
    revenueTotalOmr: number;
    revenueThisMonthOmr: number;
    pendingInvoices: number;
    byPlan: { plan: string; count: number; nameAr: string; nameEn: string }[];
  };
};

export default function AdminHomePage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    setError(null);
    api
      .getAdminOverview()
      .then((res) => setData(res.data as Overview))
      .catch((err: unknown) => {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 403) {
          setError(
            en
              ? "No permission for overview. If you are the owner, wait for API redeploy or clear site data and retry."
              : "لا صلاحية لعرض المؤشرات. إن كنت المالك، انتظر إعادة نشر الـ API أو امسح بيانات الموقع وأعد المحاولة.",
          );
        } else {
          setError(
            en
              ? "Could not load overview — API may be waking up. Retry shortly."
              : "تعذر تحميل المؤشرات — قد يكون الخادم يستيقظ. أعد المحاولة بعد لحظات.",
          );
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-slate-500">{t.loading}</p>
        <p className="text-xs text-slate-400">
          {en ? "Fetching platform metrics…" : "جاري جلب مؤشرات المنصة…"}
        </p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
        <p className="text-sm text-amber-900">{error}</p>
        <button
          type="button"
          onClick={load}
          className="text-sm font-bold text-teal-800 hover:underline"
        >
          {en ? "Retry" : "إعادة المحاولة"}
        </button>
      </div>
    );
  }

  if (!data) return null;

  const cards: {
    label: string;
    value: string | number;
    hint: string;
    href: string;
    alert?: boolean;
  }[] = [
    {
      label: t.tenants,
      value: data.companies.total,
      hint: `${t.active}: ${data.companies.active}`,
      href: "/admin/tenants",
    },
    {
      label: t.users,
      value: data.users.total,
      hint: `${t.active}: ${data.users.active} · +${data.users.registeredThisMonth}`,
      href: "/admin/users",
    },
    {
      label: t.visits,
      value: data.visits.today,
      hint: `${en ? "Yesterday" : "أمس"}: ${data.visits.yesterday ?? 0} · 7d: ${data.visits.last7Days} · IP: ${data.visits.uniqueIps7d}`,
      href: "/admin/visits",
    },
    {
      label: en ? "Revenue (OMR)" : "الإيرادات (ر.ع)",
      value: data.subscriptions.revenueTotalOmr.toFixed(3),
      hint: `${en ? "This month" : "هذا الشهر"}: ${data.subscriptions.revenueThisMonthOmr.toFixed(3)}`,
      href: "/admin/billing",
    },
    {
      label: en ? "Pending invoices" : "فواتير معلّقة",
      value: data.subscriptions.pendingInvoices,
      hint: t.billing,
      href: "/admin/billing?status=PENDING",
      alert: data.subscriptions.pendingInvoices > 0,
    },
    {
      label: t.posLinked,
      value: data.companies.posLinked ?? 0,
      hint: t.apps,
      href: "/admin/tenants",
    },
    {
      label: t.restoLinked,
      value: data.companies.restoLinked ?? 0,
      hint: t.apps,
      href: "/admin/tenants",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.overview}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.overviewHint}</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-2xl border p-4 transition hover:border-teal-300 hover:shadow-sm ${
              c.alert ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"
            }`}
          >
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-2xl font-extrabold mt-1 text-teal-900">{c.value}</p>
            <p className="text-[11px] text-slate-400 mt-1">{c.hint}</p>
          </Link>
        ))}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h2 className="font-bold">{t.plan}</h2>
          <Link href="/admin/plans" className="text-xs font-bold text-teal-700 hover:underline">
            {t.plans}
          </Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {data.subscriptions.byPlan.map((p) => (
            <div key={p.plan} className="rounded-xl bg-slate-50 p-3 flex justify-between">
              <span className="font-semibold">{en ? p.nameEn : p.nameAr}</span>
              <span className="font-extrabold text-teal-800">{p.count}</span>
            </div>
          ))}
        </div>
      </div>

      {data.visits.byCountry && data.visits.byCountry.length > 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-bold">
              {en ? "Visits by country (7d)" : "الزيارات حسب الدولة (7 أيام)"}
            </h2>
            <Link href="/admin/visits" className="text-xs font-bold text-teal-700 hover:underline">
              {t.visits}
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {data.visits.byCountry.map((c) => (
              <div
                key={c.country}
                className="rounded-xl bg-slate-50 px-3 py-2 flex justify-between gap-2 text-sm"
              >
                <span className="font-semibold text-slate-700">{c.country}</span>
                <span className="font-extrabold text-teal-800 tabular-nums">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
