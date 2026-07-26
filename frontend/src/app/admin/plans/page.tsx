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
  planCardColor,
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
    p.modules
      ? { modules: p.modules as unknown as Record<string, unknown> }
      : (p.features as Record<string, unknown>),
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

  const patchDraft = (code: string, patch: Partial<Draft>) => {
    setDrafts((prev) => {
      const cur = prev[code];
      if (!cur) return prev;
      return { ...prev, [code]: { ...cur, ...patch } };
    });
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
    <div className="space-y-8 max-w-[100rem]">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.plans}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Each plan is a full column — scroll sideways to compare names, prices, limits, and every permission side by side."
            : "كل باقة عمود كامل — مرّر أفقياً لمقارنة الأسماء والأسعار والحدود وكل الصلاحيات جنباً إلى جنب."}
        </p>
      </div>

      {/* Side-by-side plan columns */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="flex gap-4 min-w-min items-start">
          {plans.map((p) => {
            const d = drafts[p.code];
            if (!d) return null;
            const colors = planCardColor(p.code);
            return (
              <section
                key={p.code}
                className={cn(
                  "w-[min(100vw-2rem,22rem)] sm:w-[22rem] shrink-0 rounded-2xl border-2 bg-white shadow-sm flex flex-col max-h-[min(88vh,56rem)]",
                  colors.border,
                  !d.isActive && "opacity-85",
                )}
              >
                <div className={cn("rounded-t-[0.9rem] p-4 border-b border-slate-100", colors.bg)}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className={cn("font-extrabold text-lg truncate", colors.accent)}>
                        {en ? d.nameEn : d.nameAr}
                      </p>
                      <p className="text-[11px] font-mono text-slate-500 mt-0.5" dir="ltr">
                        {p.code}
                      </p>
                    </div>
                    {!d.isActive ? (
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">
                        {en ? "Hidden" : "مخفي"}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {(
                      [
                        ["nameAr", en ? "Name AR" : "الاسم عربي", d.nameAr, "text"],
                        ["nameEn", en ? "Name EN" : "الاسم إنجليزي", d.nameEn, "text"],
                        ["monthlyPrice", en ? "Monthly" : "شهري", d.monthlyPrice, "number"],
                        ["yearlyPrice", en ? "Yearly" : "سنوي", d.yearlyPrice, "number"],
                        [
                          "invoicesLimit",
                          en ? "Invoices/mo" : "فواتير/شهر",
                          d.invoicesLimit,
                          "number",
                        ],
                        ["usersLimit", en ? "Users" : "مستخدمون", d.usersLimit, "number"],
                      ] as const
                    ).map(([key, label, val, kind]) => (
                      <label key={key} className="text-[10px] space-y-0.5 col-span-1">
                        <span className="text-slate-500 font-bold">{label}</span>
                        <input
                          type={kind}
                          value={val as string | number}
                          onChange={(e) =>
                            patchDraft(p.code, {
                              [key]:
                                kind === "number"
                                  ? Number(e.target.value)
                                  : e.target.value,
                            } as Partial<Draft>)
                          }
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.isActive}
                        onChange={(e) =>
                          patchDraft(p.code, { isActive: e.target.checked })
                        }
                        className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                      />
                      {en ? "Active" : "نشط"}
                    </label>
                    <button
                      type="button"
                      onClick={() => void deletePlan(p.code, p.isSystem)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 hover:underline ms-auto"
                    >
                      <Trash2 className="w-3 h-3" />
                      {en ? "Delete" : "حذف"}
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    {en ? "Permissions" : "الصلاحيات"}
                  </p>
                  <PermissionTree
                    en={en}
                    showLimits
                    compact
                    value={d.modules}
                    onChange={(modules) => patchDraft(p.code, { modules })}
                  />
                </div>

                <div className="p-3 border-t border-slate-100">
                  <button
                    type="button"
                    disabled={savingCode === p.code}
                    onClick={() => void savePlan(p.code)}
                    className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-3 py-2.5 text-sm font-bold disabled:opacity-50"
                  >
                    {savingCode === p.code ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {en ? "Save plan" : "حفظ الباقة"}
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Add plan */}
      <div className="rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-4 space-y-3">
        <h2 className="font-bold flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {en ? "Add plan" : "إضافة باقة"}
        </h2>
        <div className="grid sm:grid-cols-3 gap-2 max-w-3xl">
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
            className="rounded-xl bg-teal-700 text-white text-sm font-bold disabled:opacity-50 py-2"
          >
            {en ? "Create" : "إنشاء"}
          </button>
        </div>
      </div>

      {/* Promo offers */}
      <div className="space-y-3 border-t pt-6">
        <h2 className="font-extrabold">{en ? "Promo offers" : "عروض التخفيض"}</h2>
        <form onSubmit={onCreateOffer} className="grid sm:grid-cols-4 gap-2 max-w-3xl">
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
        <ul className="text-sm space-y-1 max-w-3xl">
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
