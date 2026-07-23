"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Bill = {
  id: string;
  number: string;
  description: string;
  amount: string | number;
  currency: string;
  status: string;
  gatewaySlug: string | null;
  paidAt: string | null;
  createdAt: string;
  company: { name: string; email: string | null; plan: string };
};

export default function AdminBillingPage() {
  const [rows, setRows] = useState<Bill[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.getAdminBilling(status || undefined).then((res) => setRows(res.data as Bill[]));
  }, [status]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold">مدفوعات اشتراك المنصة</h2>
          <p className="text-sm text-slate-400">فواتير BillingInvoice لغرض SUBSCRIPTION</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        >
          <option value="">الكل</option>
          <option value="PAID">مدفوع</option>
          <option value="PENDING">معلّق</option>
          <option value="FAILED">فشل</option>
          <option value="CANCELLED">ملغى</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900 text-slate-400 text-xs">
            <tr>
              <th className="text-right p-3">الرقم</th>
              <th className="text-right p-3">الشركة</th>
              <th className="text-right p-3">الوصف</th>
              <th className="text-right p-3">المبلغ</th>
              <th className="text-right p-3">البوابة</th>
              <th className="text-right p-3">الحالة</th>
              <th className="text-right p-3">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-slate-800">
                <td className="p-3 font-mono text-xs">{b.number}</td>
                <td className="p-3">
                  {b.company.name}
                  <div className="text-[10px] text-slate-500">{b.company.plan}</div>
                </td>
                <td className="p-3 text-slate-300">{b.description}</td>
                <td className="p-3 font-semibold">
                  {Number(b.amount).toFixed(3)} {b.currency}
                </td>
                <td className="p-3">{b.gatewaySlug || "—"}</td>
                <td className="p-3">{b.status}</td>
                <td className="p-3 text-xs text-slate-400">
                  {new Date(b.paidAt || b.createdAt).toLocaleString("ar")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-6 text-sm text-slate-500 text-center">لا توجد فواتير اشتراك بعد.</p>
        )}
      </div>
    </div>
  );
}
