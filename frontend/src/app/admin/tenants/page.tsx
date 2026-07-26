"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";

type Staff = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive?: boolean;
  lastLoginAt?: string | null;
  lastIp?: string | null;
};

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
  permanentDiscountPct?: number;
  permanentDiscountNote?: string | null;
  isActive: boolean;
  usersCount: number;
  activeUsersCount?: number;
  invoicesCount: number;
  createdAt: string;
  posLinked?: boolean;
  restoLinked?: boolean;
  sampleUsers?: Staff[];
};

function fmt(d?: string | null, en?: boolean) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(en ? "en-GB" : "ar");
}

function daysRemaining(planExpiry?: string | null) {
  if (!planExpiry) return null;
  const end = new Date(planExpiry);
  if (Number.isNaN(end.getTime())) return null;
  const ms = end.getTime() - Date.now();
  return Math.ceil(ms / (24 * 60 * 60 * 1000));
}

type TenantDetail = Tenant & {
  users?: Staff[];
  billingInvoices?: Array<{
    id: string;
    number?: string;
    status: string;
    amount?: number | string;
    createdAt: string;
  }>;
};

export default function AdminTenantsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [rows, setRows] = useState<Tenant[]>([]);
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Tenant | null>(null);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [usersLimit, setUsersLimit] = useState("");
  const [invoicesLimit, setInvoicesLimit] = useState("");
  const [planExpiry, setPlanExpiry] = useState("");
  const [plan, setPlan] = useState("STARTER");
  const [discountPct, setDiscountPct] = useState("0");
  const [discountNote, setDiscountNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = async (query?: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.getAdminTenants({ q: query || undefined });
      setRows(res.data as Tenant[]);
    } catch {
      setLoadError(true);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openEdit = async (row: Tenant) => {
    setSelected(row);
    setDetail(null);
    setPlan(row.plan);
    setUsersLimit(
      row.usersLimitOverride != null
        ? String(row.usersLimitOverride)
        : String(row.usersLimit),
    );
    setInvoicesLimit(
      row.invoicesLimitOverride != null
        ? String(row.invoicesLimitOverride)
        : String(row.invoicesLimit),
    );
    setPlanExpiry(row.planExpiry ? row.planExpiry.slice(0, 10) : "");
    setDiscountPct(String(row.permanentDiscountPct ?? 0));
    setDiscountNote(row.permanentDiscountNote || "");
    try {
      const res = await api.getAdminTenant(row.id);
      const d = res.data as TenantDetail;
      setDetail(d);
      if (d.permanentDiscountPct != null) setDiscountPct(String(d.permanentDiscountPct));
      if (d.permanentDiscountNote != null) setDiscountNote(d.permanentDiscountNote || "");
    } catch {
      setDetail(null);
    }
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const ul = usersLimit.trim() === "" ? null : Number(usersLimit);
      const il = invoicesLimit.trim() === "" ? null : Number(invoicesLimit);
      const pct = Number(discountPct);
      await api.updateAdminTenant(selected.id, {
        plan,
        planExpiry: planExpiry || null,
        usersLimitOverride: Number.isFinite(ul as number) ? ul : null,
        invoicesLimitOverride: Number.isFinite(il as number) ? il : null,
        permanentDiscountPct: Number.isFinite(pct) ? pct : 0,
        permanentDiscountNote: discountNote.trim() || null,
      });
      await load(q);
      setSelected(null);
    } finally {
      setSaving(false);
    }
  };

  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      ADMIN: en ? "Admin" : "مدير",
      MANAGER: en ? "Manager" : "مشرف",
      ACCOUNTANT: en ? "Accountant" : "محاسب",
      CASHIER: en ? "Cashier" : "كاشير",
      WAITER: en ? "Waiter" : "نادل",
      KITCHEN: en ? "Kitchen" : "مطبخ",
      RESTO_MANAGER: en ? "Resto mgr" : "مدير مطعم",
      VIEWER: en ? "Viewer" : "عرض",
    };
    return map[role] || role;
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

      <div className="space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500 py-8 text-center">{t.loading}</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center space-y-3">
            <p className="text-sm text-rose-700">
              {en ? "Could not load tenants" : "تعذر تحميل الشركات"}
            </p>
            <button
              type="button"
              onClick={() => void load(q)}
              className="rounded-xl bg-teal-700 text-white px-4 py-2 text-sm font-bold"
            >
              {en ? "Retry" : "إعادة المحاولة"}
            </button>
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">{t.empty}</p>
        ) : (
        rows.map((row) => {
          const staff = row.sampleUsers || [];
          const activeCount = row.activeUsersCount ?? staff.filter((u) => u.isActive !== false).length;
          const open = !!expanded[row.id];
          const days = daysRemaining(row.planExpiry);
          const lastIp = staff[0]?.lastIp || null;
          const location = [row.city, row.country].filter(Boolean).join(", ") || "—";
          return (
            <div
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white overflow-hidden"
            >
              <div className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-start gap-4 justify-between">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-extrabold text-teal-950 text-lg truncate">{row.name}</h2>
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        row.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900",
                      )}
                    >
                      {row.isActive ? t.active : t.inactive}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {row.plan}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500" dir="ltr">
                    {row.email || "—"}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                  <p className="text-xs text-slate-500">
                    {t.location}: {location}
                    {lastIp ? (
                      <span className="ms-2 font-mono text-[10px]" dir="ltr">
                        · {t.lastIp} {lastIp}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-slate-500">
                    {en ? "Started" : "البداية"}: {fmt(row.planStartedAt || row.createdAt, en)} ·{" "}
                    {en ? "Expires" : "الانتهاء"}: {fmt(row.planExpiry, en)}
                    {days != null ? (
                      <span
                        className={cn(
                          "ms-1 font-bold",
                          days < 0
                            ? "text-rose-700"
                            : days <= 7
                              ? "text-amber-700"
                              : "text-teal-800",
                        )}
                      >
                        (
                        {days < 0
                          ? en
                            ? `${Math.abs(days)}d overdue`
                            : `متأخر ${Math.abs(days)} يوم`
                          : en
                            ? `${days}d left`
                            : `${days} يوم متبقي`}
                        )
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm font-semibold text-teal-900 mt-2">
                    {en ? "Authorized staff" : "الموظفون المخوّلون"}:{" "}
                    <span className="tabular-nums">
                      {activeCount}/{row.usersCount}
                    </span>
                    <span className="text-slate-500 font-normal text-xs ms-1">
                      ({en ? "active / total" : "نشط / الإجمالي"} · {en ? "limit" : "الحد"}{" "}
                      {row.usersLimit < 0 ? "∞" : row.usersLimit})
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((e) => ({ ...e, [row.id]: !e[row.id] }))
                    }
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    {open
                      ? en
                        ? "Hide staff"
                        : "إخفاء الموظفين"
                      : en
                        ? "Show staff"
                        : "عرض الموظفين"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void openEdit(row)}
                    className="rounded-xl bg-teal-700 text-white px-3 py-2 text-xs font-bold"
                  >
                    {t.details}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/80 px-4 sm:px-5 py-3">
                {staff.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    {en ? "No employees yet" : "لا يوجد موظفون بعد"}
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs min-w-[520px]">
                      <thead className="text-slate-500">
                        <tr>
                          <th className="text-start py-1.5 font-semibold">
                            {en ? "Name" : "الاسم"}
                          </th>
                          <th className="text-start py-1.5 font-semibold">
                            {en ? "Email" : "البريد"}
                          </th>
                          <th className="text-start py-1.5 font-semibold">
                            {en ? "Role" : "الدور"}
                          </th>
                          <th className="text-start py-1.5 font-semibold">
                            {en ? "Status" : "الحالة"}
                          </th>
                          <th className="text-start py-1.5 font-semibold">
                            {en ? "Last login" : "آخر دخول"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {(open ? staff : staff.slice(0, 4)).map((u) => (
                          <tr key={u.id} className="border-t border-slate-200/70">
                            <td className="py-2 font-semibold text-slate-800">{u.name}</td>
                            <td className="py-2 text-slate-600 font-mono" dir="ltr">
                              {u.email}
                            </td>
                            <td className="py-2">{roleLabel(u.role)}</td>
                            <td className="py-2">
                              <span
                                className={
                                  u.isActive === false
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                }
                              >
                                {u.isActive === false ? t.inactive : t.active}
                              </span>
                            </td>
                            <td className="py-2 text-slate-500">
                              {fmt(u.lastLoginAt, en)}
                              {u.lastIp ? (
                                <span className="ms-1 font-mono text-[10px]" dir="ltr">
                                  · {u.lastIp}
                                </span>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!open && staff.length > 4 ? (
                      <button
                        type="button"
                        onClick={() => setExpanded((e) => ({ ...e, [row.id]: true }))}
                        className="mt-2 text-[11px] font-bold text-teal-800 hover:underline"
                      >
                        {en
                          ? `Show all ${staff.length} employees`
                          : `عرض كل الموظفين (${staff.length})`}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          );
        })
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setSelected(null)}
          />
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
              <label className="text-xs space-y-1">
                <span className="text-slate-500">{t.permanentDiscount}</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.01}
                  value={discountPct}
                  onChange={(e) => setDiscountPct(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs space-y-1 sm:col-span-2">
                <span className="text-slate-500">{t.permanentDiscountNote}</span>
                <input
                  value={discountNote}
                  onChange={(e) => setDiscountNote(e.target.value)}
                  placeholder={en ? "Family / early / staff…" : "عائلة / مشترك أول / شركتي…"}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="flex-1 rounded-xl bg-teal-700 text-white py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {t.save}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await api.updateAdminTenant(selected.id, {
                    isActive: !selected.isActive,
                  });
                  await load(q);
                  setSelected(null);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold"
              >
                {selected.isActive ? t.inactive : t.active}
              </button>
            </div>

            {(detail?.users || selected.sampleUsers || []).length > 0 ? (
              <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-bold text-slate-500">
                  {t.users} ({(detail?.users || selected.sampleUsers || []).length})
                </p>
                {(detail?.users || selected.sampleUsers || []).map((u) => (
                  <div key={u.id} className="flex justify-between text-xs gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{u.name}</p>
                      <p className="text-slate-500 font-mono truncate" dir="ltr">
                        {u.email}
                      </p>
                    </div>
                    <div className="text-end shrink-0">
                      <p>{roleLabel(u.role)}</p>
                      <p className={u.isActive === false ? "text-amber-700" : "text-emerald-700"}>
                        {u.isActive === false ? t.inactive : t.active}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {detail?.billingInvoices && detail.billingInvoices.length > 0 ? (
              <div className="rounded-xl bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-bold text-slate-500">{t.payments}</p>
                {detail.billingInvoices.slice(0, 6).map((b) => (
                  <div key={b.id} className="flex justify-between text-xs gap-2">
                    <span className="text-slate-600">
                      {fmt(b.createdAt, en)} · {b.status}
                    </span>
                    <span className="font-bold tabular-nums">
                      {Number(b.amount ?? 0).toFixed(3)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

            <Link
              href={`/admin/users?q=${encodeURIComponent(selected.email || selected.name)}`}
              className="block text-center text-sm text-teal-800 font-semibold"
            >
              {t.users}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
