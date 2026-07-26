"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  AlertTriangle,
  FileWarning,
  Package,
  CheckCheck,
  Loader2,
  Receipt,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";

type AlertItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  type: "warning" | "error" | "info";
};

type AlertStats = {
  overdueCount?: number;
  pendingCollectionCount?: number;
  lowStock?: number;
  lowStockCount?: number;
  vatPendingCount?: number;
};

export function NotificationsButton() {
  const t = useTranslations("notifications");
  const company = useAuthStore((s) => s.company);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hasAlerts, setHasAlerts] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: alerts = [], isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["topbar-alerts", company?.id],
    queryFn: async (): Promise<AlertItem[]> => {
      const items: AlertItem[] = [];
      const settled = await Promise.allSettled([
        api.getInvoiceStats("SALES"),
        api.getInvoiceStats("PURCHASE"),
        api.getProductStats(),
        api.getDashboardStats(),
      ]);
      if (settled.every((r) => r.status === "rejected")) {
        throw new Error("alerts_unavailable");
      }
      const salesStats = settled[0].status === "fulfilled" ? settled[0].value : null;
      const purchaseStats = settled[1].status === "fulfilled" ? settled[1].value : null;
      const productStats = settled[2].status === "fulfilled" ? settled[2].value : null;
      const dash = settled[3].status === "fulfilled" ? settled[3].value : null;

      const salesData = (salesStats?.data ?? {}) as AlertStats;
      const purchaseData = (purchaseStats?.data ?? {}) as AlertStats;
      const productData = (productStats?.data ?? {}) as AlertStats;
      const dashDataEarly = (dash?.data ?? {}) as AlertStats;
      const overdueSales = Number(salesData.overdueCount ?? dashDataEarly.overdueCount ?? 0);
      if (overdueSales > 0) {
        items.push({
          id: "overdue-sales",
          title: t("overdueSalesTitle"),
          message: t("overdueSalesMsg", { count: overdueSales }),
          href: "/sales",
          type: "error",
        });
      }

      const pendingCollection = Number(
        salesData.pendingCollectionCount ?? dashDataEarly.pendingCollectionCount ?? 0
      );
      if (pendingCollection > 0) {
        items.push({
          id: "pending-collection",
          title: t("pendingCollectionTitle"),
          message: t("pendingCollectionMsg", { count: pendingCollection }),
          href: "/sales",
          type: "info",
        });
      }

      const overduePurchases = Number(purchaseData.overdueCount ?? 0);
      if (overduePurchases > 0) {
        items.push({
          id: "overdue-purchases",
          title: t("overduePurchasesTitle"),
          message: t("overduePurchasesMsg", { count: overduePurchases }),
          href: "/purchases",
          type: "warning",
        });
      }

      const lowStock = Number(productData.lowStock ?? dashDataEarly.lowStockCount ?? 0);
      if (lowStock > 0) {
        items.push({
          id: "low-stock",
          title: t("lowStockTitle"),
          message: t("lowStockMsg", { count: lowStock }),
          href: "/inventory",
          type: "warning",
        });
      }

      const vatPending = Number(dashDataEarly.vatPendingCount ?? 0);
      if (vatPending > 0) {
        items.push({
          id: "vat-pending",
          title: t("vatPendingTitle"),
          message: t("vatPendingMsg", { count: vatPending }),
          href: "/vat",
          type: "info",
        });
      }

      const planExpiry = (company as { planExpiry?: string } | null)?.planExpiry;
      if (planExpiry) {
        const days = Math.ceil((new Date(planExpiry).getTime() - Date.now()) / 86400000);
        if (days >= 0 && days <= 14) {
          items.push({
            id: "subscription-expiring",
            title: t("subscriptionTitle"),
            message: t("subscriptionMsg", { days }),
            href: "/subscription",
            type: days <= 3 ? "error" : "warning",
          });
        }
      }

      const dashData = (dash?.data || {}) as Record<string, unknown>;
      const pendingApprovals = Number(dashData.pendingApprovalsCount ?? 0);
      if (pendingApprovals > 0) {
        items.push({
          id: "pending-approvals",
          title: t("pendingApprovalsTitle"),
          message: t("pendingApprovalsMsg", { count: pendingApprovals }),
          href: "/pos/approvals",
          type: "warning",
        });
      }

      const openMgmtAlerts = Number(dashData.openManagementAlertsCount ?? 0);
      if (openMgmtAlerts > 0) {
        items.push({
          id: "open-management-alerts",
          title: t("mgmtAlertsTitle"),
          message: t("mgmtAlertsMsg", { count: openMgmtAlerts }),
          href: "/management-alerts",
          type: "warning",
        });
      }

      const openPosShifts = Number(dashData.openPosShiftsCount ?? 0);
      if (openPosShifts > 0) {
        items.push({
          id: "open-pos-shifts",
          title: t("openShiftsTitle"),
          message: t("openShiftsMsg", { count: openPosShifts }),
          href: "/pos/shifts",
          type: "info",
        });
      }

      return items;
    },
    enabled: open,
    staleTime: 2 * 60_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (alerts.length > 0) setHasAlerts(true);
  }, [alerts]);

  // Prefetch a lightweight badge signal once after mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const sales = await api.getInvoiceStats("SALES");
        const salesData = (sales?.data ?? {}) as AlertStats;
        const overdue = Number(salesData.overdueCount ?? 0);
        const pending = Number(salesData.pendingCollectionCount ?? 0);
        if (!cancelled && (overdue > 0 || pending > 0)) setHasAlerts(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  const showDot = open ? visible.length > 0 : hasAlerts;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const iconFor = (type: AlertItem["type"], id: string) => {
    if (id === "low-stock") return Package;
    if (id === "vat-pending") return Receipt;
    if (id === "subscription-expiring") return Crown;
    if (type === "error") return FileWarning;
    if (type === "warning") return AlertTriangle;
    return AlertTriangle;
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        aria-expanded={open}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {showDot && <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-rose-500 rounded-full" />}
      </button>

      {open && (
        <div className="absolute top-full mt-2 end-0 w-[min(100vw-2rem,22rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{t("title")}</h3>
            {visible.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setDismissed((prev) => Array.from(new Set([...prev, ...visible.map((a) => a.id)])));
                  setHasAlerts(false);
                }}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-emerald-400 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {(isLoading || isFetching) && alerts.length === 0 ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
              </div>
            ) : isError ? (
              <div className="px-4 py-10 text-center space-y-2">
                <p className="text-sm text-rose-500">{t("loadFailed")}</p>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="text-xs font-semibold text-emerald-600 hover:underline"
                >
                  {t("retry")}
                </button>
              </div>
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t("empty")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-200 dark:divide-slate-800">
                {visible.map((alert) => {
                  const Icon = iconFor(alert.type, alert.id);
                  return (
                    <li key={alert.id}>
                      <Link
                        href={alert.href}
                        onClick={() => {
                          setDismissed((prev) => [...prev, alert.id]);
                          setOpen(false);
                        }}
                        className="flex gap-3 px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-colors"
                      >
                        <div
                          className={cn(
                            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0",
                            alert.type === "error" && "bg-rose-500/15 text-rose-400",
                            alert.type === "warning" && "bg-amber-500/15 text-amber-400",
                            alert.type === "info" && "bg-sky-500/15 text-sky-400"
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{alert.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{alert.message}</p>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
