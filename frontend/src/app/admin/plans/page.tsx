"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";
import { PermissionTree } from "@/components/admin/permission-tree";
import {
  defaultModulesFromLegacy,
  normalizePlanAccess,
  type PlanModuleGrant,
} from "@/lib/plan-access-catalog";
import { PLAN_FEATURES } from "@/lib/plan-features-defaults";

type PlanDef = {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  invoicesLimit: number;
  usersLimit: number;
  support: string;
  features: Record<string, boolean>;
  modules?: Record<string, PlanModuleGrant>;
  isActive: boolean;
  isSystem: boolean;
  sortOrder: number;
};

type Offer = {
  id: string;
  plan: string;
  nameAr: string;
  nameEn: string;
  discountPct: string | number;
  promoCode: string | null;
  isActive: boolean;
};

type Draft = {
  nameAr: string;
  nameEn: string;
  monthlyPrice: number;
  yearlyPrice: number;
  invoicesLimit: number;
  usersLimit: number;
  isActive: boolean;
  modules: Record<string, PlanModuleGrant>;
};

const emptyOffer = {
  plan: "STARTER",
  nameAr: "",
  nameEn: "",
  discountPct: "10",
  promoCode: "",
};

const emptyNewPlan = {
  code: "",
  nameAr: "",
  nameEn: "",
  monthlyPrice: "10",
  yearlyPrice: "96",
  invoicesLimit: "100",
  usersLimit: "5",
};

function toDraft(p: PlanDef): Draft {
  const access = normalizePlanAccess(
    p.modules ? { modules: p.modules as unknown as Record<string, unknown> } : (p.features as Record<string, unknown>),
    PLAN_FEATURES[p.code] || PLAN_FEATURES.STARTER,
  );
  return {
    nameAr: p.nameAr,
    nameEn: p.nameEn,
    monthlyPrice: p.monthlyPrice,
    yearlyPrice: p.yearlyPrice,
    invoicesLimit: p.invoicesLimit,
    usersLimit: p.usersLimit,
    isActive: p.isActive,
    modules: p.modules && Object.keys(p.modules).length ? p.modules : access.modules,
  };
}

