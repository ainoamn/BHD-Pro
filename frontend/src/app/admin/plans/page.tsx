"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Plus, Save, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";
import { PermissionTree } from "@/components/admin/permission-tree";
import {
  PLAN_ACCESS_GROUPS,
  defaultGrantsForModule,
  defaultModulesFromLegacy,
  isChildGranted,
  normalizePlanAccess,
  planCardColor,
  type PlanAccessModule,
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

type MatrixRow =
  | { kind: "group"; id: string; labelAr: string; labelEn: string }
  | {
      kind: "module";
      module: PlanAccessModule;
      labelAr: string;
      labelEn: string;
    }
  | {
      kind: "child";
      module: PlanAccessModule;
      childCode: string;
      labelAr: string;
      labelEn: string;
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

function flattenAccessRows(): MatrixRow[] {
  const rows: MatrixRow[] = [];
  for (const g of PLAN_ACCESS_GROUPS) {
    rows.push({
      kind: "group",
      id: g.id,
      labelAr: g.labelAr,
      labelEn: g.labelEn,
    });
    for (const m of g.modules) {
      rows.push({
        kind: "module",
        module: m,
        labelAr: m.labelAr,
        labelEn: m.labelEn,
      });
      if (m.children?.length) {
        for (const c of m.children) {
          rows.push({
            kind: "child",
            module: m,
            childCode: c.code,
            labelAr: c.labelAr,
            labelEn: c.labelEn,
          });
        }
      }
    }
  }
  return rows;
}

export default function AdminPlansPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [form, setForm] = useState(emptyOffer);
  const [newPlan, setNewPlan] = useState(emptyNewPlan);
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [offerSaving, setOfferSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const matrixRows = useMemo(() => flattenAccessRows(), []);

  const load = async () => {
    const [p, o] = await Promise.all([api.getAdminPlans(), api.getAdminOffers()]);
    const list = p.data as PlanDef[];
    setPlans(list);
    const d: Record<string, Draft> = {};
    for (const row of list) d[row.code] = toDraft(row);
    setDrafts(d);
    setOffers(o.data as Offer[]);
    setSelectedCode((prev) => {
      if (prev && list.some((x) => x.code === prev)) return prev;
      return list[0]?.code ?? null;
    });
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

  const selectedPlan = plans.find((p) => p.code === selectedCode) ?? null;
  const selectedDraft = selectedCode ? drafts[selectedCode] : undefined;

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
      const createdCode = newPlan.code.trim().toUpperCase();
      setNewPlan(emptyNewPlan);
      await load();
      setSelectedCode(createdCode);
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

  const toggleMatrixModule = (planCode: string, m: PlanAccessModule, enabled: boolean) => {
    setDrafts((prev) => {
      const d = prev[planCode];
      if (!d) return prev;
      const cur = d.modules[m.code] || { enabled: false, transactionLimit: null };
      return {
        ...prev,
        [planCode]: {
          ...d,
          modules: {
            ...d.modules,
            [m.code]: {
              ...cur,
              enabled,
              grants: defaultGrantsForModule(m, enabled),
            },
          },
        },
      };
    });
  };

  const toggleMatrixChild = (
    planCode: string,
    m: PlanAccessModule,
    childCode: string,
    on: boolean,
  ) => {
    setDrafts((prev) => {
      const d = prev[planCode];
      if (!d) return prev;
      const cur = d.modules[m.code] || { enabled: true, transactionLimit: null };
      const base = cur.grants || defaultGrantsForModule(m, !!cur.enabled) || {};
      return {
        ...prev,
        [planCode]: {
          ...d,
          modules: {
            ...d.modules,
            [m.code]: {
              ...cur,
              enabled: true,
              grants: { ...base, [childCode]: on },
            },
          },
        },
      };
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
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.plans}</h1>
        <p className="text-sm text-slate-500 mt-1">
          {en
            ? "Select a plan card to edit names, prices, limits, and nested permissions. Use the matrix below for a side-by-side comparison."
            : "اختر بطاقة باقة لتعديل الأسماء والأسعار والحدود والصلاحيات المتداخلة. استخدم المصفوفة أدناه للمقارنة جنباً إلى جنب."}
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        {plans.map((p) => {
          const d = drafts[p.code];
          if (!d) return null;
          const colors = planCardColor(p.code);
          const selected = selectedCode === p.code;
          return (
            <button
              key={p.code}
              type="button"
              onClick={() => setSelectedCode(p.code)}
              className={cn(
                "text-start rounded-2xl border-2 p-4 transition shadow-sm",
                colors.bg,
                colors.border,
                selected
                  ? "ring-2 ring-offset-2 ring-teal-600 border-teal-600"
                  : "hover:shadow-md",
                !d.isActive && "opacity-70",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className={cn("font-extrabold text-base", colors.accent)}>
                    {en ? d.nameEn : d.nameAr}
                  </p>
                  <p className="text-[11px] font-mono text-slate-500 mt-0.5" dir="ltr">
                    {p.code}
                  </p>
                </div>
                {!d.isActive ? (
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200 px-1.5 py-0.5 rounded">
                    {en ? "Hidden" : "مخفي"}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 space-y-1 text-xs text-slate-700">
                <p>
                  <span className="font-bold" dir="ltr">
                    {d.monthlyPrice}
                  </span>{" "}
                  {en ? "/ mo" : "/ شهر"}
                  <span className="text-slate-400 mx-1">·</span>
                  <span className="font-bold" dir="ltr">
                    {d.yearlyPrice}
                  </span>{" "}
                  {en ? "/ yr" : "/ سنة"}
                </p>
                <p>
                  {en ? "Invoices" : "فواتير"}:{" "}
                  <span className="font-bold" dir="ltr">
                    {d.invoicesLimit}
                  </span>
                  <span className="text-slate-400 mx-1">·</span>
                  {en ? "Users" : "مستخدمون"}:{" "}
                  <span className="font-bold" dir="ltr">
                    {d.usersLimit}
                  </span>
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected plan editor */}
      {selectedPlan && selectedDraft ? (
        <div
          className={cn(
            "rounded-2xl border bg-white p-4 sm:p-5 space-y-4",
            selectedDraft.isActive ? "border-slate-200" : "border-amber-200 bg-amber-50/30",
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-extrabold text-teal-950 text-lg">
                {en ? selectedDraft.nameEn : selectedDraft.nameAr}{" "}
                <span className="text-xs font-mono text-slate-500" dir="ltr">
                  {selectedPlan.code}
                </span>
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              <button
                type="button"
                onClick={() =>
                  patchDraft(selectedPlan.code, {
                    isActive: !selectedDraft.isActive,
                  })
                }
                className="text-slate-700 hover:underline"
              >
                {selectedDraft.isActive
                  ? en
                    ? "Hide from catalog"
                    : "إخفاء من الكتالوج"
                  : en
                    ? "Show in catalog"
                    : "إظهار في الكتالوج"}
              </button>
              <button
                type="button"
                onClick={() => void deletePlan(selectedPlan.code, selectedPlan.isSystem)}
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
                ["nameAr", en ? "Name AR" : "الاسم عربي", selectedDraft.nameAr],
                ["nameEn", en ? "Name EN" : "الاسم إنجليزي", selectedDraft.nameEn],
                ["monthlyPrice", en ? "Monthly" : "شهري", selectedDraft.monthlyPrice],
                ["yearlyPrice", en ? "Yearly" : "سنوي", selectedDraft.yearlyPrice],
                [
                  "invoicesLimit",
                  en ? "Invoices/mo" : "فواتير/شهر",
                  selectedDraft.invoicesLimit,
                ],
                ["usersLimit", en ? "Users" : "مستخدمون", selectedDraft.usersLimit],
              ] as const
            ).map(([key, label, val]) => (
              <label key={key} className="text-xs space-y-1">
                <span className="text-slate-500">{label}</span>
                <input
                  type={typeof val === "number" ? "number" : "text"}
                  value={val as string | number}
                  onChange={(e) =>
                    patchDraft(selectedPlan.code, {
                      [key]:
                        typeof val === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                    } as Partial<Draft>)
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedDraft.isActive}
              onChange={(e) =>
                patchDraft(selectedPlan.code, { isActive: e.target.checked })
              }
              className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            {en ? "Active in catalog" : "نشط في الكتالوج"}
          </label>

          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">
              {en
                ? "Allowed pages & apps (checkbox = included)"
                : "الصفحات والأنظمة المسموحة (علامة صح = مفعّل)"}
            </p>
            <PermissionTree
              en={en}
              showLimits
              value={selectedDraft.modules}
              onChange={(modules) =>
                patchDraft(selectedPlan.code, { modules })
              }
            />
          </div>

          <button
            type="button"
            disabled={savingCode === selectedPlan.code}
            onClick={() => void savePlan(selectedPlan.code)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {savingCode === selectedPlan.code ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {en ? "Save plan" : "حفظ الباقة"}
          </button>
        </div>
      ) : null}

      {/* Comparison matrix */}
      <div className="space-y-3">
        <h2 className="font-extrabold text-lg">
          {en ? "Permissions comparison" : "مقارنة الصلاحيات"}
        </h2>
        <div className="overflow-auto max-h-[32rem] rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50">
                <th
                  className={cn(
                    "sticky top-0 z-20 bg-slate-50 border-b border-slate-200 px-3 py-2.5 text-start font-extrabold text-slate-700 min-w-[14rem]",
                    en ? "left-0" : "right-0",
                  )}
                >
                  {en ? "Permission" : "الصلاحية"}
                </th>
                {plans.map((p) => {
                  const colors = planCardColor(p.code);
                  return (
                    <th
                      key={p.code}
                      className={cn(
                        "sticky top-0 z-10 border-b border-slate-200 px-3 py-2.5 text-center font-extrabold whitespace-nowrap",
                        colors.bg,
                        colors.accent,
                      )}
                    >
                      {en ? drafts[p.code]?.nameEn || p.nameEn : drafts[p.code]?.nameAr || p.nameAr}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row) => {
                if (row.kind === "group") {
                  return (
                    <tr key={`g-${row.id}`} className="bg-slate-100/80">
                      <td
                        colSpan={plans.length + 1}
                        className={cn(
                          "sticky z-[15] bg-slate-100/95 border-b border-slate-200 px-3 py-2 font-extrabold text-teal-950 text-xs uppercase tracking-wide",
                          en ? "left-0" : "right-0",
                        )}
                      >
                        {en ? row.labelEn : row.labelAr}
                      </td>
                    </tr>
                  );
                }

                if (row.kind === "module") {
                  return (
                    <tr key={`m-${row.module.code}`} className="hover:bg-slate-50/60">
                      <td
                        className={cn(
                          "sticky z-10 bg-white border-b border-slate-100 px-3 py-2 font-semibold text-slate-800",
                          en ? "left-0" : "right-0",
                        )}
                      >
                        {en ? row.labelEn : row.labelAr}
                      </td>
                      {plans.map((p) => {
                        const d = drafts[p.code];
                        const enabled = !!d?.modules[row.module.code]?.enabled;
                        return (
                          <td
                            key={p.code}
                            className="border-b border-slate-100 px-3 py-2 text-center"
                          >
                            <input
                              type="checkbox"
                              checked={enabled}
                              onChange={(e) =>
                                toggleMatrixModule(
                                  p.code,
                                  row.module,
                                  e.target.checked,
                                )
                              }
                              className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                              aria-label={`${p.code} ${row.module.code}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  );
                }

                // child row
                return (
                  <tr key={`c-${row.module.code}-${row.childCode}`} className="hover:bg-slate-50/40">
                    <td
                      className={cn(
                        "sticky z-10 bg-white border-b border-slate-100 py-1.5 text-xs text-slate-600",
                        en ? "left-0 ps-8 pe-3" : "right-0 pe-8 ps-3",
                      )}
                    >
                      {en ? row.labelEn : row.labelAr}
                    </td>
                    {plans.map((p) => {
                      const d = drafts[p.code];
                      const checked = isChildGranted(
                        d?.modules,
                        row.module.code,
                        row.childCode,
                      );
                      const parentOn = !!d?.modules[row.module.code]?.enabled;
                      return (
                        <td
                          key={p.code}
                          className="border-b border-slate-100 px-3 py-1.5 text-center"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!parentOn}
                            onChange={(e) =>
                              toggleMatrixChild(
                                p.code,
                                row.module,
                                row.childCode,
                                e.target.checked,
                              )
                            }
                            className="rounded border-slate-300 text-teal-700 focus:ring-teal-600 disabled:opacity-40"
                            aria-label={`${p.code} ${row.module.code}.${row.childCode}`}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500">
          {en
            ? "Matrix edits update drafts only — open a plan and click Save to persist."
            : "تعديلات المصفوفة تحدّث المسودة فقط — افتح الباقة واضغط حفظ للحفظ النهائي."}
        </p>
      </div>

      {/* Add plan */}
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

      {/* Promo offers */}
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
