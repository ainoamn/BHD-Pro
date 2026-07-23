"use client";

import { FormEvent, useEffect, useState } from "react";
import api from "@/lib/api";

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
  { id: "STARTER", nameAr: "بدائية", monthly: 5, yearly: 48 },
  { id: "PROFESSIONAL", nameAr: "محترفة", monthly: 15, yearly: 144 },
  { id: "ENTERPRISE", nameAr: "مؤسسية", monthly: 35, yearly: 336 },
];

export default function AdminPlansPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [form, setForm] = useState({
    plan: "STARTER",
    nameAr: "",
    nameEn: "",
    discountPct: "10",
    promoCode: "",
    monthlyPrice: "",
    yearlyPrice: "",
  });

  const load = () => api.getAdminOffers().then((res) => setOffers(res.data as Offer[]));

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    await api.createAdminOffer({
      plan: form.plan,
      nameAr: form.nameAr || `عرض ${form.plan}`,
      nameEn: form.nameEn || `${form.plan} offer`,
      discountPct: Number(form.discountPct) || 0,
      promoCode: form.promoCode || undefined,
      monthlyPrice: form.monthlyPrice ? Number(form.monthlyPrice) : undefined,
      yearlyPrice: form.yearlyPrice ? Number(form.yearlyPrice) : undefined,
      isActive: true,
    });
    setForm({
      plan: "STARTER",
      nameAr: "",
      nameEn: "",
      discountPct: "10",
      promoCode: "",
      monthlyPrice: "",
      yearlyPrice: "",
    });
    await load();
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold">الباقات والعروض</h2>
        <p className="text-sm text-slate-400">أسعار الأساس ثابتة في الكود — العروض والخصومات تُدار من هنا</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        {BASE_PLANS.map((p) => (
          <div key={p.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <p className="text-xs text-emerald-400">{p.id}</p>
            <h3 className="text-lg font-bold mt-1">{p.nameAr}</h3>
            <p className="text-sm text-slate-300 mt-2">{p.monthly} ر.ع / شهر</p>
            <p className="text-sm text-slate-500">{p.yearly} ر.ع / سنة</p>
          </div>
        ))}
      </div>

      <form onSubmit={onCreate} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 grid md:grid-cols-3 gap-3">
        <h3 className="md:col-span-3 font-semibold">إضافة عرض / تخفيض</h3>
        <select
          value={form.plan}
          onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        >
          {BASE_PLANS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nameAr}
            </option>
          ))}
        </select>
        <input
          placeholder="اسم العرض عربي"
          value={form.nameAr}
          onChange={(e) => setForm((f) => ({ ...f, nameAr: e.target.value }))}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
          required
        />
        <input
          placeholder="Promo code"
          value={form.promoCode}
          onChange={(e) => setForm((f) => ({ ...f, promoCode: e.target.value }))}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        />
        <input
          placeholder="نسبة الخصم %"
          value={form.discountPct}
          onChange={(e) => setForm((f) => ({ ...f, discountPct: e.target.value }))}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        />
        <input
          placeholder="سعر شهري بديل (اختياري)"
          value={form.monthlyPrice}
          onChange={(e) => setForm((f) => ({ ...f, monthlyPrice: e.target.value }))}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        />
        <input
          placeholder="سعر سنوي بديل (اختياري)"
          value={form.yearlyPrice}
          onChange={(e) => setForm((f) => ({ ...f, yearlyPrice: e.target.value }))}
          className="rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm"
        />
        <button type="submit" className="md:col-span-3 rounded-lg bg-emerald-600 py-2 text-sm font-semibold">
          حفظ العرض
        </button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs">
            <tr>
              <th className="text-right p-3">العرض</th>
              <th className="text-right p-3">الباقة</th>
              <th className="text-right p-3">خصم</th>
              <th className="text-right p-3">كود</th>
              <th className="text-right p-3">أسعار بديلة</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-right p-3">إجراء</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((o) => (
              <tr key={o.id} className="border-t border-slate-800">
                <td className="p-3 font-semibold">{o.nameAr}</td>
                <td className="p-3">{o.plan}</td>
                <td className="p-3">{Number(o.discountPct)}%</td>
                <td className="p-3 font-mono text-xs">{o.promoCode || "—"}</td>
                <td className="p-3 text-xs text-slate-400">
                  {o.monthlyPrice != null ? `${Number(o.monthlyPrice)}/شهر` : "—"}{" "}
                  {o.yearlyPrice != null ? `· ${Number(o.yearlyPrice)}/سنة` : ""}
                </td>
                <td className="p-3">{o.isActive ? "نشط" : "متوقف"}</td>
                <td className="p-3 space-x-2 space-x-reverse">
                  <button
                    type="button"
                    className="text-xs border border-slate-600 rounded px-2 py-1"
                    onClick={async () => {
                      await api.updateAdminOffer(o.id, { isActive: !o.isActive });
                      await load();
                    }}
                  >
                    {o.isActive ? "إيقاف" : "تفعيل"}
                  </button>
                  <button
                    type="button"
                    className="text-xs border border-red-800 text-red-300 rounded px-2 py-1"
                    onClick={async () => {
                      await api.deleteAdminOffer(o.id);
                      await load();
                    }}
                  >
                    حذف
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {offers.length === 0 && (
          <p className="p-6 text-center text-sm text-slate-500">لا توجد عروض بعد.</p>
        )}
      </div>
    </div>
  );
}
