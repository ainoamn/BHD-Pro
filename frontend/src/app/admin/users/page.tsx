"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Row = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  googleLinked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  lastIp: string | null;
  lastUserAgent: string | null;
  sessionsCount: number;
  company: {
    id: string;
    name: string;
    plan: string;
    city: string | null;
    country: string;
  };
};

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (query?: string) => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers(query);
      setRows(res.data as Row[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">مستخدمو النظام</h2>
          <p className="text-sm text-slate-400">كل الحسابات عبر الشركات مع IP وآخر دخول</p>
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
                <th className="text-right p-3">المستخدم</th>
                <th className="text-right p-3">الشركة</th>
                <th className="text-right p-3">الموقع</th>
                <th className="text-right p-3">IP</th>
                <th className="text-right p-3">الدور</th>
                <th className="text-right p-3">الحالة</th>
                <th className="text-right p-3">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t border-slate-800 align-top">
                  <td className="p-3">
                    <div className="font-semibold">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                    <div className="text-[10px] text-slate-600 mt-1">
                      {u.googleLinked ? "Google" : "كلمة مرور"} · جلسات {u.sessionsCount}
                    </div>
                  </td>
                  <td className="p-3">
                    {u.company.name}
                    <div className="text-[10px] text-slate-500">{u.company.plan}</div>
                  </td>
                  <td className="p-3 text-slate-300">
                    {[u.company.city, u.company.country].filter(Boolean).join("، ")}
                  </td>
                  <td className="p-3 font-mono text-xs text-slate-400">
                    {u.lastIp || "—"}
                    <div className="text-[10px] text-slate-600 mt-1 max-w-[180px] truncate">
                      {u.lastUserAgent || ""}
                    </div>
                  </td>
                  <td className="p-3">{u.role}</td>
                  <td className="p-3">
                    <span className={u.isActive ? "text-emerald-400" : "text-amber-400"}>
                      {u.isActive ? "نشط" : "موقوف"}
                    </span>
                  </td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="text-xs rounded-md border border-slate-600 px-2 py-1 hover:bg-slate-800"
                      onClick={async () => {
                        await api.updateAdminUser(u.id, { isActive: !u.isActive });
                        await load(q);
                      }}
                    >
                      {u.isActive ? "إيقاف" : "تفعيل"}
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
