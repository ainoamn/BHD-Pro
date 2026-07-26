"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Power, Shield, Trash2, UserPlus } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";

const PERMS = [
  "full",
  "overview",
  "tenants",
  "users",
  "billing",
  "plans",
  "visits",
  "gateways",
  "operators",
] as const;

type Operator = {
  id: string;
  email: string;
  name: string | null;
  permissions: string[];
  isActive: boolean;
  isBootstrap?: boolean;
  isProtected?: boolean;
  canDelete?: boolean;
};

export default function AdminOperatorsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [rows, setRows] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<string[]>(["full"]);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await api.getAdminOperators();
    setRows(res.data as Operator[]);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch {
        if (!cancelled) toast.error(en ? "Failed to load operators" : "تعذر تحميل المشرفين");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [en]);

  const permLabels = useMemo(
    () =>
      ({
        full: en ? "Full access" : "صلاحية كاملة",
        overview: en ? "Overview" : "المؤشرات",
        tenants: en ? "Companies" : "الشركات",
        users: en ? "Users" : "المستخدمون",
        billing: en ? "Billing" : "المدفوعات",
        plans: en ? "Plans" : "الباقات",
        visits: en ? "Visits" : "الزيارات",
        gateways: en ? "Gateways" : "بوابات الدفع",
        operators: en ? "Operators" : "المشرفون",
      }) as Record<string, string>,
    [en],
  );

  const appoint = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await api.appointAdminOperator({
        email: email.trim(),
        name: name.trim() || undefined,
        permissions: perms,
      });
      setEmail("");
      setName("");
      setPerms(["full"]);
      await load();
      toast.success(en ? "Operator appointed" : "تم تعيين المشرف");
    } catch {
      toast.error(en ? "Could not appoint operator" : "تعذر التعيين");
    } finally {
      setBusy(false);
    }
  };

  const togglePerm = (p: string) => {
    if (p === "full") {
      setPerms(["full"]);
      return;
    }
    setPerms((prev) => {
      const withoutFull = prev.filter((x) => x !== "full");
      if (withoutFull.includes(p)) {
        const next = withoutFull.filter((x) => x !== p);
        return next.length ? next : ["full"];
      }
      return [...withoutFull, p];
    });
  };

  const setOperatorPerms = async (id: string, next: string[]) => {
    try {
      await api.updateAdminOperator(id, { permissions: next });
      await load();
      toast.success(en ? "Permissions updated" : "تم تحديث الصلاحيات");
    } catch {
      toast.error(en ? "Update failed" : "تعذر التحديث");
    }
  };

  const toggleActive = async (op: Operator) => {
    try {
      await api.updateAdminOperator(op.id, { isActive: !op.isActive });
      await load();
      toast.success(
        op.isActive
          ? en
            ? "Operator deactivated"
            : "تم إيقاف المشرف"
          : en
            ? "Operator reactivated"
            : "تم إعادة تفعيل المشرف",
      );
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Update failed" : "تعذر التحديث");
      toast.error(msg);
    }
  };

  const remove = async (op: Operator) => {
    if (op.isProtected) {
      toast.error(
        en
          ? "Primary owner cannot be deleted — restrict permissions instead"
          : "لا يمكن حذف المالك الأساسي — قيّد صلاحياته بدلاً من الحذف",
      );
      return;
    }
    if (
      !confirm(
        en
          ? `Remove supervision for ${op.email}?`
          : `إزالة إشراف ${op.email}؟`,
      )
    )
      return;
    try {
      await api.removeAdminOperator(op.id);
      await load();
      toast.success(en ? "Removed from operators" : "تمت الإزالة من المشرفين");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Remove failed" : "تعذر الحذف");
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-teal-950 flex items-center gap-2">
          <Shield className="w-7 h-7 text-teal-700" />
          {t.operators}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Appoint, restrict, deactivate, or remove platform operators."
            : "عيّن المشرفين، قيّد صلاحياتهم، أوقفهم أو احذفهم من الإشراف."}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-sm">
        <h2 className="font-bold flex items-center gap-2">
          <UserPlus className="w-4 h-4" />
          {en ? "Appoint operator" : "تعيين مشرف"}
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input
            dir="ltr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@company.com"
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={en ? "Display name (optional)" : "الاسم (اختياري)"}
            className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {PERMS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => togglePerm(p)}
              className={cn(
                "text-xs font-bold px-2.5 py-1 rounded-full border",
                perms.includes(p)
                  ? "bg-teal-700 text-white border-teal-700"
                  : "bg-white text-slate-600 border-slate-200",
              )}
            >
              {permLabels[p]}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={busy || !email.trim()}
          onClick={() => void appoint()}
          className="rounded-xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{" "}
          {en ? "Appoint" : "تعيين"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((op) => (
            <div
              key={op.id}
              className={cn(
                "rounded-2xl border bg-white p-4 space-y-3",
                op.isActive ? "border-slate-200" : "border-amber-200 bg-amber-50/40",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{op.name || op.email}</p>
                  <p className="text-xs font-mono text-slate-500" dir="ltr">
                    {op.email}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {op.isProtected ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-800">
                        {en ? "Owner" : "مالك"}
                      </span>
                    ) : op.isBootstrap ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {en ? "Seeded" : "افتراضي"}
                      </span>
                    ) : null}
                    <span
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        op.isActive
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900",
                      )}
                    >
                      {op.isActive ? t.active : t.inactive}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!op.isProtected ? (
                    <button
                      type="button"
                      onClick={() => void toggleActive(op)}
                      className="inline-flex items-center gap-1 text-sm font-bold text-slate-700 hover:underline"
                    >
                      <Power className="w-4 h-4" />
                      {op.isActive
                        ? en
                          ? "Deactivate"
                          : "إيقاف"
                        : en
                          ? "Activate"
                          : "تفعيل"}
                    </button>
                  ) : null}
                  {!op.isProtected ? (
                    <button
                      type="button"
                      onClick={() => void remove(op)}
                      className="inline-flex items-center gap-1 text-sm font-bold text-rose-700 hover:underline"
                    >
                      <Trash2 className="w-4 h-4" />
                      {en ? "Remove" : "حذف الإشراف"}
                    </button>
                  ) : null}
                </div>
              </div>
              <p className="text-[11px] text-slate-500">
                {en
                  ? "Click chips to grant or revoke console sections."
                  : "اضغط الشارات لمنح أو سحب أقسام لوحة التحكم."}
              </p>
              <div className="flex flex-wrap gap-2">
                {PERMS.map((p) => {
                  const active = (op.permissions || []).includes(p);
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        let next: string[];
                        if (p === "full") next = ["full"];
                        else {
                          const base = (op.permissions || []).filter((x) => x !== "full");
                          next = active
                            ? base.filter((x) => x !== p)
                            : [...base, p];
                          if (!next.length) next = ["full"];
                        }
                        void setOperatorPerms(op.id, next);
                      }}
                      className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                        active
                          ? "bg-teal-700 text-white border-teal-700"
                          : "bg-white text-slate-500 border-slate-200 hover:border-teal-400",
                      )}
                    >
                      {permLabels[p]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {rows.length === 0 ? (
            <p className="text-sm text-slate-500">{t.empty}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
