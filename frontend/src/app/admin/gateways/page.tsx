"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Gateway = {
  slug: string;
  nameAr: string;
  nameEn: string;
  isEnabled: boolean;
  isTestMode: boolean;
  configJson: Record<string, string>;
};

export default function AdminGatewaysPage() {
  const [rows, setRows] = useState<Gateway[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.getAdminPaymentGateways();
      setRows(res.data as Gateway[]);
      setError(null);
    } catch {
      setError("تعذر تحميل بوابات الدفع — تأكد أن حسابك مشرف منصة وبدور ADMIN في شركته.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold">بوابات دفع الاشتراك</h2>
        <p className="text-sm text-slate-400">تفعيل Stripe / Thawani / PayPal لاشتراكات المنصة</p>
      </div>
      {error && <p className="text-amber-400 text-sm">{error}</p>}
      <div className="space-y-3">
        {rows.map((g) => (
          <div
            key={g.slug}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex flex-wrap items-center justify-between gap-3"
          >
            <div>
              <p className="font-semibold">{g.nameAr}</p>
              <p className="text-xs text-slate-500">{g.slug} · {g.isTestMode ? "وضع تجريبي" : "إنتاج"}</p>
            </div>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                g.isEnabled ? "bg-emerald-600" : "bg-slate-700"
              }`}
              onClick={async () => {
                await api.updateAdminPaymentGateway(g.slug, { isEnabled: !g.isEnabled });
                await load();
              }}
            >
              {g.isEnabled ? "مفعّلة" : "معطّلة"}
            </button>
          </div>
        ))}
        {rows.length === 0 && !error && (
          <p className="text-sm text-slate-500">لا توجد بوابات بعد.</p>
        )}
      </div>
    </div>
  );
}
