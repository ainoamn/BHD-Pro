"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard, EmptyState } from "@/components/ui/page-shell";
import { ReportStatCards } from "@/components/reports/report-stat-cards";
import { ExportButtons } from "@/components/reports/export-buttons";

export default function CostCenterPlReportPage() {
  const t = useTranslations("reportsCostCenters");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data, isLoading } = useQuery({
    queryKey: ["report-cost-center-pl"],
    queryFn: async () => {
      const res = await api.getCostCenterProfitLoss();
      return res.data as {
        centerCount: number;
        rows: {
          id: string;
          code: string;
          name: string;
          revenue: number;
          expenses: number;
          netProfit: number;
        }[];
        totals: { revenue: number; expenses: number; netProfit: number };
      };
    },
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const exportRows = data.rows.map((r) => [
    r.code,
    r.name,
    r.revenue,
    r.expenses,
    r.netProfit,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <ExportButtons
            filename="cost-center-pl"
            headers={[t("code"), t("name"), t("revenue"), t("expenses"), t("netProfit")]}
            rows={exportRows}
            printTitle={t("title")}
          />
        }
      />

      <ReportStatCards
        currency={currency}
        stats={[
          { label: t("centerCount"), value: data.centerCount, isCount: true },
          { label: t("revenue"), value: data.totals.revenue, isMoney: true, color: "text-emerald-400" },
          { label: t("expenses"), value: data.totals.expenses, isMoney: true, color: "text-rose-400" },
          {
            label: t("netProfit"),
            value: data.totals.netProfit,
            isMoney: true,
            color: data.totals.netProfit >= 0 ? "text-emerald-400" : "text-rose-400",
          },
        ]}
      />

      {data.rows.length === 0 ? (
        <EmptyState icon={Layers} title={t("empty")} />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400">
                  <th className="text-right px-4 py-3">{t("code")}</th>
                  <th className="text-right px-4 py-3">{t("name")}</th>
                  <th className="text-right px-4 py-3">{t("revenue")}</th>
                  <th className="text-right px-4 py-3">{t("expenses")}</th>
                  <th className="text-right px-4 py-3">{t("netProfit")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-slate-400">{r.code}</td>
                    <td className="px-4 py-3 text-white">{r.name}</td>
                    <td className="px-4 py-3 text-emerald-400">{formatMoney(r.revenue, currency)}</td>
                    <td className="px-4 py-3 text-rose-400">{formatMoney(r.expenses, currency)}</td>
                    <td
                      className={`px-4 py-3 font-medium ${
                        r.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {formatMoney(r.netProfit, currency)}
                    </td>
                  </tr>
                ))}
                <tr className="font-semibold text-white bg-slate-800/40">
                  <td className="px-4 py-3" colSpan={2}>
                    {t("total")}
                  </td>
                  <td className="px-4 py-3 text-emerald-400">
                    {formatMoney(data.totals.revenue, currency)}
                  </td>
                  <td className="px-4 py-3 text-rose-400">
                    {formatMoney(data.totals.expenses, currency)}
                  </td>
                  <td
                    className={`px-4 py-3 ${
                      data.totals.netProfit >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {formatMoney(data.totals.netProfit, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
