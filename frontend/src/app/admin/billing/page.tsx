"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";

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
  company: {
    id: string;
    name: string;
    email: string | null;
    plan: string;
  };
};

export default function AdminBillingPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const en = locale === "en";
  const [rows, setRows] = useState<Bill[]>([]);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.getAdminBilling(status || undefined).then((res) => setRows(res.data as Bill[]));
  }, [status]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{t.billing}</h1>
          <p className="text-sm text-slate-500 mt-1">{t.billingHint}</p>
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">{en ? "All" : "الكل"}</option>
          <option value="PAID">PAID</option>
          <option value="PENDING">PENDING</option>
          <option value="FAILED">FAILED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-sm min-w-[920px]">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-start p-3">#</th>
              <th className="text-start p-3">{t.company}</th>
              <th className="text-start p-3">{t.plan}</th>
              <th className="text-start p-3">{t.amount}</th>
              <th className="text-start p-3">{t.gateway}</th>
              <th className="text-start p-3">{t.status}</th>
              <th className="text-start p-3">{t.created}</th>
              <th className="text-start p-3">{en ? "Paid at" : "تاريخ الدفع"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-slate-100">
                <td className="p-3 font-mono text-xs">{b.number}</td>
                <td className="p-3">
                  <div className="font-bold">{b.company.name}</div>
                  <div className="text-xs text-slate-500">{b.company.email || "—"}</div>
                </td>
                <td className="p-3">{b.company.plan}</td>
                <td className="p-3 font-bold">
                  {Number(b.amount).toFixed(3)} {b.currency}
                </td>
                <td className="p-3">{b.gatewaySlug || "—"}</td>
                <td className="p-3">{b.status}</td>
                <td className="p-3 text-xs">
                  {new Date(b.createdAt).toLocaleString(en ? "en-GB" : "ar")}
                </td>
                <td className="p-3 text-xs">
                  {b.paidAt ? new Date(b.paidAt).toLocaleString(en ? "en-GB" : "ar") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-8 text-center text-slate-500 text-sm">{t.empty}</p>}
      </div>
    </div>
  );
}
