"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  googleLinked: boolean;
  lastLoginAt: string | null;
  lastIp: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    plan: string;
    city: string | null;
    country: string;
  };
};

type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  googleLinked: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  company: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    country: string;
    plan: string;
    planExpiry: string | null;
    planStartedAt: string | null;
    usersLimit: number;
    invoicesLimit: number;
    isActive: boolean;
  };
  sessions: { id: string; ipAddress: string | null; userAgent: string | null; createdAt: string }[];
  auditLogs: { id: string; action: string; entity: string; ipAddress: string | null; createdAt: string }[];
  subscriptionPayments: {
    id: string;
    number: string;
    amount: string | number;
    currency: string;
    status: string;
    gatewaySlug: string | null;
    paidAt: string | null;
    createdAt: string;
    description: string;
  }[];
};

function fmt(d?: string | null, en?: boolean) {
  if (!d) return "—";
  return new Date(d).toLocaleString(en ? "en-GB" : "ar");
}

function UsersInner() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [detail, setDetail] = useState<UserDetail | null>(null);

  const load = async (query?: string) => {
    const res = await api.getAdminUsers(query);
    setRows(res.data as UserRow[]);
  };

  useEffect(() => {
    load(q || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: string) => {
    const res = await api.getAdminUser(id);
    setDetail(res.data as UserDetail);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.users}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.usersHint}</p>
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
            placeholder={t.search}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm w-full sm:w-56"
          />
          <button type="submit" className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-bold">
            {t.search}
          </button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-start p-3">{t.users}</th>
              <th className="text-start p-3">{t.company}</th>
              <th className="text-start p-3">{t.plan}</th>
              <th className="text-start p-3">{t.lastIp}</th>
              <th className="text-start p-3">{t.status}</th>
              <th className="text-start p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-bold">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                  <div className="text-[11px] text-slate-400">
                    {u.role} · {u.googleLinked ? "Google" : "password"}
                  </div>
                </td>
                <td className="p-3">
                  {u.company.name}
                  <div className="text-[11px] text-slate-400">
                    {[u.company.city, u.company.country].filter(Boolean).join(", ")}
                  </div>
                </td>
                <td className="p-3 font-semibold">{u.company.plan}</td>
                <td className="p-3 font-mono text-xs">{u.lastIp || "—"}</td>
                <td className="p-3">{u.isActive ? t.active : t.inactive}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => openDetail(u.id)}
                    className="text-xs font-bold text-teal-800 hover:underline"
                  >
                    {t.details}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setDetail(null)} />
          <div className="relative w-full sm:max-w-2xl bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">{detail.name}</h2>
                <p className="text-sm text-slate-500">{detail.email}</p>
              </div>
              <button
                type="button"
                className="text-xs font-bold border rounded-lg px-3 py-1.5"
                onClick={async () => {
                  await api.updateAdminUser(detail.id, { isActive: !detail.isActive });
                  await load(q);
                  await openDetail(detail.id);
                }}
              >
                {detail.isActive ? t.inactive : t.active}
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t.company}</p>
                <p className="font-bold">{detail.company.name}</p>
                <p className="text-xs text-slate-500 mt-1">{detail.company.email}</p>
                <p className="text-xs text-slate-500">{detail.company.phone || "—"}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs text-slate-500">{t.plan}</p>
                <p className="font-bold">{detail.company.plan}</p>
                <p className="text-xs mt-1">
                  {t.started}: {fmt(detail.company.planStartedAt, en)}
                </p>
                <p className="text-xs">
                  {t.expires}: {fmt(detail.company.planExpiry, en)}
                </p>
                <p className="text-xs">
                  {t.usersLimit}: {detail.company.usersLimit < 0 ? "∞" : detail.company.usersLimit}
                </p>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-2">{t.payments}</h3>
              <div className="space-y-2">
                {detail.subscriptionPayments.length === 0 && (
                  <p className="text-sm text-slate-500">{t.empty}</p>
                )}
                {detail.subscriptionPayments.map((p) => (
                  <div key={p.id} className="rounded-xl border border-slate-100 p-3 text-sm flex justify-between gap-3">
                    <div>
                      <p className="font-semibold">{p.number}</p>
                      <p className="text-xs text-slate-500">{p.description}</p>
                      <p className="text-[11px] text-slate-400">{fmt(p.paidAt || p.createdAt, en)}</p>
                    </div>
                    <div className="text-end">
                      <p className="font-bold">
                        {Number(p.amount).toFixed(3)} {p.currency}
                      </p>
                      <p className="text-xs">{p.status}</p>
                      <p className="text-[11px] text-slate-400">{p.gatewaySlug || "—"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-2">{t.sessions}</h3>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {detail.sessions.map((s) => (
                  <div key={s.id} className="text-xs flex justify-between gap-2 border-b border-slate-50 py-1.5">
                    <span className="font-mono">{s.ipAddress || "—"}</span>
                    <span className="text-slate-500">{fmt(s.createdAt, en)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">…</div>}>
      <UsersInner />
    </Suspense>
  );
}
