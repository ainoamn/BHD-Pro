"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { ReportStatCards } from "@/components/reports/report-stat-cards";
import { ExportButtons } from "@/components/reports/export-buttons";

export default function PayrollReportPage() {
  const t = useTranslations("reportsPayroll");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data, isLoading } = useQuery({
    queryKey: ["report-payroll-summary"],
    queryFn: async () => {
      const res = await api.getPayrollSummary();
      return res.data as {
        employeeCount: number;
        monthlySalaryTotal: number;
        payrollRunCount: number;
        recentRuns: { id: string; period: string; status: string; totalNet: number }[];
      };
    },
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const exportRows = data.recentRuns.map((r) => [r.period, r.status, r.totalNet]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <ExportButtons
            filename="payroll-runs"
            headers={[t("period"), t("status"), t("totalNet")]}
            rows={exportRows}
            printTitle={t("title")}
          />
        }
      />

      <ReportStatCards
        currency={currency}
        stats={[
          { label: t("employees"), value: data.employeeCount, isCount: true },
          { label: t("monthlySalaries"), value: data.monthlySalaryTotal, isMoney: true },
          { label: t("payrollRuns"), value: data.payrollRunCount, isCount: true },
        ]}
      />

      <GlassCard className="p-5 overflow-hidden">
        <h3 className="font-semibold text-white mb-4">{t("recentRuns")}</h3>
        {data.recentRuns.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noRuns")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-right py-2">{t("period")}</th>
                  <th className="text-right py-2">{t("status")}</th>
                  <th className="text-right py-2">{t("totalNet")}</th>
                </tr>
              </thead>
              <tbody>
                {data.recentRuns.map((r) => (
                  <tr key={r.id} className="border-b border-slate-800/50">
                    <td className="py-2 text-white">{r.period}</td>
                    <td className="py-2 text-slate-400">{r.status}</td>
                    <td className="py-2 text-emerald-400">{formatMoney(r.totalNet, currency)}</td>
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
