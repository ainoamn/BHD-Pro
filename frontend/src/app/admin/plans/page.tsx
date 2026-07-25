"use client";

import { FormEvent, useEffect, useState } from "react";
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

function toDateInput(v: string | null) {
  if (!v) return "";
  return v.slice(0, 10);
}

export default function AdminPlansPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = () =>
    api.getAdminOffers().then((res) => setOffers(res.data as Offer[]));

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createAdminOffer({
        plan: form.plan,
        nameAr: form.nameAr || `عرض ${form.plan}`,
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
          {t.plans}
        </h1>
        <p className="text-sm text-slate-500 mt-1">{t.plansHint}</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {BASE_PLANS.map((p) => (
          <div
            key={p.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <p className="text-xs font-bold text-teal-700">{p.id}</p>
            <h3 className="text-lg font-extrabold mt-1 text-slate-900">
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
        <h3 className="md:col-span-3 font-bold text-slate-900">{t.addOffer}</h3>
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
          placeholder={t.offerNameAr}
          value={form.nameAr}
          onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          required
        />
        <input
          placeholder={t.offerNameEn}
          value={form.nameEn}
          onChange={(e) => setForm((f) => ({ ...f, nameEn: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <input
          placeholder={t.promoCode}
          value={form.promoCode}
          onChange={(e) => setForm((f) => ({ ...f, promoCode: e.target.value }))}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <input
          placeholder={t.discountPct}
          value={form.discountPct}
          onChange={(e) =>
            setForm((f) => ({ ...f, discountPct: e.target.value }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <input
          placeholder={t.altMonthly}
          value={form.monthlyPrice}
          onChange={(e) =>
            setForm((f) => ({ ...f, monthlyPrice: e.target.value }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <input
          placeholder={t.altYearly}
          value={form.yearlyPrice}
          onChange={(e) =>
            setForm((f) => ({ ...f, yearlyPrice: e.target.value }))
          }
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
        />
        <label className="text-xs text-slate-500 space-y-1">
          <span>{t.startsAt}</span>
          <input
            type="date"
            value={form.startsAt}
            onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-xs text-slate-500 space-y-1">
          <span>{t.endsAt}</span>
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
          className="md:col-span-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {t.save}
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-start p-3">{t.offer}</th>
              <th className="text-start p-3">{t.plan}</th>
              <th className="text-start p-3">{t.discount}</th>
              <th className="text-start p-3">{t.promoCode}</th>
              <th className="text-start p-3">{t.window}</th>
              <th className="text-start p-3">{t.status}</th>
              <th className="text-start p-3">{t.action}</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-slate-100">
                <td className="p-3 font-semibold text-slate-900">
                  {en && o.nameEn ? o.nameEn : o.nameAr}
                </td>
                <td className="p-3">{o.plan}</td>
                <td className="p-3">{Number(o.discountPct)}%</td>
                <td className="p-3 font-mono text-xs">{o.promoCode || "—"}</td>
                <td className="p-3 text-xs text-slate-500">
                  {toDateInput(o.startsAt) || "—"} → {toDateInput(o.endsAt) || "—"}
                </td>
                <td className="p-3">
                  {o.isActive ? (
                    <span className="text-emerald-700 font-semibold">{t.active}</span>
                  ) : (
                    <span className="text-slate-400">{t.inactive}</span>
                  )}
                </td>
                <td className="p-3 space-x-2 rtl:space-x-reverse">
                  <button
                    type="button"
                    className="text-xs border border-slate-200 rounded-lg px-2 py-1 hover:bg-slate-50"
                    onClick={async () => {
                      await api.updateAdminOffer(o.id, { isActive: !o.isActive });
                      await load();
                    }}
                  >
                    {o.isActive ? t.deactivate : t.activate}
                  </button>
                  <button
                    type="button"
                    className="text-xs border border-rose-200 text-rose-700 rounded-lg px-2 py-1 hover:bg-rose-50"
                    onClick={async () => {
                      await api.deleteAdminOffer(o.id);
                      await load();
                    }}
                  >
                    {t.delete}
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
    </div>
  );
}
