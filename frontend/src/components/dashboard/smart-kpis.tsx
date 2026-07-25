"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  Package,
  Receipt,
  FileWarning,
  ArrowLeft,
  ShieldCheck,
  ShoppingCart,
  ShieldAlert,
  UtensilsCrossed,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface SmartKpisData {
  todaySales: number;
  todaySalesCount: number;
  overdueCount: number;
  overdueAmount: number;
  lowStockCount: number;
  vatPendingCount: number;
  pendingCollectionCount: number;
  pendingApprovalsCount?: number;
  todayPosSales?: number;
  todayPosSalesCount?: number;
  todayPosVoidedCount?: number;
  openPosShiftsCount?: number;
  openManagementAlertsCount?: number;
}

interface SmartKpisProps {
  data: SmartKpisData;
  currency?: string;
}

export function SmartKpis({ data, currency = "OMR" }: SmartKpisProps) {
  const t = useTranslations("dashboard");

  const cards = [
    {
      key: "todaySales",
      href: "/sales",
      icon: Receipt,
      value: formatMoney(data.todaySales, currency),
      hint: t("todaySalesHint", { count: data.todaySalesCount }),
      tone: "text-emerald-400 bg-emerald-500/10",
    },
    {
      key: "todayPos",
      href: "/pos",
      icon: ShoppingCart,
      value: formatMoney(data.todayPosSales || 0, currency),
      hint: t("todayPosHint", {
        count: data.todayPosSalesCount || 0,
        shifts: data.openPosShiftsCount || 0,
        voids: data.todayPosVoidedCount || 0,
      }),
      tone: "text-sky-400 bg-sky-500/10",
    },
    {
      key: "appResto",
      href: "/resto",
      icon: UtensilsCrossed,
      value: t("appOpen"),
      hint: t("appRestoDesc"),
      tone: "text-amber-400 bg-amber-500/10",
    },
    {
      key: "pendingApprovals",
      href: "/pos/approvals",
      icon: ShieldCheck,
      value: String(data.pendingApprovalsCount || 0),
      hint: t("pendingApprovalsHint"),
      tone:
        (data.pendingApprovalsCount || 0) > 0
          ? "text-amber-400 bg-amber-500/10"
          : "text-slate-300 bg-slate-500/10",
    },
    {
      key: "openManagementAlerts",
      href: "/management-alerts",
      icon: ShieldAlert,
      value: String(data.openManagementAlertsCount || 0),
      hint: t("openManagementAlertsHint"),
      tone:
        (data.openManagementAlertsCount || 0) > 0
          ? "text-rose-400 bg-rose-500/10"
          : "text-slate-300 bg-slate-500/10",
    },
    {
      key: "overdueAr",
      href: "/sales",
      icon: FileWarning,
      value: formatMoney(data.overdueAmount, currency),
      hint: t("overdueArHint", { count: data.overdueCount }),
      tone: data.overdueCount > 0 ? "text-rose-400 bg-rose-500/10" : "text-slate-300 bg-slate-500/10",
    },
    {
      key: "lowStock",
      href: "/inventory",
      icon: Package,
      value: String(data.lowStockCount),
      hint: t("lowStockHint"),
      tone: data.lowStockCount > 0 ? "text-amber-400 bg-amber-500/10" : "text-slate-300 bg-slate-500/10",
    },
    {
      key: "vatPending",
      href: "/vat",
      icon: AlertTriangle,
      value: String(data.vatPendingCount),
      hint: t("vatPendingHint"),
      tone: data.vatPendingCount > 0 ? "text-sky-400 bg-sky-500/10" : "text-slate-300 bg-slate-500/10",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Link
            key={c.key}
            href={c.href}
            className="group rounded-xl border border-slate-800/50 bg-slate-900/60 p-4 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs text-slate-400">{t(c.key)}</p>
                <p className="mt-1.5 text-lg sm:text-xl font-bold text-white truncate">{c.value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{c.hint}</p>
              </div>
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", c.tone)}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-[11px] text-emerald-400/80 opacity-0 group-hover:opacity-100 transition-opacity">
              {t("open")} <ArrowLeft className="w-3 h-3" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
