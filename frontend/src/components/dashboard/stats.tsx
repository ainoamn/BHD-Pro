"use client";

import { useTranslations } from "next-intl";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  FileText,
  Users,
  Package,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn, formatMoney } from "@/lib/utils";

export interface DashboardStatsData {
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  customerCount: number;
  productCount: number;
}

interface DashboardStatsProps {
  data: DashboardStatsData;
  currency?: string;
}

const statConfig = [
  { key: "revenue" as const, icon: Wallet, bgColor: "bg-blue-500/10", textColor: "text-blue-400" },
  { key: "expenses" as const, icon: TrendingDown, bgColor: "bg-rose-500/10", textColor: "text-rose-400" },
  { key: "profit" as const, icon: TrendingUp, bgColor: "bg-emerald-500/10", textColor: "text-emerald-400" },
  { key: "invoices" as const, icon: FileText, bgColor: "bg-emerald-500/10", textColor: "text-emerald-400", isCount: true, field: "invoiceCount" as const },
  { key: "customers" as const, icon: Users, bgColor: "bg-amber-500/10", textColor: "text-amber-400", isCount: true, field: "customerCount" as const },
  { key: "products" as const, icon: Package, bgColor: "bg-cyan-500/10", textColor: "text-cyan-400", isCount: true, field: "productCount" as const },
];

export function DashboardStats({ data, currency = "OMR" }: DashboardStatsProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {statConfig.map((stat, index) => {
        const Icon = stat.icon;
        const value = stat.field ? data[stat.field] : data[stat.key];

        return (
          <motion.div
            key={stat.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.5 }}
            className="relative group"
          >
            <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-5 hover:border-slate-700/50 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-slate-400">{t(stat.key)}</p>
                  <p className="text-2xl font-bold text-white mt-2">
                    {stat.isCount ? value.toLocaleString() : formatMoney(value, currency)}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">{t("thisMonth")}</p>
                </div>
                <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center", stat.bgColor)}>
                  <Icon className={cn("w-5 h-5", stat.textColor)} />
                </div>
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
