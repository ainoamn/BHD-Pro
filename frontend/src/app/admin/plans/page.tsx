"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Lock, Plus, Save, Trash2, Unlock } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import { cn } from "@/lib/utils";

type PlanFeatures = Record<string, boolean>;

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
  features: PlanFeatures;
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
  monthlyPrice: string | number | null;
  yearlyPrice: string | number | null;
  startsAt: string | null;
  endsAt: string | null;
};

const FEATURE_KEYS = [
  "accounting",
  "inventory",
  "pos",
  "resto",
  "aiAnalytics",
  "multiBranch",
  "apiKeys",
  "advancedReports",
] as const;

const emptyOffer = {
  plan: "STARTER",
  nameAr: "",
  nameEn: "",
  discountPct: "10",
  promoCode: "",
  monthlyPrice: "",
  yearlyPrice: "",
  startsAt: "",
  endsAt: "",
};

const emptyNewPlan = {
  code: "",
  nameAr: "",
  nameEn: "",
  monthlyPrice: "10",
  yearlyPrice: "96",
  invoicesLimit: "100",
  usersLimit: "5",
  support: "email",
};

export default function AdminPlansPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [plans, setPlans] = useState<PlanDef[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState(emptyOffer);
  const [newPlan, setNewPlan] = useState(emptyNewPlan);
  const [drafts, setDrafts] = useState<Record<string, PlanDef>>({});
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [offerSaving, setOfferSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const featureLabels = useMemo(
    () =>
      ({
        accounting: en ? "Accounting" : "المحاسبة",
        inventory: en ? "Inventory" : "المخزون",
        pos: en ? "POS" : "الكاشير",
        resto: en ? "Restaurants" : "المطاعم",
        aiAnalytics: en ? "AI Analytics" : "تحليلات AI",
        multiBranch: en ? "Multi-branch" : "فروع متعددة",
        apiKeys: en ? "API keys" : "مفاتيح API",
        advancedReports: en ? "Advanced reports" : "تقارير متقدمة",
      }) as Record<string, string>,
    [en],
  );

  const load = async () => {
    const [p, o] = await Promise.all([
      api.getAdminPlans(),
      api.getAdminOffers(),
    ]);
    const list = p.data as PlanDef[];
    setPlans(list);
    const d: Record<string, PlanDef> = {};
    for (const row of list) d[row.code] = { ...row, features: { ...row.features } };
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

  const patchDraft = (code: string, patch: Partial<PlanDef>) => {
    setDrafts((prev) => ({
      ...prev,
      [code]: { ...prev[code], ...patch },
    }));
  };

  const toggleFeature = (code: string, key: string) => {
    setDrafts((prev) => {
      const row = prev[code];
      if (!row) return prev;
      return {
        ...prev,
        [code]: {
          ...row,
          features: { ...row.features, [key]: !row.features?.[key] },
        },
      };
    });
  };

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
        support: d.support,
        features: d.features,
        isActive: d.isActive,
        sortOrder: d.sortOrder,
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
        support: newPlan.support || "email",
        features: {
          accounting: true,
          inventory: true,
          pos: false,
          resto: false,
          aiAnalytics: false,
          multiBranch: false,
          apiKeys: false,
          advancedReports: false,
        },
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
          ? "System plans cannot be deleted — deactivate or lock features instead"
          : "لا يمكن حذف الباقات الأساسية — عطّلها أو اقفل الخصائص",
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
    setError("");
    try {
      await api.createAdminOffer({
        plan: form.plan,
        nameAr: form.nameAr || (en ? `${form.plan} offer` : `عرض ${form.plan}`),
        nameEn: form.nameEn || `${form.plan} offer`,
        discountPct: Number(form.discountPct) || 0,
        promoCode: form.promoCode || undefined,
        monthlyPrice: form.monthlyPrice ? Number(form.monthlyPrice) : undefined,
        yearlyPrice: form.yearlyPrice ? Number(form.yearlyPrice) : undefined,
        startsAt: form.startsAt || undefined,
        endsAt: form.endsAt || undefined,
        isActive: true,
      });
      setForm(emptyOffer);
      await load();
    } catch {
      setError(en ? "Could not save offer" : "تعذر حفظ العرض");
    } finally {
      setOfferSaving(false);
    }
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(en ? "en-GB" : "ar");
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
            ? "Edit prices and lock/unlock product features per plan. Locked features show Upgrade in the company app."
            : "عدّل الأسعار واقفل/افتح خصائص النظام لكل باقة. الخصائص المقفلة تظهر «ترقية» في حساب الشركة."}
        </p>
      </div>

      <div className="space-y-4">
        {plans.map((p) => {
          const d = drafts[p.code] || p;
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
                  <p className="text-xs text-slate-500">
                    {p.isSystem
                      ? en
                        ? "System plan"
                        : "باقة أساسية"
                      : en
                        ? "Custom plan"
                        : "باقة مخصصة"}
                    {" · "}
                    {d.isActive
                      ? en
                        ? "Active in catalog"
                        : "ظاهرة في الكتالوج"
                      : en
                        ? "Hidden"
                        : "مخفية"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => patchDraft(p.code, { isActive: !d.isActive })}
                    className="text-xs font-bold text-slate-700 hover:underline"
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
                    className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:underline"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {en ? "Delete" : "حذف"}
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{en ? "Name (AR)" : "الاسم عربي"}</span>
                  <input
                    value={d.nameAr}
                    onChange={(e) => patchDraft(p.code, { nameAr: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{en ? "Name (EN)" : "الاسم إنجليزي"}</span>
                  <input
                    value={d.nameEn}
                    onChange={(e) => patchDraft(p.code, { nameEn: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{en ? "Monthly OMR" : "شهري ر.ع"}</span>
                  <input
                    type="number"
                    value={d.monthlyPrice}
                    onChange={(e) =>
                      patchDraft(p.code, { monthlyPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{en ? "Yearly OMR" : "سنوي ر.ع"}</span>
                  <input
                    type="number"
                    value={d.yearlyPrice}
                    onChange={(e) =>
                      patchDraft(p.code, { yearlyPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{en ? "Invoices/mo (-1=∞)" : "فواتير/شهر (-1=∞)"}</span>
                  <input
                    type="number"
                    value={d.invoicesLimit}
                    onChange={(e) =>
                      patchDraft(p.code, { invoicesLimit: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="text-xs space-y-1">
                  <span className="text-slate-500">{en ? "Users (-1=∞)" : "مستخدمون (-1=∞)"}</span>
                  <input
                    type="number"
                    value={d.usersLimit}
                    onChange={(e) =>
                      patchDraft(p.code, { usersLimit: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-600 mb-2">
                  {en
                    ? "Features — unlocked = included, locked = shows Upgrade"
                    : "الخصائص — مفتوحة = مشمولة، مقفولة = تظهر ترقية"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {FEATURE_KEYS.map((key) => {
                    const on = !!d.features?.[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => toggleFeature(p.code, key)}
                        className={cn(
                          "inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border",
                          on
                            ? "bg-emerald-600 text-white border-emerald-600"
                            : "bg-amber-50 text-amber-900 border-amber-300",
                        )}
                        title={
                          on
                            ? en
                              ? "Included — click to lock"
                              : "مشمولة — اضغط للقفل"
                            : en
                              ? "Locked — click to unlock"
                              : "مقفولة — اضغط للفتح"
                        }
                      >
                        {on ? <Unlock className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
                        {featureLabels[key]}
                        <span className="opacity-80">
                          {on
                            ? en
                              ? "open"
                              : "مفتوحة"
                            : en
                              ? "upgrade"
                              : "ترقية"}
                        </span>
                      </button>
                    );
                  })}
                </div>
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

      <div className="rounded-2xl border border-dashed border-teal-300 bg-teal-50/40 p-4 sm:p-5 space-y-3">
        <h2 className="font-bold flex items-center gap-2 text-teal-950">
          <Plus className="w-4 h-4" />
          {en ? "Add plan" : "إضافة باقة"}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <input
            dir="ltr"
            value={newPlan.code}
            onChange={(e) =>
              setNewPlan((f) => ({ ...f, code: e.target.value.toUpperCase() }))
            }
            placeholder="CODE (e.g. GROWTH)"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          />
          <input
            value={newPlan.nameAr}
            onChange={(e) => setNewPlan((f) => ({ ...f, nameAr: e.target.value }))}
            placeholder={en ? "Arabic name" : "الاسم بالعربي"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          />
          <input
            value={newPlan.nameEn}
            onChange={(e) => setNewPlan((f) => ({ ...f, nameEn: e.target.value }))}
            placeholder={en ? "English name" : "الاسم بالإنجليزي"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          />
          <input
            type="number"
            value={newPlan.monthlyPrice}
            onChange={(e) => setNewPlan((f) => ({ ...f, monthlyPrice: e.target.value }))}
            placeholder={en ? "Monthly" : "شهري"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          />
          <input
            type="number"
            value={newPlan.yearlyPrice}
            onChange={(e) => setNewPlan((f) => ({ ...f, yearlyPrice: e.target.value }))}
            placeholder={en ? "Yearly" : "سنوي"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white"
          />
        </div>
        <button
          type="button"
          disabled={creating || !newPlan.code.trim() || !newPlan.nameAr.trim()}
          onClick={() => void createPlan()}
          className="rounded-xl bg-teal-700 text-white px-4 py-2.5 text-sm font-bold disabled:opacity-50"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin inline" /> : null}{" "}
          {en ? "Create plan" : "إنشاء الباقة"}
        </button>
      </div>

      <div className="space-y-4 border-t border-slate-200 pt-6">
        <h2 className="text-lg font-extrabold">{en ? "Offers / discounts" : "العروض والتخفيضات"}</h2>
        <form
          onSubmit={onCreateOffer}
          className="rounded-2xl border border-slate-200 bg-white p-4 grid sm:grid-cols-2 gap-3"
        >
          <select
            value={form.plan}
            onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          >
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {en ? p.nameEn : p.nameAr}
              </option>
            ))}
          </select>
          <input
            value={form.nameAr}
            onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
            placeholder={en ? "Offer name AR" : "اسم العرض عربي"}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            value={form.promoCode}
            onChange={(e) =>
              setForm((f) => ({ ...f, promoCode: e.target.value.toUpperCase() }))
            }
            placeholder="Promo code"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
            dir="ltr"
          />
          <input
            value={form.discountPct}
            onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
            placeholder="%"
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={offerSaving}
            className="sm:col-span-2 rounded-xl bg-teal-700 text-white py-2.5 text-sm font-bold disabled:opacity-50"
          >
            {en ? "Save offer" : "حفظ العرض"}
          </button>
          {error ? <p className="text-sm text-rose-600 sm:col-span-2">{error}</p> : null}
        </form>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-start p-3">{en ? "Offer" : "العرض"}</th>
                <th className="text-start p-3">{en ? "Plan" : "الباقة"}</th>
                <th className="text-start p-3">%</th>
                <th className="text-start p-3">{en ? "Code" : "الرمز"}</th>
                <th className="text-start p-3">{en ? "Status" : "الحالة"}</th>
                <th className="text-start p-3">{t.actions}</th>
              </tr>
            </thead>
            <tbody>
              {offers.map((o) => (
                <tr key={o.id} className="border-t border-slate-100">
                  <td className="p-3 font-semibold">{en ? o.nameEn : o.nameAr}</td>
                  <td className="p-3">{o.plan}</td>
                  <td className="p-3">{Number(o.discountPct)}%</td>
                  <td className="p-3 font-mono" dir="ltr">
                    {o.promoCode || "—"}
                  </td>
                  <td className="p-3">{o.isActive ? t.active : t.inactive}</td>
                  <td className="p-3">
                    <button
                      type="button"
                      className="text-rose-700 font-bold text-xs"
                      onClick={async () => {
                        await api.deleteAdminOffer(o.id);
                        await load();
                      }}
                    >
                      {en ? "Delete" : "حذف"}
                    </button>
                  </td>
                </tr>
              ))}
              {offers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-slate-500">
                    {t.empty}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          {en ? "Dates" : "التواريخ"}: {fmtDate(null)} ·{" "}
          <Link href="/admin/billing" className="text-teal-700 font-semibold underline">
            {t.billing}
          </Link>
        </p>
      </div>
    </div>
  );
}
