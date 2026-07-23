"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Overview = {
  companies: { total: number; active: number };
  users: {
    total: number;
    active: number;
    registeredThisMonth: number;
    avgPerCompany: number;
  };
  visits: {
    today: number;
    last7Days: number;
    uniqueIps7d: number;
    byCountry: { country: string; count: number }[];
  };
  subscriptions: {
    byPlan: { plan: string; count: number; nameAr: string; monthlyPrice: number }[];
    revenueTotalOmr: number;
    paidInvoices: number;
    pendingInvoices: number;
    revenueThisMonthOmr: number;
    paidThisMonth: number;
  };
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1 text-slate-50">{value}</p>
      {hint ? <p className="text-[11px] text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

export default function AdminHomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getAdminOverview()
      .then((res) => setData(res.data as Overview))
      .catch(() => setError("تعذر تحميل المؤشرات"));
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold">لوحة مؤشرات المنصة</h2>
        <p className="text-sm text-slate-400 mt-1">
          نظرة شاملة على الشركات والمستخدمين والاشتراكات والزيارات
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="الشركات" value={data.companies.total} hint={`نشطة: ${data.companies.active}`} />
        <Stat
          label="المستخدمون"
          value={data.users.total}
          hint={`نشطون: ${data.users.active} · مسجلون هذا الشهر: ${data.users.registeredThisMonth}`}
        />
        <Stat
          label="زيارات اليوم"
          value={data.visits.today}
          hint={`7 أيام: ${data.visits.last7Days} · IP فريد: ${data.visits.uniqueIps7d}`}
        />
        <Stat
          label="إيراد الاشتراكات (ر.ع)"
          value={data.subscriptions.revenueTotalOmr.toFixed(3)}
          hint={`هذا الشهر: ${data.subscriptions.revenueThisMonthOmr.toFixed(3)} · معلّق: ${data.subscriptions.pendingInvoices}`}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-3">توزيع الباقات</h3>
          <div className="space-y-2">
            {data.subscriptions.byPlan.map((p) => (
              <div key={p.plan} className="flex justify-between text-sm border-b border-slate-800 pb-2">
                <span>
                  {p.nameAr} <span className="text-slate-500">({p.plan})</span>
                </span>
                <span className="font-bold">{p.count}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">
            متوسط المستخدمين لكل شركة: {data.users.avgPerCompany}
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-3">الزيارات حسب الدولة (7 أيام)</h3>
          {data.visits.byCountry.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد بيانات زيارات بعد — ستظهر بعد تصفح الموقع.</p>
          ) : (
            <div className="space-y-2">
              {data.visits.byCountry.map((c) => (
                <div key={c.country} className="flex justify-between text-sm">
                  <span>{c.country}</span>
                  <span className="font-bold">{c.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
