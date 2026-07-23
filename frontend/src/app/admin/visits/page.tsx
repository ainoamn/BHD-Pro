"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type VisitsPayload = {
  recent: {
    id: string;
    path: string;
    ipAddress: string | null;
    country: string | null;
    city: string | null;
    userAgent: string | null;
    referrer: string | null;
    createdAt: string;
  }[];
  byPath: { path: string; count: number }[];
  byCountry: { country: string; count: number }[];
  byDay: { day: string; count: number }[];
};

type SessionRow = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user: {
    name: string;
    email: string;
    company: { name: string; city: string | null; country: string };
  };
};

export default function AdminVisitsPage() {
  const [visits, setVisits] = useState<VisitsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    api.getAdminVisits(150).then((res) => setVisits(res.data as VisitsPayload));
    api.getAdminSessions(80).then((res) => setSessions(res.data as SessionRow[]));
  }, []);

  if (!visits) {
    return (
      <div className="py-16 flex justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold">الزيارات والـ IP</h2>
        <p className="text-sm text-slate-400">تصفح الموقع + جلسات تسجيل الدخول للمستخدمين</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-3">أكثر الصفحات</h3>
          {visits.byPath.length === 0 ? (
            <p className="text-sm text-slate-500">لا بيانات بعد</p>
          ) : (
            visits.byPath.map((p) => (
              <div key={p.path} className="flex justify-between text-sm py-1 border-b border-slate-800">
                <span className="font-mono text-xs truncate max-w-[70%]">{p.path}</span>
                <span>{p.count}</span>
              </div>
            ))
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-3">حسب الدولة</h3>
          {visits.byCountry.length === 0 ? (
            <p className="text-sm text-slate-500">لا بيانات دولة بعد</p>
          ) : (
            visits.byCountry.map((c) => (
              <div key={c.country} className="flex justify-between text-sm py-1 border-b border-slate-800">
                <span>{c.country}</span>
                <span>{c.count}</span>
              </div>
            ))
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h3 className="font-semibold mb-3">آخر 14 يومًا</h3>
          {visits.byDay.length === 0 ? (
            <p className="text-sm text-slate-500">لا بيانات</p>
          ) : (
            visits.byDay.map((d) => (
              <div key={String(d.day)} className="flex justify-between text-sm py-1 border-b border-slate-800">
                <span>{new Date(d.day).toLocaleDateString("ar")}</span>
                <span>{d.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-x-auto">
        <h3 className="font-semibold p-4 border-b border-slate-800">آخر الزيارات</h3>
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs">
            <tr>
              <th className="text-right p-3">الوقت</th>
              <th className="text-right p-3">المسار</th>
              <th className="text-right p-3">IP</th>
              <th className="text-right p-3">الموقع</th>
              <th className="text-right p-3">المصدر</th>
            </tr>
          </thead>
          <tbody>
            {visits.recent.map((v) => (
              <tr key={v.id} className="border-t border-slate-800">
                <td className="p-3 text-xs text-slate-400">
                  {new Date(v.createdAt).toLocaleString("ar")}
                </td>
                <td className="p-3 font-mono text-xs">{v.path}</td>
                <td className="p-3 font-mono text-xs">{v.ipAddress || "—"}</td>
                <td className="p-3 text-xs">
                  {[v.city, v.country].filter(Boolean).join("، ") || "—"}
                </td>
                <td className="p-3 text-xs text-slate-500 truncate max-w-[200px]">
                  {v.referrer || "مباشر"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-x-auto">
        <h3 className="font-semibold p-4 border-b border-slate-800">جلسات تسجيل الدخول (IP)</h3>
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs">
            <tr>
              <th className="text-right p-3">الوقت</th>
              <th className="text-right p-3">المستخدم</th>
              <th className="text-right p-3">الشركة / الموقع</th>
              <th className="text-right p-3">IP</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-slate-800">
                <td className="p-3 text-xs text-slate-400">
                  {new Date(s.createdAt).toLocaleString("ar")}
                </td>
                <td className="p-3">
                  {s.user.name}
                  <div className="text-[10px] text-slate-500">{s.user.email}</div>
                </td>
                <td className="p-3 text-xs">
                  {s.user.company.name}
                  <div className="text-slate-500">
                    {[s.user.company.city, s.user.company.country].filter(Boolean).join("، ")}
                  </div>
                </td>
                <td className="p-3 font-mono text-xs">{s.ipAddress || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
