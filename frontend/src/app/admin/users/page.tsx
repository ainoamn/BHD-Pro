"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import toast from "react-hot-toast";
import { Loader2, Save } from "lucide-react";
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
  isProtected?: boolean;
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
    usersLimitOverride?: number | null;
    invoicesLimitOverride?: number | null;
    permanentDiscountPct?: number;
    permanentDiscountNote?: string | null;
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
  const [planCodes, setPlanCodes] = useState<string[]>([
    "STARTER",
    "PROFESSIONAL",
    "ENTERPRISE",
  ]);
  const [plan, setPlan] = useState("STARTER");
  const [planExpiry, setPlanExpiry] = useState("");
  const [usersLimit, setUsersLimit] = useState("");
  const [invoicesLimit, setInvoicesLimit] = useState("");
  const [discountPct, setDiscountPct] = useState("0");
  const [discountNote, setDiscountNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async (query?: string) => {
    const res = await api.getAdminUsers(query);
    setRows(res.data as UserRow[]);
  };

  useEffect(() => {
    void load(q || undefined);
    void (async () => {
      try {
        const res = await api.getAdminPlans();
        const list = res.data as { code: string }[];
        if (Array.isArray(list) && list.length) {
          setPlanCodes(list.map((p) => p.code));
        }
      } catch {
        /* keep defaults */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDetail = async (id: string) => {
    const res = await api.getAdminUser(id);
    const d = res.data as UserDetail;
    setDetail(d);
    setPlan(d.company.plan);
    setPlanExpiry(d.company.planExpiry ? d.company.planExpiry.slice(0, 10) : "");
    setUsersLimit(
      d.company.usersLimitOverride != null
        ? String(d.company.usersLimitOverride)
        : String(d.company.usersLimit),
    );
    setInvoicesLimit(
      d.company.invoicesLimitOverride != null
        ? String(d.company.invoicesLimitOverride)
        : String(d.company.invoicesLimit),
    );
    setDiscountPct(String(d.company.permanentDiscountPct ?? 0));
    setDiscountNote(d.company.permanentDiscountNote || "");
  };

  const saveCompany = async () => {
    if (!detail) return;
    setSaving(true);
    try {
      const ul = usersLimit.trim() === "" ? null : Number(usersLimit);
      const il = invoicesLimit.trim() === "" ? null : Number(invoicesLimit);
      const pct = Number(discountPct);
      await api.updateAdminTenant(detail.company.id, {
        plan,
        planExpiry: planExpiry || null,
        usersLimitOverride: Number.isFinite(ul as number) ? ul : null,
        invoicesLimitOverride: Number.isFinite(il as number) ? il : null,
        permanentDiscountPct: Number.isFinite(pct) ? pct : 0,
        permanentDiscountNote: discountNote.trim() || null,
      });
      await load(q);
      await openDetail(detail.id);
      toast.success(en ? "Saved" : "تم الحفظ");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Save failed" : "تعذر الحفظ");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.users}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {en
              ? "Edit company plan, limits, and permanent discounts from user details."
              : "من تفاصيل المستخدم: ترقية الباقة، الحدود، وتخفيض مستمر على حساب الشركة."}
          </p>
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void load(q);
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
                    onClick={() => void openDetail(u.id)}
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
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {detail.role} · {detail.googleLinked ? "Google" : "password"}
                </p>
              </div>
              {detail.isProtected ? (
                <span className="text-xs font-bold h-fit px-3 py-1.5 rounded-lg bg-violet-100 text-violet-800">
                  {en ? "Owner (locked)" : "مالك (مقفل)"}
                </span>
              ) : (
                <button
                  type="button"
                  className="text-xs font-bold border rounded-lg px-3 py-1.5 h-fit"
                  onClick={async () => {
                    try {
                      await api.updateAdminUser(detail.id, {
                        isActive: !detail.isActive,
                      });
                      await load(q);
                      await openDetail(detail.id);
                      toast.success(en ? "Updated" : "تم التحديث");
                    } catch (err: unknown) {
                      const msg =
                        (err as { response?: { data?: { message?: string } } })
                          ?.response?.data?.message ||
                        (en ? "Failed" : "تعذر");
                      toast.error(msg);
                    }
                  }}
                >
                  {detail.isActive ? t.inactive : t.active}
                </button>
              )}
            </div>

            <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 space-y-3">
              <p className="text-xs font-extrabold text-teal-950">
                {en ? "Company plan & permanent discount" : "باقة الشركة والتخفيض المستمر"}
              </p>
              <p className="text-[11px] text-slate-600">
                {detail.company.name}
                {detail.company.email ? ` · ${detail.company.email}` : ""}
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{t.plan}</span>
                  <select
                    value={plan}
                    onChange={(e) => setPlan(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  >
                    {planCodes.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                    {!planCodes.includes(plan) ? (
                      <option value={plan}>{plan}</option>
                    ) : null}
                  </select>
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{t.expires}</span>
                  <input
                    type="date"
                    value={planExpiry}
                    onChange={(e) => setPlanExpiry(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{t.usersLimit} (-1 = ∞)</span>
                  <input
                    value={usersLimit}
                    onChange={(e) => setUsersLimit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{t.invoicesLimit} (-1 = ∞)</span>
                  <input
                    value={invoicesLimit}
                    onChange={(e) => setInvoicesLimit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">
                    {en ? "Permanent discount %" : "تخفيض مستمر %"}
                  </span>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={discountPct}
                    onChange={(e) => setDiscountPct(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">
                    {en ? "Discount reason" : "سبب التخفيض"}
                  </span>
                  <input
                    value={discountNote}
                    onChange={(e) => setDiscountNote(e.target.value)}
                    placeholder={en ? "Family / early / staff…" : "عائلة / مشترك أول / شركتي…"}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveCompany()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {en ? "Save plan & discount" : "حفظ الباقة والتخفيض"}
              </button>
            </div>

            <div>
              <h3 className="font-bold mb-2">{t.payments}</h3>
              <div className="space-y-2">
                {detail.subscriptionPayments.length === 0 && (
                  <p className="text-sm text-slate-500">{t.empty}</p>
                )}
                {detail.subscriptionPayments.map((p) => (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-100 p-3 text-sm flex justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold">{p.number}</p>
                      <p className="text-xs text-slate-500">{p.description}</p>
                      <p className="text-[11px] text-slate-400">
                        {fmt(p.paidAt || p.createdAt, en)}
                      </p>
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
                {detail.sessions.length === 0 ? (
                  <p className="text-sm text-slate-500">—</p>
                ) : (
                  detail.sessions.map((s) => (
                    <div
                      key={s.id}
                      className="text-xs flex justify-between gap-2 border-b border-slate-50 py-1.5"
                    >
                      <span className="font-mono">{s.ipAddress || "—"}</span>
                      <span className="text-slate-500">{fmt(s.createdAt, en)}</span>
                    </div>
                  ))
                )}
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
