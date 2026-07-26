"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  Building2,
  KeyRound,
  Loader2,
  Power,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";

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
  isProtected?: boolean;
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
  sessions: {
    id: string;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
  }[];
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

const ROLES = [
  "ADMIN",
  "ACCOUNTANT",
  "MANAGER",
  "CASHIER",
  "WAITER",
  "KITCHEN",
  "RESTO_MANAGER",
  "VIEWER",
] as const;

type Tab = "plan" | "payments" | "sessions";

function fmt(d?: string | null, en?: boolean) {
  if (!d) return "—";
  return new Date(d).toLocaleString(en ? "en-GB" : "ar", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function roleTone(role: string) {
  switch (role) {
    case "ADMIN":
      return "bg-violet-100 text-violet-800";
    case "MANAGER":
    case "RESTO_MANAGER":
      return "bg-sky-100 text-sky-800";
    case "ACCOUNTANT":
      return "bg-emerald-100 text-emerald-800";
    case "CASHIER":
      return "bg-amber-100 text-amber-900";
    case "WAITER":
    case "KITCHEN":
      return "bg-orange-100 text-orange-900";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function errMsg(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || fallback
  );
}

const field =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/25 focus:border-teal-600";
const select =
  "rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700";

function UsersInner() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get("q") || "");
  const [appliedQ, setAppliedQ] = useState(searchParams.get("q") || "");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [sort, setSort] = useState("createdAt_desc");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("plan");
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAdminUsers({
        q: appliedQ.trim() || undefined,
        role: role || undefined,
        isActive: status || undefined,
        plan: planFilter || undefined,
        sort: sort || undefined,
      });
      setRows(res.data as UserRow[]);
    } catch (err: unknown) {
      toast.error(errMsg(err, en ? "Failed to load" : "تعذر التحميل"));
    } finally {
      setLoading(false);
    }
  }, [appliedQ, role, status, planFilter, sort, en]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
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
  }, []);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setTab("plan");
    try {
      const res = await api.getAdminUser(id);
      const d = res.data as UserDetail;
      setDetail(d);
      setPlan(d.company.plan);
      setPlanExpiry(
        d.company.planExpiry ? d.company.planExpiry.slice(0, 10) : "",
      );
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
    } catch (err: unknown) {
      toast.error(errMsg(err, en ? "Failed" : "تعذر"));
    } finally {
      setDetailLoading(false);
    }
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
      setRows((prev) =>
        prev.map((r) =>
          r.company.id === detail.company.id
            ? { ...r, company: { ...r.company, plan } }
            : r,
        ),
      );
      await openDetail(detail.id);
      toast.success(en ? "Saved" : "تم الحفظ");
    } catch (err: unknown) {
      toast.error(errMsg(err, en ? "Save failed" : "تعذر الحفظ"));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (u: {
    id: string;
    isActive: boolean;
    isProtected?: boolean;
  }) => {
    if (u.isProtected) return;
    setBusyId(u.id);
    try {
      await api.updateAdminUser(u.id, { isActive: !u.isActive });
      setRows((prev) =>
        prev.map((r) => (r.id === u.id ? { ...r, isActive: !u.isActive } : r)),
      );
      if (detail?.id === u.id) {
        setDetail({ ...detail, isActive: !u.isActive });
      }
      toast.success(en ? "Updated" : "تم التحديث");
    } catch (err: unknown) {
      toast.error(errMsg(err, en ? "Failed" : "تعذر"));
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (u: {
    id: string;
    name: string;
    isProtected?: boolean;
  }) => {
    if (u.isProtected) return;
    if (!window.confirm(`${t.deleteConfirm}\n${u.name}`)) return;
    setBusyId(u.id);
    try {
      await api.deleteAdminUser(u.id);
      if (detail?.id === u.id) setDetail(null);
      setRows((prev) => prev.filter((r) => r.id !== u.id));
      toast.success(en ? "Deleted" : "تم الحذف");
    } catch (err: unknown) {
      toast.error(errMsg(err, en ? "Delete failed" : "تعذر الحذف"));
    } finally {
      setBusyId(null);
    }
  };

  const resetPassword = async (u: {
    id: string;
    email: string;
    isProtected?: boolean;
  }) => {
    if (u.isProtected) return;
    if (!window.confirm(t.resetPasswordConfirm)) return;
    setBusyId(u.id);
    try {
      const res = await api.resetAdminUserPassword(u.id);
      const data = res.data as {
        emailSent?: boolean;
        temporaryPassword?: string;
      };
      if (data.emailSent) toast.success(t.passwordSent);
      else if (data.temporaryPassword) {
        toast.success(`${t.tempPassword}: ${data.temporaryPassword}`, {
          duration: 12000,
        });
      } else toast.success(en ? "Password reset" : "تمت إعادة التعيين");
    } catch (err: unknown) {
      toast.error(errMsg(err, en ? "Reset failed" : "تعذر إعادة التعيين"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-950">
            {t.users}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {en
              ? "Select a user to manage plan, discount, payments, and sessions."
              : "اختر مستخدمًا لإدارة الباقة والتخفيض والمدفوعات والجلسات."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          {t.refresh}
        </button>
      </div>

      <form
        className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3"
        onSubmit={(e) => {
          e.preventDefault();
          setAppliedQ(q.trim());
        }}
      >
        <div className="relative grow min-w-[12rem] max-w-xs">
          <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t.search}
            className={cn(field, "ps-8")}
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={select}>
          <option value="">{t.allRoles}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="">{t.allStatuses}</option>
          <option value="true">{t.active}</option>
          <option value="false">{t.inactive}</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className={select}
        >
          <option value="">{t.allPlans}</option>
          {planCodes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className={select}>
          <option value="createdAt_desc">{t.sortNewest}</option>
          <option value="createdAt_asc">{t.sortOldest}</option>
          <option value="name_asc">{t.sortName}</option>
          <option value="lastLogin_desc">{t.sortLastLogin}</option>
        </select>
        <button
          type="submit"
          className="rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 text-xs font-bold"
        >
          {t.search}
        </button>
      </form>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)] gap-4 items-start">
        <div
          className={cn(
            "rounded-2xl border border-slate-200 bg-white overflow-hidden",
            loading && rows.length > 0 && "opacity-70",
          )}
        >
          {loading && rows.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-sm">
              <Loader2 className="w-5 h-5 animate-spin inline-block me-2 text-teal-700" />
              {t.loading}
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">{t.empty}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {rows.map((u) => {
                const selected = detail?.id === u.id;
                const busy = busyId === u.id;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => void openDetail(u.id)}
                      className={cn(
                        "w-full text-start px-4 py-3.5 transition-colors",
                        selected
                          ? "bg-teal-50 border-s-[3px] border-teal-700"
                          : "hover:bg-slate-50 border-s-[3px] border-transparent",
                        !u.isActive && "opacity-70",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-teal-950 truncate">
                              {u.name}
                            </span>
                            {u.isProtected ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800">
                                {en ? "Owner" : "مالك"}
                              </span>
                            ) : null}
                            {!u.isActive ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800">
                                {t.inactive}
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                                {t.active}
                              </span>
                            )}
                          </div>
                          <p
                            className="text-xs text-slate-500 font-mono truncate mt-0.5"
                            dir="ltr"
                          >
                            {u.email}
                          </p>
                          <div className="flex flex-wrap items-center gap-2 mt-2">
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                                roleTone(u.role),
                              )}
                            >
                              {u.role}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {u.company.name}
                            </span>
                            <span className="text-[11px] font-bold text-teal-800">
                              {u.company.plan}
                            </span>
                          </div>
                        </div>
                        <div className="text-end shrink-0">
                          <p className="text-[10px] text-slate-400">
                            {en ? "Last login" : "آخر دخول"}
                          </p>
                          <p className="text-[11px] text-slate-600 mt-0.5">
                            {fmt(u.lastLoginAt, en)}
                          </p>
                          {!u.isProtected ? (
                            <div
                              className="flex gap-0.5 mt-2 justify-end"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={busy}
                                title={u.isActive ? t.deactivate : t.activate}
                                onClick={() => void toggleActive(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-800 hover:bg-teal-50 disabled:opacity-40"
                              >
                                {busy ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Power className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                title={t.resetPassword}
                                onClick={() => void resetPassword(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-teal-800 hover:bg-teal-50 disabled:opacity-40"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                title={t.delete}
                                onClick={() => void deleteUser(u)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <aside className="lg:sticky lg:top-4 rounded-2xl border border-slate-200 bg-white min-h-[26rem] overflow-hidden shadow-sm">
          {detailLoading && !detail ? (
            <div className="flex items-center justify-center h-64 text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
            </div>
          ) : !detail ? (
            <div className="flex flex-col items-center justify-center h-64 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-700">
                <UserRound className="w-5 h-5" />
              </div>
              <p className="text-sm text-slate-500 mt-3 leading-relaxed">
                {en
                  ? "Select a user from the list to open their profile here."
                  : "اختر مستخدمًا من القائمة لفتح ملفه هنا."}
              </p>
            </div>
          ) : (
            <div className="flex flex-col max-h-[min(78vh,40rem)]">
              <div className="px-4 pt-4 pb-3 border-b border-slate-100 bg-[#f8faf9]">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-extrabold text-teal-950 truncate">
                      {detail.name}
                    </h2>
                    <p
                      className="text-xs text-slate-500 font-mono truncate mt-0.5"
                      dir="ltr"
                    >
                      {detail.email}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span
                        className={cn(
                          "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                          roleTone(detail.role),
                        )}
                      >
                        {detail.role}
                      </span>
                      {detail.isProtected ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 text-violet-800">
                          {t.ownerLocked}
                        </span>
                      ) : (
                        <span
                          className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                            detail.isActive
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800",
                          )}
                        >
                          {detail.isActive ? t.active : t.inactive}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span className="truncate">
                        {detail.company.name}
                        {detail.company.phone
                          ? ` · ${detail.company.phone}`
                          : ""}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetail(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-white"
                    aria-label="close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!detail.isProtected ? (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <button
                      type="button"
                      disabled={busyId === detail.id}
                      onClick={() => void toggleActive(detail)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                      <Power className="w-3 h-3" />
                      {detail.isActive ? t.deactivate : t.activate}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === detail.id}
                      onClick={() => void resetPassword(detail)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                    >
                      <KeyRound className="w-3 h-3" />
                      {t.resetPassword}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === detail.id}
                      onClick={() => void deleteUser(detail)}
                      className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      {t.delete}
                    </button>
                  </div>
                ) : null}

                <div className="flex gap-1 mt-3 p-1 rounded-xl bg-white border border-slate-200">
                  {(
                    [
                      ["plan", en ? "Plan" : "الباقة"],
                      ["payments", t.payments],
                      ["sessions", t.sessions],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={cn(
                        "flex-1 text-[11px] font-bold py-1.5 rounded-lg transition-colors",
                        tab === id
                          ? "bg-teal-700 text-white"
                          : "text-slate-500 hover:text-teal-900 hover:bg-teal-50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {tab === "plan" ? (
                  <>
                    <p className="text-[11px] text-slate-500">
                      {en
                        ? "Company subscription linked to this account"
                        : "اشتراك الشركة المرتبطة بهذا الحساب"}
                    </p>
                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="space-y-1 col-span-2 sm:col-span-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {t.plan}
                        </span>
                        <select
                          value={plan}
                          onChange={(e) => setPlan(e.target.value)}
                          className={field}
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
                      <label className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {t.expires}
                        </span>
                        <input
                          type="date"
                          value={planExpiry}
                          onChange={(e) => setPlanExpiry(e.target.value)}
                          className={field}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {t.usersLimit}
                        </span>
                        <input
                          value={usersLimit}
                          onChange={(e) => setUsersLimit(e.target.value)}
                          className={field}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {t.invoicesLimit}
                        </span>
                        <input
                          value={invoicesLimit}
                          onChange={(e) => setInvoicesLimit(e.target.value)}
                          className={field}
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-500">
                          {t.permanentDiscount}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={discountPct}
                          onChange={(e) => setDiscountPct(e.target.value)}
                          className={field}
                        />
                      </label>
                      <label className="space-y-1 col-span-2">
                        <span className="text-[10px] font-bold text-slate-500">
                          {t.permanentDiscountNote}
                        </span>
                        <input
                          value={discountNote}
                          onChange={(e) => setDiscountNote(e.target.value)}
                          placeholder={
                            en
                              ? "Family / early / staff…"
                              : "عائلة / مشترك أول / شركتي…"
                          }
                          className={field}
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => void saveCompany()}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-3 py-2.5 text-sm font-bold disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Save className="w-4 h-4" />
                      )}
                      {t.save}
                    </button>
                  </>
                ) : null}

                {tab === "payments" ? (
                  detail.subscriptionPayments.length === 0 ? (
                    <p className="text-sm text-slate-400 py-8 text-center">
                      {t.empty}
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {detail.subscriptionPayments.map((p) => (
                        <li
                          key={p.id}
                          className="rounded-xl border border-slate-200 bg-[#f8faf9] px-3 py-2.5"
                        >
                          <div className="flex justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 font-mono">
                                {p.number}
                              </p>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5">
                                {p.description}
                              </p>
                            </div>
                            <div className="text-end shrink-0">
                              <p className="text-sm font-bold text-teal-950">
                                {Number(p.amount).toFixed(3)} {p.currency}
                              </p>
                              <p
                                className={cn(
                                  "text-[10px] font-bold mt-0.5",
                                  p.status === "PAID"
                                    ? "text-emerald-700"
                                    : "text-amber-700",
                                )}
                              >
                                {p.status}
                              </p>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-1.5">
                            {fmt(p.paidAt || p.createdAt, en)}
                            {p.gatewaySlug ? ` · ${p.gatewaySlug}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}

                {tab === "sessions" ? (
                  detail.sessions.length === 0 ? (
                    <p className="text-sm text-slate-400 py-8 text-center">—</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {detail.sessions.map((s) => (
                        <li
                          key={s.id}
                          className="flex justify-between gap-2 text-xs py-2.5"
                        >
                          <span className="font-mono text-slate-600" dir="ltr">
                            {s.ipAddress || "—"}
                          </span>
                          <span className="text-slate-400">
                            {fmt(s.createdAt, en)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )
                ) : null}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-slate-500 flex items-center gap-2 py-10">
          <Loader2 className="w-4 h-4 animate-spin text-teal-700" />
          …
        </div>
      }
    >
      <UsersInner />
    </Suspense>
  );
}
