"use client";

import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Shield,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import api from "@/lib/api";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";

interface AiRecommendation {
  type: string;
  priority: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
}

interface AiAnalytics {
  summary: {
    totalRevenue: number;
    avgInvoice: number;
    forecast: number;
    invoiceCount: number;
    lowStockCount: number;
  };
  monthlyData: { month: string; revenue: number }[];
  recommendations: AiRecommendation[];
  anomalyScore: number;
  fraudRisk: string;
}

const priorityColors: Record<string, string> = {
  critical: "border-rose-500/50 bg-rose-500/10",
  high: "border-amber-500/50 bg-amber-500/10",
  medium: "border-blue-500/50 bg-blue-500/10",
  low: "border-emerald-500/50 bg-emerald-500/10",
};

const typeIcons: Record<string, typeof Brain> = {
  inventory: AlertTriangle,
  revenue: TrendingUp,
  growth: BarChart3,
  fraud: Shield,
  expense: BarChart3,
};

export default function AiAnalyticsPage() {
  const t = useTranslations("ai");
  const locale = useLocale();
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const isEn = locale === "en";

  const { data, isLoading } = useQuery({
    queryKey: ["ai-analytics"],
    queryFn: async () => {
      const res = await api.getAiAnalytics();
      return res.data as AiAnalytics;
    },
  });

  const chartData = data?.monthlyData.map((d) => ({
    ...d,
    label: formatDate(d.month),
  })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {isLoading || !data ? (
        <LoadingSpinner />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("totalRevenue"), value: formatMoney(data.summary.totalRevenue, currency) },
              { label: t("avgInvoice"), value: formatMoney(data.summary.avgInvoice, currency) },
              { label: t("forecast"), value: formatMoney(data.summary.forecast, currency) },
              { label: t("invoiceCount"), value: data.summary.invoiceCount.toString(), isCount: true },
            ].map((s) => (
              <div key={s.label} className="glass rounded-xl p-4">
                <p className="text-sm text-slate-400">{s.label}</p>
                <p className="text-xl font-bold text-white mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <GlassCard className="lg:col-span-2 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                {t("revenueTrend")}
              </h3>
              <div className="h-64">
                {chartData.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                    {t("noData")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="label" stroke="#475569" fontSize={11} tickLine={false} />
                      <YAxis stroke="#475569" fontSize={11} tickLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          border: "1px solid #1e293b",
                          borderRadius: "8px",
                          color: "#f8fafc",
                        }}
                      />
                      <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-emerald-400" />
                {t("riskAnalysis")}
              </h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-slate-400">{t("anomalyScore")}</p>
                  <div className="mt-2 h-2 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${Math.min(data.anomalyScore * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{(data.anomalyScore * 100).toFixed(0)}%</p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">{t("fraudRisk")}</p>
                  <span className={cn(
                    "inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium",
                    data.fraudRisk === "low" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                  )}>
                    {t(`risk_${data.fraudRisk}`)}
                  </span>
                </div>
                {data.summary.lowStockCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {t("lowStockWarning", { count: data.summary.lowStockCount })}
                  </div>
                )}
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-400" />
              {t("recommendations")}
            </h3>
            {data.recommendations.length === 0 ? (
              <p className="text-slate-500 text-sm">{t("noRecommendations")}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.recommendations.map((rec, idx) => {
                  const Icon = typeIcons[rec.type] || Brain;
                  return (
                    <div
                      key={idx}
                      className={cn("border rounded-xl p-4", priorityColors[rec.priority] || priorityColors.low)}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <p className="text-white font-medium text-sm">
                            {isEn ? (rec.titleEn || rec.title) : rec.title}
                          </p>
                          <p className="text-slate-400 text-xs mt-1">
                            {isEn ? (rec.descriptionEn || rec.description) : rec.description}
                          </p>
                          <span className="inline-block mt-2 text-xs text-slate-500 capitalize">
                            {t(`priority_${rec.priority}`)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
