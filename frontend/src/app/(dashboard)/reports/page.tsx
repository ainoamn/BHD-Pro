"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import api from "@/lib/api";
import { cn, formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";

type ReportTab = "profitLoss" | "balanceSheet" | "trialBalance" | "cashFlow";

export default function ReportsPage() {
  const t = useTranslations("reports");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const [tab, setTab] = useState<ReportTab>("profitLoss");

  const { data: profitLoss, isLoading: loadingPL } = useQuery({
    queryKey: ["report-profit-loss"],
    queryFn: async () => {
      const res = await api.getProfitLoss();
      return res.data as { revenue: number; expenses: number; netProfit: number; margin: number };
    },
    enabled: tab === "profitLoss",
  });

  const { data: balanceSheet, isLoading: loadingBS } = useQuery({
    queryKey: ["report-balance-sheet"],
    queryFn: async () => {
      const res = await api.getBalanceSheet();
      return res.data as {
        assets: { code: string; name: string; balance: number }[];
        liabilities: { code: string; name: string; balance: number }[];
        equity: { code: string; name: string; balance: number }[];
        totalAssets: number;
        totalLiabilities: number;
        totalEquity: number;
      };
    },
    enabled: tab === "balanceSheet",
  });

  const { data: trialBalance, isLoading: loadingTB } = useQuery({
    queryKey: ["report-trial-balance"],
    queryFn: async () => {
      const res = await api.getTrialBalance();
      return res.data as {
        lines: { code: string; name: string; debit: number; credit: number }[];
        totalDebit: number;
        totalCredit: number;
      };
    },
    enabled: tab === "trialBalance",
  });

  const { data: cashFlow, isLoading: loadingCF } = useQuery({
    queryKey: ["report-cash-flow"],
    queryFn: async () => {
      const res = await api.getCashFlowReport();
      return res.data as { operating: number; inflow: number; outflow: number; netCashFlow: number };
    },
    enabled: tab === "cashFlow",
  });

  const isLoading = loadingPL || loadingBS || loadingTB || loadingCF;

  const tabs: { key: ReportTab; label: string }[] = [
    { key: "profitLoss", label: t("profitLoss") },
    { key: "balanceSheet", label: t("balanceSheet") },
    { key: "trialBalance", label: t("trialBalance") },
    { key: "cashFlow", label: t("cashFlow") },
  ];

  const renderAccountSection = (
    title: string,
    items: { code: string; name: string; balance: number }[],
    total: number
  ) => (
    <div className="space-y-3">
      <h3 className="text-white font-semibold">{title}</h3>
      {items.map((item) => (
        <div key={item.code} className="flex justify-between text-sm py-2 border-b border-slate-800/50">
          <span className="text-slate-300">{item.code} — {item.name}</span>
          <span className="text-white">{formatMoney(item.balance, currency)}</span>
        </div>
      ))}
      <div className="flex justify-between font-bold text-emerald-400 pt-2">
        <span>{t("total")}</span>
        <span>{formatMoney(total, currency)}</span>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
              tab === key ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <GlassCard className="p-6">
        {isLoading ? (
          <LoadingSpinner />
        ) : (
          <>
            {tab === "profitLoss" && profitLoss && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-6 h-6 text-emerald-400" />
                  <h2 className="text-lg font-semibold text-white">{t("profitLoss")}</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: t("revenue"), value: profitLoss.revenue, color: "text-emerald-400" },
                    { label: t("expenses"), value: profitLoss.expenses, color: "text-rose-400" },
                    { label: t("netProfit"), value: profitLoss.netProfit, color: "text-white" },
                    { label: t("margin"), value: `${profitLoss.margin.toFixed(1)}%`, isText: true },
                  ].map((item) => (
                    <div key={item.label} className="bg-slate-800/50 rounded-xl p-4">
                      <p className="text-sm text-slate-400">{item.label}</p>
                      <p className={cn("text-2xl font-bold mt-1", item.color || "text-white")}>
                        {item.isText ? item.value : formatMoney(item.value as number, currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "balanceSheet" && balanceSheet && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {renderAccountSection(t("assets"), balanceSheet.assets, balanceSheet.totalAssets)}
                {renderAccountSection(t("liabilities"), balanceSheet.liabilities, balanceSheet.totalLiabilities)}
                {renderAccountSection(t("equity"), balanceSheet.equity, balanceSheet.totalEquity)}
              </div>
            )}

            {tab === "trialBalance" && trialBalance && (
              <div>
                <h2 className="text-lg font-semibold text-white mb-4">{t("trialBalance")}</h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="text-right p-3 font-medium">{t("account")}</th>
                        <th className="text-right p-3 font-medium">{t("debit")}</th>
                        <th className="text-right p-3 font-medium">{t("credit")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trialBalance.lines.filter((l) => l.debit > 0 || l.credit > 0).map((line) => (
                        <tr key={line.code} className="border-b border-slate-800/50">
                          <td className="p-3 text-slate-300">{line.code} — {line.name}</td>
                          <td className="p-3 text-white">{line.debit > 0 ? formatMoney(line.debit, currency) : "—"}</td>
                          <td className="p-3 text-white">{line.credit > 0 ? formatMoney(line.credit, currency) : "—"}</td>
                        </tr>
                      ))}
                      <tr className="font-bold text-emerald-400">
                        <td className="p-3">{t("total")}</td>
                        <td className="p-3">{formatMoney(trialBalance.totalDebit, currency)}</td>
                        <td className="p-3">{formatMoney(trialBalance.totalCredit, currency)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "cashFlow" && cashFlow && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white mb-4">{t("cashFlow")}</h2>
                {[
                  { label: t("inflow"), value: cashFlow.inflow },
                  { label: t("outflow"), value: cashFlow.outflow },
                  { label: t("operating"), value: cashFlow.operating },
                  { label: t("netCashFlow"), value: cashFlow.netCashFlow },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between py-3 border-b border-slate-800/50">
                    <span className="text-slate-300">{item.label}</span>
                    <span className="text-white font-semibold">{formatMoney(item.value, currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </GlassCard>
    </div>
  );
}
