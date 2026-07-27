"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatDate } from "@/lib/utils";

export interface CashFlowPoint {
  month: string;
  revenue: number;
  expenses: number;
}

interface RevenueChartProps {
  data: CashFlowPoint[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  const t = useTranslations("dashboard");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  const chartData = data.map((point) => ({
    ...point,
    label: formatDate(point.month),
  }));

  return (
    <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-4 sm:p-6 min-w-0">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{t("cashFlow")}</h3>
      </div>

      <div className="h-72 w-full min-w-0">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            {t("noChartData")}
          </div>
        ) : ready ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="label" stroke="#475569" fontSize={12} tickLine={false} />
              <YAxis
                stroke="#475569"
                fontSize={12}
                tickLine={false}
                tickFormatter={(value) => `${value / 1000}k`}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#0f172a",
                  border: "1px solid #1e293b",
                  borderRadius: "8px",
                  color: "#f8fafc",
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                name={t("revenue")}
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#revenueGradient)"
              />
              <Area
                type="monotone"
                dataKey="expenses"
                name={t("expenses")}
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#expensesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full rounded-lg bg-slate-800/40 animate-pulse" />
        )}
      </div>
    </div>
  );
}
