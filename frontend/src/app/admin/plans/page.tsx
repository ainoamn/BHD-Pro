"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

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

const BASE_PLANS = [
  { id: "STARTER", nameAr: "بدائية", nameEn: "Starter", monthly: 5, yearly: 48 },
  {
    id: "PROFESSIONAL",
    nameAr: "محترفة",
    nameEn: "Professional",
    monthly: 15,
    yearly: 144,
  },
  {
    id: "ENTERPRISE",
    nameAr: "مؤسسية",
    nameEn: "Enterprise",
    monthly: 35,
    yearly: 336,
  },
];

const emptyForm = {
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

export default function AdminPlansPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api.getAdminOffers().then((res) => setOffers(res.data as Offer[]));

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
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
      setForm(emptyForm);
      await load();
    } catch {
      setError(en ? "Could not save offer" : "تعذر حفظ العرض");
    } finally {
      setSaving(false);
    }
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(en ? "en-GB" : "ar");
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.plans}</h1>
        <p className="text-sm text-slate-500 mt-1">{t.plansHint}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {BASE_PLANS.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs font-bold text-teal-700">{p.id}</p>
            <h3 className="text-lg font-extrabold mt-1 text-teal-950">
              {en ? p.nameEn : p.nameAr}
            </h3>
            <p className="text-sm text-slate-600 mt-2">
              {p.monthly} {en ? "OMR / mo" : "ر.ع / شهر"}
            </p>
            <p className="text-sm text-slate-400">
              {p.yearly} {en ? "OMR / yr" : "ر.ع / سنة"}
            </p>
          </div>
        ))}
      </div>

      <form
        onSubmit={onCreate}
        className="rounded-2xl border border-slate-200 bg-white p-4 grid md:grid-cols-3 gap-3"
      >
        <h2 className="md:col-span-3 font-bold text-teal-950">
          {en ? "Add offer / discount" : "إضافة عرض / تخفيض"}
        </h2>
        {error ? (
          <p className="md:col-span-3 text-sm text-rose-600">{error}</p>
        ) : null}
        <select
          value={form.plan}
          onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        >
          {BASE_PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {en ? p.nameEn : p.nameAr}
            </option>
          ))}
        </select>
        <input
          placeholder={en ? "Offer name (AR)" : "اسم العرض عربي"}
          value={form.nameAr}
          onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          required
        />
        <input
          placeholder={en ? "Offer name (EN)" : "اسم العرض إنجليزي"}
          value={form.nameEn}
          onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <input
          placeholder="Promo code"
          value={form.promoCode}
          onChange={(e) => setForm((f) => ({ ...f, promoCode: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono"
        />
        <input
          placeholder={en ? "Discount %" : "نسبة الخصم %"}
          value={form.discountPct}
          onChange={(e) =>
            setForm((f) => ({ ...f, discountPct: e.target.value }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <input
          placeholder={en ? "Alt monthly OMR" : "سعر شهري بديل"}
          value={form.monthlyPrice}
          onChange={(e) =>
            setForm((f) => ({ ...f, monthlyPrice: e.target.value }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <input
          placeholder={en ? "Alt yearly OMR" : "سعر سنوي بديل"}
          value={form.yearlyPrice}
          onChange={(e) =>
            setForm((f) => ({ ...f, yearlyPrice: e.target.value }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <label className="text-xs text-slate-500 space-y-1">
          <span>{en ? "Starts" : "يبدأ"}</span>
          <input
            type="date"
            value={form.startsAt}
            onChange={(e) =>
              setForm((f) => ({ ...f, startsAt: e.target.value }))
            }
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-500 space-y-1">
          <span>{en ? "Ends" : "ينتهي"}</span>
          <input
            type="date"
            value={form.endsAt}
            onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="md:col-span-3 rounded-xl bg-teal-700 hover:bg-teal-800 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {saving ? "…" : t.save}
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-start p-3">{en ? "Offer" : "العرض"}</th>
              <th className="text-start p-3">{t.plan}</th>
              <th className="text-start p-3">{en ? "Discount" : "خصم"}</th>
              <th className="text-start p-3">{en ? "Code" : "كود"}</th>
              <th className="text-start p-3">{en ? "Window" : "النافذة"}</th>
              <th className="text-start p-3">{t.status}</th>
              <th className="text-start p-3">{en ? "Action" : "إجراء"}</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-teal-950">
                  {en && o.nameEn ? o.nameEn : o.nameAr}
                </td>
                <td className="p-3">{o.plan}</td>
                <td className="p-3">{Number(o.discountPct)}%</td>
                <td className="p-3 font-mono text-xs">{o.promoCode || "—"}</td>
                <td className="p-3 text-xs text-slate-500">
                  {fmtDate(o.startsAt)} → {fmtDate(o.endsAt)}
                  {o.monthlyPrice != null || o.yearlyPrice != null ? (
                    <span className="block mt-0.5">
                      {o.monthlyPrice != null
                        ? `${Number(o.monthlyPrice)}/${en ? "mo" : "شهر"}`
                        : ""}
                      {o.yearlyPrice != null
                        ? ` · ${Number(o.yearlyPrice)}/${en ? "yr" : "سنة"}`
                        : ""}
                    </span>
                  ) : null}
                </td>
                <td className="p-3">
                  <span
                    className={`text-xs font-bold ${
                      o.isActive ? "text-emerald-700" : "text-slate-400"
                    }`}
                  >
                    {o.isActive ? t.active : t.inactive}
                  </span>
                </td>
                <td className="p-3 space-x-2 rtl:space-x-reverse">
                  <button
                    type="button"
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50"
                    onClick={async () => {
                      await api.updateAdminOffer(o.id, {
                        isActive: !o.isActive,
                      });
                      await load();
                    }}
                  >
                    {o.isActive ? (en ? "Pause" : "إيقاف") : (en ? "Enable" : "تفعيل")}
                  </button>
                  <button
                    type="button"
                    className="text-xs border border-rose-200 text-rose-700 rounded-lg px-2 py-1 hover:bg-rose-50"
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
          </tbody>
        </table>
        {offers.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">{t.empty}</p>
        )}
      </div>

      <p className="text-xs text-slate-400">
        <Link href="/admin/billing" className="text-teal-700 font-semibold underline">
          {t.billing}
        </Link>
      </p>
    </div>
  );
}
