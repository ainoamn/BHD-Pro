"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

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
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [visits, setVisits] = useState<VisitsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);

  useEffect(() => {
    api.getAdminVisits(150).then((res) => setVisits(res.data as VisitsPayload));
    api
      .getAdminSessions(80)
      .then((res) => setSessions(res.data as SessionRow[]));
  }, []);

  if (!visits) {
    return <p className="text-sm text-slate-500">{t.loading}</p>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {t.visits}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Public site traffic and authenticated login sessions"
            : "تصفح الموقع + جلسات تسجيل الدخول للمستخدمين"}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-bold text-teal-950 mb-3">
            {en ? "Top pages" : "أكثر الصفحات"}
          </h3>
          {visits.byPath.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : (
            visits.byPath.map((p) => (
              <div
                key={p.path}
                className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"
              >
                <span className="font-mono text-xs truncate max-w-[70%] text-slate-600">
                  {p.path}
                </span>
                <span className="font-bold text-teal-800">{p.count}</span>
              </div>
            ))
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-bold text-teal-950 mb-3">
            {en ? "By country" : "حسب الدولة"}
          </h3>
          {visits.byCountry.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : (
            visits.byCountry.map((c) => (
              <div
                key={c.country}
                className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"
              >
                <span>{c.country}</span>
                <span className="font-bold text-teal-800">{c.count}</span>
              </div>
            ))
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="font-bold text-teal-950 mb-3">
            {en ? "By day" : "حسب اليوم"}
          </h3>
          {visits.byDay.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : (
            visits.byDay.slice(0, 14).map((d) => (
              <div
                key={d.day}
                className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0"
              >
                <span className="text-slate-600">{d.day}</span>
                <span className="font-bold text-teal-800">{d.count}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-teal-950">
            {en ? "Recent visits" : "أحدث الزيارات"}
          </h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-start p-3">{en ? "Path" : "المسار"}</th>
              <th className="text-start p-3">IP</th>
              <th className="text-start p-3">{t.location}</th>
              <th className="text-start p-3">{t.created}</th>
            </tr>
          </thead>
          <tbody>
            {visits.recent.slice(0, 40).map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs">{v.path}</td>
                <td className="p-3 text-xs">{v.ipAddress || "—"}</td>
                <td className="p-3 text-xs">
                  {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="p-3 text-xs text-slate-500">
                  {new Date(v.createdAt).toLocaleString(en ? "en-GB" : "ar")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-teal-950">{t.sessions}</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-start p-3">{t.users}</th>
              <th className="text-start p-3">{t.company}</th>
              <th className="text-start p-3">IP</th>
              <th className="text-start p-3">{t.created}</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-3">
                  <p className="font-semibold">{s.user.name}</p>
                  <p className="text-xs text-slate-500">{s.user.email}</p>
                </td>
                <td className="p-3 text-xs">{s.user.company.name}</td>
                <td className="p-3 text-xs">{s.ipAddress || "—"}</td>
                <td className="p-3 text-xs text-slate-500">
                  {new Date(s.createdAt).toLocaleString(en ? "en-GB" : "ar")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {sessions.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">{t.empty}</p>
        ) : null}
      </div>
    </div>
  );
}
