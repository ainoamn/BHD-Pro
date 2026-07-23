"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Tenant = {
  id: string;
  name: string;
  email: string | null;
  city: string | null;
  country: string;
  plan: string;
  planExpiry: string | null;
  isActive: boolean;
  createdAt: string;
  usersCount: number;
  invoicesCount: number;
  sampleUsers: {
    email: string;
    lastIp: string | null;
    lastLoginAt: string | null;
  }[];
};

export default function AdminTenantsPage() {
  const [rows, setRows] = useState<Tenant[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (query?: string) => {
    setLoading(true);
    try {
      const res = await api.getAdminTenants({ q: query || undefined });
      setRows(res.data as Tenant[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleActive = async (t: Tenant) => {
    await api.updateAdminTenant(t.id, { isActive: !t.isActive });
    await load(q);
  };

  const setPlan = async (t: Tenant, plan: string) => {
    await api.updateAdminTenant(t.id, { plan });
    await load(q);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">الشركات (المستأجرون)</h2>
          <p className="text-sm text-slate-400">تفعيل/إيقاف، تغيير الباقة، وموقع الشركة</p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            load(q);
          }}
        >
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm w-56"
          />
          <button type="submit" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold">
            بحث
          </button>
        </form>
      </div>

      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-900 text-slate-400 text-xs">
              <tr>
                <th className="text-right p-3">الشركة</th>
                <th className="text-right p-3">الموقع</th>
                <th className="text-right p-3">الباقة</th>
                <th className="text-right p-3">مستخدمون</th>
                <th className="text-right p-3">آخر IP</th>
                <th className="text-right p-3">الحالة</th>
                <th className="text-right p-3">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-t border-slate-800">
                  <td className="p-3">
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.email || "—"}</div>
                  </td>
                  <td className="p-3 text-slate-300">
                    {[t.city, t.country].filter(Boolean).join("، ") || "—"}
                  </td>
                  <td className="p-3">
                    <select
                      value={t.plan}
                      onChange={(e) => setPlan(t, e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs"
                    >
                      <option value="STARTER">STARTER</option>
                      <option value="PROFESSIONAL">PROFESSIONAL</option>
                      <option value="ENTERPRISE">ENTERPRISE</option>
                    </select>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {t.planExpiry ? new Date(t.planExpiry).toLocaleDateString("ar") : "بدون انتهاء"}
                    </div>
                  </td>
                  <td className="p-3">
                    {t.usersCount}
                    <span className="text-slate-500 text-xs"> / فواتير {t.invoicesCount}</span>
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-400">
                    {t.sampleUsers[0]?.lastIp || "—"}
                  </td>
                  <td className="p-3">
                    <span
                      className={
                        t.isActive ? "text-emerald-400" : "text-amber-400"
                      }
                    >
                      {t.isActive ? "نشطة" : "موقوفة"}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => toggleActive(t)}
                      className="text-xs rounded-md border border-slate-600 px-2 py-1 hover:bg-slate-800"
                    >
                      {t.isActive ? "إيقاف" : "تفعيل"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
