"use client";

import { useEffect, useMemo, useState } from "react";
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

function truncate(s: string | null | undefined, n: number) {
  if (!s) return "—";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function AdminVisitsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [visits, setVisits] = useState<VisitsPayload | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = () => {
    setLoading(true);
    setLoadError(false);
    Promise.all([
      api.getAdminVisits(150).then((res) => setVisits(res.data as VisitsPayload)),
      api.getAdminSessions(80).then((res) => setSessions(res.data as SessionRow[])),
    ])
      .catch(() => {
        setLoadError(true);
        setVisits(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const kpis = useMemo(() => {
    if (!visits) return null;
    const uniqueCountries = new Set(
      visits.byCountry.map((c) => c.country).filter(Boolean),
    ).size;
    const topPath = visits.byPath[0];
    return {
      recent: visits.recent.length,
      countries: uniqueCountries,
      topPath: topPath?.path || "—",
      topPathCount: topPath?.count ?? 0,
      sessions: sessions.length,
    };
  }, [visits, sessions]);

  const maxDay = useMemo(() => {
    if (!visits?.byDay.length) return 1;
    return Math.max(...visits.byDay.map((d) => d.count), 1);
  }, [visits]);

  if (loading) {
    return <p className="text-sm text-slate-500">{t.loading}</p>;
  }

  if (loadError || !visits || !kpis) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-rose-600">
          {en ? "Could not load visits" : "تعذر تحميل الزيارات"}
        </p>
        <button
          type="button"
          onClick={load}
          className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
        >
          {en ? "Retry" : "إعادة المحاولة"}
        </button>
      </div>
    );
  }

  const dayBars = [...visits.byDay].slice(0, 14).reverse();

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

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          {
            label: en ? "Recent visits" : "زيارات حديثة",
            value: kpis.recent,
            hint: en ? "Loaded sample" : "عينة محمّلة",
          },
          {
            label: en ? "Countries" : "الدول",
            value: kpis.countries,
            hint: en ? "Unique in breakdown" : "فريدة في التوزيع",
          },
          {
            label: en ? "Top path" : "أكثر مسار",
            value: kpis.topPathCount,
            hint: truncate(kpis.topPath, 28),
          },
          {
            label: t.sessions,
            value: kpis.sessions,
            hint: en ? "Recent logins" : "أحدث تسجيلات الدخول",
          },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs text-slate-500">{c.label}</p>
            <p className="text-2xl font-extrabold mt-1 text-teal-900 tabular-nums">
              {c.value}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 truncate" title={c.hint}>
              {c.hint}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="font-bold text-teal-950 mb-4">
          {en ? "Visits by day" : "الزيارات حسب اليوم"}
        </h3>
        {dayBars.length === 0 ? (
          <p className="text-sm text-slate-500">{t.empty}</p>
        ) : (
          <div className="space-y-2.5">
            {dayBars.map((d) => (
              <div key={d.day} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 text-xs text-slate-500 tabular-nums">
                  {d.day}
                </span>
                <div className="flex-1 h-7 rounded-lg bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-lg bg-teal-600/85 min-w-[2px] transition-all"
                    style={{ width: `${Math.max(4, (d.count / maxDay) * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-end font-bold text-teal-900 tabular-nums text-xs">
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
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
                className="flex justify-between text-sm py-1.5 border-b border-slate-100 last:border-0 gap-2"
              >
                <span className="font-mono text-xs truncate text-slate-600">
                  {p.path}
                </span>
                <span className="font-bold text-teal-800 shrink-0">{p.count}</span>
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
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-teal-950">
            {en ? "Recent visits" : "أحدث الزيارات"}
          </h3>
        </div>
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-start p-3">{en ? "Path" : "المسار"}</th>
              <th className="text-start p-3">IP</th>
              <th className="text-start p-3">{t.location}</th>
              <th className="text-start p-3">{en ? "Referrer" : "المصدر"}</th>
              <th className="text-start p-3">UA</th>
              <th className="text-start p-3">{t.created}</th>
            </tr>
          </thead>
          <tbody>
            {visits.recent.slice(0, 40).map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs">{v.path}</td>
                <td className="p-3 text-xs font-mono" dir="ltr">
                  {v.ipAddress || "—"}
                </td>
                <td className="p-3 text-xs">
                  {[v.city, v.country].filter(Boolean).join(", ") || "—"}
                </td>
                <td className="p-3 text-xs text-slate-500 max-w-[140px] truncate" title={v.referrer || ""}>
                  {truncate(v.referrer, 40)}
                </td>
                <td className="p-3 text-[10px] text-slate-400 max-w-[160px] truncate" title={v.userAgent || ""}>
                  {truncate(v.userAgent, 48)}
                </td>
                <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
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
        <table className="w-full text-sm min-w-[640px]">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-start p-3">{t.users}</th>
              <th className="text-start p-3">{t.company}</th>
              <th className="text-start p-3">IP</th>
              <th className="text-start p-3">UA</th>
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
                <td className="p-3 text-xs font-mono" dir="ltr">
                  {s.ipAddress || "—"}
                </td>
                <td
                  className="p-3 text-[10px] text-slate-400 max-w-[180px] truncate"
                  title={s.userAgent || ""}
                >
                  {truncate(s.userAgent, 48)}
                </td>
                <td className="p-3 text-xs text-slate-500 whitespace-nowrap">
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
