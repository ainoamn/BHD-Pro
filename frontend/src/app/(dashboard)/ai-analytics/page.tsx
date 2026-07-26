"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  Shield,
  BarChart3,
  UserCheck,
  Loader2,
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
import toast from "react-hot-toast";
import Link from "next/link";
import api from "@/lib/api";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, QueryError, GlassCard } from "@/components/ui/page-shell";

interface AiRecommendation {
  type: string;
  priority: string;
  title: string;
  titleEn?: string;
  description: string;
  descriptionEn?: string;
  requiresHumanApproval?: boolean;
}

interface AiAnalytics {
  mode?: string;
  disclaimerAr?: string;
  disclaimerEn?: string;
  summary: {
    totalRevenue: number;
    avgInvoice: number;
    forecast: number;
    invoiceCount: number;
    lowStockCount: number;
  };
  monthlyData: { month: string; revenue: number }[];
  recommendations: AiRecommendation[];
  pendingHumanReviews?: { id: string; title: string; severity: string }[];
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
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ai-analytics"],
    queryFn: async () => {
      const res = await api.getAiAnalytics();
      return res.data as AiAnalytics;
    },
  });

  const { data: recentShifts = [] } = useQuery({
    queryKey: ["ai-pos-shifts"],
    queryFn: async () => {
      const res = await api.listPosShifts();
      return ((res.data || []) as { id: string; status: string; openedAt: string; closedAt?: string | null }[])
        .filter((s) => s.status === "CLOSED")
        .slice(0, 5);
    },
  });

  const [shiftReviewBusy, setShiftReviewBusy] = useState<string | null>(null);
  const [shiftReviewLines, setShiftReviewLines] = useState<string[]>([]);

  const reviewShift = async (shiftId: string) => {
    setShiftReviewBusy(shiftId);
    try {
      const res = await api.getPosShiftAnomalies(shiftId);
      const body = res.data;
      const lines = (body.findings || []).map(
        (f) => `${f.severity}: ${isEn ? f.messageEn : f.messageAr}`,
      );
      setShiftReviewLines(
        lines.length
          ? lines
          : [isEn ? body.summaryEn : body.summaryAr],
      );
      toast.success(isEn ? body.summaryEn : body.summaryAr);
    } catch (err) {
      toast.error(
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t("proposeFail"),
      );
    } finally {
      setShiftReviewBusy(null);
    }
  };

  const proposeMutation = useMutation({
    mutationFn: () => api.proposeAiSuggestions(),
    onSuccess: (res) => {
      const count = (res.data as { createdCount?: number })?.createdCount ?? 0;
      toast.success(t("proposed", { count }));
      queryClient.invalidateQueries({ queryKey: ["ai-analytics"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t("proposeFail"));
    },
  });

  const chartData =
    data?.monthlyData.map((d) => ({
      ...d,
      label: formatDate(d.month),
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            type="button"
            onClick={() => proposeMutation.mutate()}
            disabled={proposeMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {proposeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserCheck className="h-4 w-4" />
            )}
            {t("sendForReview")}
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : isError || !data ? (
        <QueryError onRetry={() => refetch()} />
      ) : (
        <>
          <GlassCard className="p-4 text-sm text-amber-100/90 border border-amber-500/20 bg-amber-500/5">
            {isEn ? data.disclaimerEn : data.disclaimerAr}
          </GlassCard>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: t("totalRevenue"), value: formatMoney(data.summary.totalRevenue, currency) },
              { label: t("avgInvoice"), value: formatMoney(data.summary.avgInvoice, currency) },
              { label: t("forecast"), value: formatMoney(data.summary.forecast, currency) },
              {
                label: t("invoiceCount"),
                value: data.summary.invoiceCount.toString(),
                isCount: true,
              },
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
                  <p className="text-xs text-slate-500 mt-1">
                    {(data.anomalyScore * 100).toFixed(0)}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-400">{t("fraudRisk")}</p>
                  <span
                    className={cn(
                      "inline-block mt-1 px-3 py-1 rounded-full text-xs font-medium",
                      data.fraudRisk === "low"
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "bg-amber-500/10 text-amber-400",
                    )}
                  >
                    {t(`risk_${data.fraudRisk}`)}
                  </span>
                </div>
                {data.summary.lowStockCount > 0 && (
                  <div className="flex items-center gap-2 text-amber-400 text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    {t("lowStockWarning", { count: data.summary.lowStockCount })}
                  </div>
                )}
                <Link
                  href="/management-alerts"
                  className="inline-flex text-sm text-emerald-400 underline underline-offset-2"
                >
                  {t("openAlerts")}
                </Link>
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
                      className={cn(
                        "border rounded-xl p-4",
                        priorityColors[rec.priority] || priorityColors.low,
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium text-white">
                            {isEn ? rec.titleEn || rec.title : rec.title}
                          </p>
                          <p className="text-sm text-slate-300 mt-1">
                            {isEn ? rec.descriptionEn || rec.description : rec.description}
                          </p>
                          <p className="text-xs text-amber-300/90 mt-2">{t("humanOnly")}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>

          {recentShifts.length > 0 ? (
            <GlassCard className="p-6">
              <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-violet-400" />
                {isEn ? "POS shift anomaly review" : "مراجعة شذوذ ورديات الصندوق"}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                {isEn
                  ? "Rule-based review of recent closed shifts (variance, voids, cash-out, commission)."
                  : "مراجعة قواعدية للورديات المغلقة الأخيرة (فارق، إلغاءات، إخراج، عمولة)."}
              </p>
              <ul className="space-y-2">
                {recentShifts.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="text-slate-300">
                      {new Date(s.closedAt || s.openedAt).toLocaleString()}
                    </span>
                    <button
                      type="button"
                      disabled={shiftReviewBusy === s.id}
                      onClick={() => void reviewShift(s.id)}
                      className="text-xs font-semibold text-violet-300 hover:underline disabled:opacity-50"
                    >
                      {shiftReviewBusy === s.id
                        ? "…"
                        : isEn
                          ? "Smart review"
                          : "مراجعة ذكية"}
                    </button>
                  </li>
                ))}
              </ul>
              {shiftReviewLines.length ? (
                <ul className="mt-3 space-y-1 text-xs text-slate-300">
                  {shiftReviewLines.map((line, i) => (
                    <li key={i} className="rounded bg-black/30 px-2 py-1">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link
                href="/pos/shifts"
                className="inline-flex mt-3 text-sm text-emerald-400 underline underline-offset-2"
              >
                {isEn ? "Open POS shifts" : "فتح ورديات الصندوق"}
              </Link>
            </GlassCard>
          ) : null}
        </>
      )}
    </div>
  );
}
