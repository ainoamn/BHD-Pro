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
  visits: { today: number; last7Days: number; uniqueIps7d: number };
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

  useEffect(() => {
    api.getAdminOverview().then((res) => setData(res.data as Overview));
  }, []);

  if (!data) {
    return <p className="text-sm text-slate-500">{t.loading}</p>;
  }

  const cards = [
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
      hint: `7d: ${data.visits.last7Days} · IP: ${data.visits.uniqueIps7d}`,
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
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {t.overview}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t.overviewHint}</p>
      </div>
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map((c) => (
          <Link
            key={c.label}
            href={c.href}
            className={`rounded-2xl border p-4 transition hover:border-teal-300 hover:shadow-sm ${
              c.alert
                ? "border-amber-300 bg-amber-50"
                : "border-slate-200 bg-white"
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
          <Link
            href="/admin/plans"
            className="text-xs font-bold text-teal-700 hover:underline"
          >
            {t.plans}
          </Link>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {data.subscriptions.byPlan.map((p) => (
            <div
              key={p.plan}
              className="rounded-xl bg-slate-50 p-3 flex justify-between"
            >
              <span className="font-semibold">
                {en ? p.nameEn : p.nameAr}
              </span>
              <span className="font-extrabold text-teal-800">{p.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
