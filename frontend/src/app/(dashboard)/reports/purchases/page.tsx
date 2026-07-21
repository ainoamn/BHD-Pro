"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { ReportStatCards } from "@/components/reports/report-stat-cards";

export default function PurchasesReportPage() {
  const t = useTranslations("reportsPurchases");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data, isLoading } = useQuery({
    queryKey: ["report-purchase-summary"],
    queryFn: async () => {
      const res = await api.getPurchaseSummary();
      return res.data as {
        totalExpenses: number;
        thisMonth: number;
        lastMonth: number;
        unpaid: number;
        topSuppliers: { contactId: string; name: string; total: number; count: number }[];
      };
    },
  });

  if (isLoading || !data) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <ReportStatCards
        currency={currency}
        stats={[
          { label: t("totalExpenses"), value: data.totalExpenses, isMoney: true, color: "text-rose-400" },
          { label: t("thisMonth"), value: data.thisMonth, isMoney: true },
          { label: t("lastMonth"), value: data.lastMonth, isMoney: true },
          { label: t("unpaid"), value: data.unpaid, isMoney: true, color: "text-amber-400" },
        ]}
      />

      <GlassCard className="p-5 overflow-hidden">
        <h3 className="font-semibold text-white mb-4">{t("topSuppliers")}</h3>
        {data.topSuppliers.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noData")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-right py-2">{t("supplier")}</th>
                  <th className="text-right py-2">{t("invoices")}</th>
                  <th className="text-right py-2">{t("total")}</th>
                </tr>
              </thead>
              <tbody>
                {data.topSuppliers.map((s) => (
                  <tr key={s.contactId} className="border-b border-slate-800/50">
                    <td className="py-2 text-white">{s.name}</td>
                    <td className="py-2 text-slate-400">{s.count}</td>
                    <td className="py-2 text-rose-400">{formatMoney(s.total, currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
