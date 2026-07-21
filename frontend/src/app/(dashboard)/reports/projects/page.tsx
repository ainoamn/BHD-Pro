"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { FolderKanban } from "lucide-react";
import api from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard, EmptyState } from "@/components/ui/page-shell";
import { ReportStatCards } from "@/components/reports/report-stat-cards";
import { ExportButtons } from "@/components/reports/export-buttons";

export default function ProjectBudgetReportPage() {
  const t = useTranslations("reportsProjects");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data, isLoading } = useQuery({
    queryKey: ["report-project-budget"],
    queryFn: async () => {
      const res = await api.getProjectBudgetReport();
      return res.data as {
        projectCount: number;
        overBudgetCount: number;
        rows: {
          id: string;
          code: string;
          name: string;
          status: string;
          costCenter: string | null;
          budget: number;
          actualRevenue: number;
          actualExpense: number;
          variance: number;
          usedPct: number;
        }[];
        totals: {
          budget: number;
          actualRevenue: number;
          actualExpense: number;
          variance: number;
        };
      };
    },
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const exportRows = data.rows.map((r) => [
    r.code,
    r.name,
    r.costCenter || "",
    r.budget,
    r.actualRevenue,
    r.actualExpense,
    r.variance,
    `${r.usedPct}%`,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <ExportButtons
            filename="project-budget"
            headers={[
              t("code"),
              t("name"),
              t("costCenter"),
              t("budget"),
              t("actualRevenue"),
              t("actualExpense"),
              t("variance"),
              t("usedPct"),
            ]}
            rows={exportRows}
            printTitle={t("title")}
          />
        }
      />

      <ReportStatCards
        currency={currency}
        stats={[
          { label: t("projectCount"), value: data.projectCount, isCount: true },
          { label: t("budget"), value: data.totals.budget, isMoney: true },
          { label: t("actualExpense"), value: data.totals.actualExpense, isMoney: true, color: "text-rose-400" },
          {
            label: t("overBudget"),
            value: data.overBudgetCount,
            isCount: true,
            color: data.overBudgetCount > 0 ? "text-amber-400" : "text-white",
          },
        ]}
      />

      {data.rows.length === 0 ? (
        <EmptyState icon={FolderKanban} title={t("empty")} />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400">
                  <th className="text-right px-3 py-3">{t("code")}</th>
                  <th className="text-right px-3 py-3">{t("name")}</th>
                  <th className="text-right px-3 py-3">{t("costCenter")}</th>
                  <th className="text-right px-3 py-3">{t("budget")}</th>
                  <th className="text-right px-3 py-3">{t("actualRevenue")}</th>
                  <th className="text-right px-3 py-3">{t("actualExpense")}</th>
                  <th className="text-right px-3 py-3">{t("variance")}</th>
                  <th className="text-right px-3 py-3">{t("usedPct")}</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-3 text-slate-400">{r.code}</td>
                    <td className="px-3 py-3 text-white">{r.name}</td>
                    <td className="px-3 py-3 text-slate-400">{r.costCenter || "—"}</td>
                    <td className="px-3 py-3 text-slate-300">{formatMoney(r.budget, currency)}</td>
                    <td className="px-3 py-3 text-emerald-400">
                      {formatMoney(r.actualRevenue, currency)}
                    </td>
                    <td className="px-3 py-3 text-rose-400">
                      {formatMoney(r.actualExpense, currency)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3 font-medium",
                        r.variance >= 0 ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {formatMoney(r.variance, currency)}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-3",
                        r.usedPct > 100 ? "text-amber-400" : "text-slate-300"
                      )}
                    >
                      {r.usedPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