export default function AdminPlansPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [form, setForm] = useState(emptyOffer);
  const [newPlan, setNewPlan] = useState(emptyNewPlan);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [offerSaving, setOfferSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const [p, o] = await Promise.all([api.getAdminPlans(), api.getAdminOffers()]);
    const list = p.data as PlanDef[];
    setPlans(list);
    const d: Record<string, Draft> = {};
    for (const row of list) d[row.code] = toDraft(row);
    setDrafts(d);
    setOffers(o.data as Offer[]);
  };

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch {
        toast.error(en ? "Failed to load plans" : "تعذر تحميل الباقات");
      } finally {
        setLoading(false);
      }
    })();
  }, [en]);

  const savePlan = async (code: string) => {
    const d = drafts[code];
    if (!d) return;
    setSavingCode(code);
    try {
      await api.updateAdminPlan(code, {
        nameAr: d.nameAr,
        nameEn: d.nameEn,
        monthlyPrice: Number(d.monthlyPrice),
        yearlyPrice: Number(d.yearlyPrice),
        invoicesLimit: Number(d.invoicesLimit),
        usersLimit: Number(d.usersLimit),
        isActive: d.isActive,
        modules: d.modules,
      });
      await load();
      toast.success(en ? "Plan saved" : "تم حفظ الباقة");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Save failed" : "تعذر الحفظ");
      toast.error(msg);
    } finally {
      setSavingCode(null);
    }
  };

  const createPlan = async () => {
    if (!newPlan.code.trim() || !newPlan.nameAr.trim()) return;
    setCreating(true);
    try {
      await api.createAdminPlan({
        code: newPlan.code,
        nameAr: newPlan.nameAr,
        nameEn: newPlan.nameEn || newPlan.nameAr,
        monthlyPrice: Number(newPlan.monthlyPrice) || 0,
        yearlyPrice: Number(newPlan.yearlyPrice) || 0,
        invoicesLimit: Number(newPlan.invoicesLimit) || 50,
        usersLimit: Number(newPlan.usersLimit) || 2,
        modules: defaultModulesFromLegacy(PLAN_FEATURES.STARTER),
      });
      setNewPlan(emptyNewPlan);
      await load();
      toast.success(en ? "Plan created" : "تم إنشاء الباقة");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Create failed" : "تعذر الإنشاء");
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  const deletePlan = async (code: string, isSystem: boolean) => {
    if (isSystem) {
      toast.error(
        en
          ? "System plans cannot be deleted — hide or lock modules instead"
          : "لا يمكن حذف الباقات الأساسية — أخفِها أو اقفل الوحدات",
      );
      return;
    }
    if (!confirm(en ? `Delete plan ${code}?` : `حذف الباقة ${code}؟`)) return;
    try {
      await api.deleteAdminPlan(code);
      await load();
      toast.success(en ? "Plan deleted" : "تم حذف الباقة");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || (en ? "Delete failed" : "تعذر الحذف");
      toast.error(msg);
    }
  };

  const onCreateOffer = async (e: FormEvent) => {
    e.preventDefault();
    setOfferSaving(true);
    try {
      await api.createAdminOffer({
        plan: form.plan,
        nameAr: form.nameAr || `عرض ${form.plan}`,
        nameEn: form.nameEn || `${form.plan} offer`,
        discountPct: Number(form.discountPct) || 0,
        promoCode: form.promoCode || undefined,
        isActive: true,
      });
      setForm(emptyOffer);
      await load();
    } catch {
      toast.error(en ? "Could not save offer" : "تعذر حفظ العرض");
    } finally {
      setOfferSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-teal-700" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.plans}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Under each plan: check allowed menu items, set transaction limits. Unchecked items show Upgrade in the company app."
            : "تحت كل باقة: ضع علامة صح على الصفحات المسموحة، وحدّد حد المعاملات. غير المفعّل يظهر «ترقية» في حساب الشركة."}
        </p>
      </div>

      <div className="space-y-6">
        {plans.map((p) => {
          const d = drafts[p.code];
          if (!d) return null;
          return (
            <div
              key={p.code}
              className={cn(
                "rounded-2xl border bg-white p-4 sm:p-5 space-y-4",
                d.isActive ? "border-slate-200" : "border-amber-200 bg-amber-50/30",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold text-teal-950 text-lg">
                    {en ? d.nameEn : d.nameAr}{" "}
                    <span className="text-xs font-mono text-slate-500" dir="ltr">
                      {p.code}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() =>
                      setDrafts((prev) => ({
                        ...prev,
                        [p.code]: { ...d, isActive: !d.isActive },
                      }))
                    }
                    className="text-slate-700 hover:underline"
                  >
                    {d.isActive
                      ? en
                        ? "Hide from catalog"
                        : "إخفاء من الكتالوج"
                      : en
                        ? "Show in catalog"
                        : "إظهار في الكتالوج"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void deletePlan(p.code, p.isSystem)}
                    className="inline-flex items-center gap-1 text-rose-700 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {en ? "Delete" : "حذف"}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(
                  [
                    ["nameAr", en ? "Name AR" : "الاسم عربي", d.nameAr],
                    ["nameEn", en ? "Name EN" : "الاسم إنجليزي", d.nameEn],
                    ["monthlyPrice", en ? "Monthly" : "شهري", d.monthlyPrice],
                    ["yearlyPrice", en ? "Yearly" : "سنوي", d.yearlyPrice],
                    ["invoicesLimit", en ? "Invoices/mo" : "فواتير/شهر", d.invoicesLimit],
                    ["usersLimit", en ? "Users" : "مستخدمون", d.usersLimit],
                  ] as const
                ).map(([key, label, val]) => (
                  <label key={key} className="text-xs space-y-1">
                    <span className="text-slate-500">{label}</span>
                    <input
                      type={typeof val === "number" ? "number" : "text"}
                      value={val as string | number}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [p.code]: {
                            ...d,
                            [key]:
                              typeof val === "number"
                                ? Number(e.target.value)
                                : e.target.value,
                          },
                        }))
                      }
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                    />
                  </label>
                ))}
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 mb-2">
                  {en
                    ? "Allowed pages & apps (checkbox = included)"
                    : "الصفحات والأنظمة المسموحة (علامة صح = مفعّل)"}
                </p>
                <PermissionTree
                  en={en}
                  showLimits
                  value={d.modules}
                  onChange={(modules) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [p.code]: { ...d, modules },
                    }))
                  }
                />
              </div>

              <button
                type="button"
                disabled={savingCode === p.code}
                onClick={() => void savePlan(p.code)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {savingCode === p.code ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Save className="w-4 h-4" />
                )}
                {en ? "Save plan" : "حفظ الباقة"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {en ? "Add plan" : "إضافة باقة"}
        </h2>
        <div className="grid sm:grid-cols-3 gap-2">
          <input
            dir="ltr"
            value={newPlan.code}
            onChange={(e) =>
              setNewPlan((f) => ({ ...f, code: e.target.value.toUpperCase() }))
            }
            placeholder="CODE"
            className="rounded-xl border px-3 py-2 text-sm bg-white"
          />
          <input
            value={newPlan.nameAr}
            onChange={(e) => setNewPlan((f) => ({ ...f, nameAr: e.target.value }))}
            placeholder={en ? "Arabic name" : "الاسم عربي"}
            className="rounded-xl border px-3 py-2 text-sm bg-white"
          />
          <button
            type="button"
            disabled={creating || !newPlan.code || !newPlan.nameAr}
            onClick={() => void createPlan()}
            className="rounded-xl bg-teal-700 text-white text-sm font-bold disabled:opacity-50"
          >
            {en ? "Create" : "إنشاء"}
          </button>
        </div>
      </div>

      <div className="space-y-3 border-t pt-6">
        <h2 className="font-extrabold">{en ? "Promo offers" : "عروض التخفيض"}</h2>
        <form onSubmit={onCreateOffer} className="grid sm:grid-cols-4 gap-2">
          <select
            value={form.plan}
            onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
            className="rounded-xl border px-3 py-2 text-sm"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {en ? p.nameEn : p.nameAr}
              </option>
            ))}
          </select>
          <input
            value={form.promoCode}
            onChange={(e) =>
              setForm((f) => ({ ...f, promoCode: e.target.value.toUpperCase() }))
            }
            placeholder="CODE"
            className="rounded-xl border px-3 py-2 text-sm"
            dir="ltr"
          />
          <input
            value={form.discountPct}
            onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
            placeholder="%"
            className="rounded-xl border px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={offerSaving}
            className="rounded-xl bg-teal-700 text-white text-sm font-bold"
          >
            {en ? "Save offer" : "حفظ العرض"}
          </button>
        </form>
        <ul className="text-sm space-y-1">
          {offers.map((o) => (
            <li key={o.id} className="flex justify-between gap-2 border-b py-2">
              <span>
                {o.plan} · {o.promoCode || "—"} · {Number(o.discountPct)}%
              </span>
              <button
                type="button"
                className="text-rose-700 text-xs font-bold"
                onClick={async () => {
                  await api.deleteAdminOffer(o.id);
                  await load();
                }}
              >
                {en ? "Delete" : "حذف"}
              </button>
            </li>
          ))}
        </ul>
        <Link href="/admin/billing" className="text-xs text-teal-700 font-semibold underline">
          {t.billing}
        </Link>
      </div>
    </div>
  );
}
