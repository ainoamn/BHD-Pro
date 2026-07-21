"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp } from "lucide-react";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { ReportStatCards } from "@/components/reports/report-stat-cards";
import { ExportButtons } from "@/components/reports/export-buttons";

export default function SalesReportPage() {
  const t = useTranslations("reportsSales");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data, isLoading } = useQuery({
    queryKey: ["report-sales-summary"],
    queryFn: async () => {
      const res = await api.getSalesSummary();
      return res.data as {
        invoiceCount: number;
        totalRevenue: number;
        thisMonth: number;
        lastMonth: number;
        unpaid: number;
        topCustomers: { contactId: string; name: string; total: number; count: number }[];
        monthly: { month: string; amount: number }[];
      };
    },
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const exportRows = [
    ...data.topCustomers.map((c) => [c.name, c.count, c.total]),
    ...data.monthly.map((m) => [m.month, m.amount, ""]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <ExportButtons
            filename="sales-report"
            headers={[t("customer"), t("invoices"), t("total")]}
            rows={exportRows}
            printTitle={t("title")}
          />
        }
      />

      <ReportStatCards
        currency={currency}
        stats={[
          { label: t("totalRevenue"), value: data.totalRevenue, isMoney: true, color: "text-emerald-400" },
          { label: t("thisMonth"), value: data.thisMonth, isMoney: true },
          { label: t("lastMonth"), value: data.lastMonth, isMoney: true },
          { label: t("unpaid"), value: data.unpaid, isMoney: true, color: "text-amber-400" },
        ]}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <h3 className="font-semibold text-white">{t("monthlyTrend")}</h3>
          </div>
          <div className="space-y-2">
            {data.monthly.map((m) => (
              <div key={m.month} className="flex justify-between text-sm py-2 border-b border-slate-800/50">
                <span className="text-slate-400">{m.month}</span>
                <span className="text-white font-medium">{formatMoney(m.amount, currency)}</span>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5 overflow-hidden">
          <h3 className="font-semibold text-white mb-4">{t("topCustomers")}</h3>
          {data.topCustomers.length === 0 ? (
            <p className="text-sm text-slate-500">{t("noData")}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800">
                    <th className="text-right py-2">{t("customer")}</th>
                    <th className="text-right py-2">{t("invoices")}</th>
                    <th className="text-right py-2">{t("total")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCustomers.map((c) => (
                    <tr key={c.contactId} className="border-b border-slate-800/50">
                      <td className="py-2 text-white">{c.name}</td>
                      <td className="py-2 text-slate-400">{c.count}</td>
                      <td className="py-2 text-emerald-400">{formatMoney(c.total, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
