"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

type Tenant = {
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
  usersLimitOverride: number | null;
  invoicesLimitOverride: number | null;
  isActive: boolean;
  usersCount: number;
  invoicesCount: number;
  createdAt: string;
};

function fmt(d?: string | null, en?: boolean) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(en ? "en-GB" : "ar");
}

export default function AdminTenantsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [rows, setRows] = useState<Tenant[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [usersLimit, setUsersLimit] = useState("");
  const [invoicesLimit, setInvoicesLimit] = useState("");
  const [planExpiry, setPlanExpiry] = useState("");
  const [plan, setPlan] = useState("STARTER");
  const [saving, setSaving] = useState(false);

  const load = async (query?: string) => {
    const res = await api.getAdminTenants({ q: query || undefined });
    setRows(res.data as Tenant[]);
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (row: Tenant) => {
    setSelected(row);
    setPlan(row.plan);
    setUsersLimit(
      row.usersLimitOverride != null
        ? String(row.usersLimitOverride)
        : String(row.usersLimit)
    );
    setInvoicesLimit(
      row.invoicesLimitOverride != null
        ? String(row.invoicesLimitOverride)
        : String(row.invoicesLimit)
    );
    setPlanExpiry(row.planExpiry ? row.planExpiry.slice(0, 10) : "");
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const ul = usersLimit.trim() === "" ? null : Number(usersLimit);
      const il = invoicesLimit.trim() === "" ? null : Number(invoicesLimit);
      await api.updateAdminTenant(selected.id, {
        plan,
        planExpiry: planExpiry || null,
        usersLimitOverride: Number.isFinite(ul as number) ? ul : null,
        invoicesLimitOverride: Number.isFinite(il as number) ? il : null,
      });
      await load(q);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.tenants}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.tenantsHint}</p>
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
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-start p-3">{t.company}</th>
              <th className="text-start p-3">{t.plan}</th>
              <th className="text-start p-3">{t.started}</th>
              <th className="text-start p-3">{t.expires}</th>
              <th className="text-start p-3">{t.usersLimit}</th>
              <th className="text-start p-3">{t.status}</th>
              <th className="text-start p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="p-3">
                  <div className="font-bold">{row.name}</div>
                  <div className="text-xs text-slate-500">{row.email || "—"}</div>
                  <div className="text-[11px] text-slate-400">
                    {row.usersCount} users · {row.invoicesCount} invoices
                  </div>
                </td>
                <td className="p-3 font-semibold">{row.plan}</td>
                <td className="p-3 text-xs">{fmt(row.planStartedAt || row.createdAt, en)}</td>
                <td className="p-3 text-xs">{fmt(row.planExpiry, en)}</td>
                <td className="p-3">
                  {row.usersCount}/{row.usersLimit < 0 ? "∞" : row.usersLimit}
                </td>
                <td className="p-3">
                  <span className={row.isActive ? "text-teal-700" : "text-amber-700"}>
                    {row.isActive ? t.active : t.inactive}
                  </span>
                </td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="text-xs font-bold text-teal-800 hover:underline"
                  >
                    {t.details}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-slate-500 text-sm">{t.empty}</p>}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setSelected(null)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-extrabold">{selected.name}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-xs space-y-1">
                <span className="text-slate-500">{t.plan}</span>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="STARTER">STARTER</option>
                  <option value="PROFESSIONAL">PROFESSIONAL</option>
                  <option value="ENTERPRISE">ENTERPRISE</option>
                </select>
              </label>
              <label className="text-xs space-y-1">
                <span className="text-slate-500">{t.expires}</span>
                <input
                  type="date"
                  value={planExpiry}
                  onChange={(e) => setPlanExpiry(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-slate-500">{t.usersLimit} (-1 = ∞)</span>
                <input
                  value={usersLimit}
                  onChange={(e) => setUsersLimit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs space-y-1">
                <span className="text-slate-500">{t.invoicesLimit} (-1 = ∞)</span>
                <input
                  value={invoicesLimit}
                  onChange={(e) => setInvoicesLimit(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="flex-1 rounded-xl bg-teal-700 text-white py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {t.save}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await api.updateAdminTenant(selected.id, { isActive: !selected.isActive });
                  await load(q);
                  setSelected(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold"
              >
                {selected.isActive ? t.inactive : t.active}
              </button>
            </div>
            <Link href={`/admin/users?q=${encodeURIComponent(selected.email || selected.name)}`} className="block text-center text-sm text-teal-800 font-semibold">
              {t.users}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
