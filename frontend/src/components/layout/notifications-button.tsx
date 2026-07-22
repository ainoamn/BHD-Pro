"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, FileWarning, Package, CheckCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import api from "@/lib/api";

type AlertItem = {
  id: string;
  title: string;
  message: string;
  href: string;
  type: "warning" | "error" | "info";
};

export function NotificationsButton() {
  const t = useTranslations("notifications");
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [hasAlerts, setHasAlerts] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const { data: alerts = [], isLoading, isFetching } = useQuery({
    queryKey: ["topbar-alerts"],
    queryFn: async (): Promise<AlertItem[]> => {
      const items: AlertItem[] = [];
      // Prefer invoice stats (cheap counts) — product stats only when needed
      const [salesStats, purchaseStats] = await Promise.all([
        api.getInvoiceStats("SALES").catch(() => null),
        api.getInvoiceStats("PURCHASE").catch(() => null),
      ]);

      const overdueSales = Number(salesStats?.data?.overdueCount ?? 0);
      if (overdueSales > 0) {
        items.push({
          id: "overdue-sales",
          title: t("overdueSalesTitle"),
          message: t("overdueSalesMsg", { count: overdueSales }),
          href: "/sales",
          type: "error",
        });
      }

      const pendingCollection = Number(salesStats?.data?.pendingCollectionCount ?? 0);
      if (pendingCollection > 0) {
        items.push({
          id: "pending-collection",
          title: t("pendingCollectionTitle"),
          message: t("pendingCollectionMsg", { count: pendingCollection }),
          href: "/sales",
          type: "info",
        });
      }

      const overduePurchases = Number(purchaseStats?.data?.overdueCount ?? 0);
      if (overduePurchases > 0) {
        items.push({
          id: "overdue-purchases",
          title: t("overduePurchasesTitle"),
          message: t("overduePurchasesMsg", { count: overduePurchases }),
          href: "/purchases",
          type: "warning",
        });
      }

      return items;
    },
    enabled: open,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (alerts.length > 0) setHasAlerts(true);
  }, [alerts]);

  const visible = alerts.filter((a) => !dismissed.includes(a.id));
  const showDot = open ? visible.length > 0 : hasAlerts && dismissed.length < alerts.length;

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

  const iconFor = (type: AlertItem["type"]) => {
    if (type === "error") return FileWarning;
    if (type === "warning") return Package;
    return AlertTriangle;
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("title")}
        aria-expanded={open}
        className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-colors"
      >
        <Bell className="w-4 h-4" />
        {showDot && <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-rose-500 rounded-full" />}
      </button>

      {open && (
        <div className="absolute top-full mt-2 end-0 w-[min(100vw-2rem,22rem)] bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <h3 className="text-sm font-semibold text-white">{t("title")}</h3>
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
            ) : visible.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{t("empty")}</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-800">
                {visible.map((alert) => {
                  const Icon = iconFor(alert.type);
                  return (
                    <li key={alert.id}>
                      <Link
                        href={alert.href}
                        onClick={() => {
                          setDismissed((prev) => [...prev, alert.id]);
                          setOpen(false);
                        }}
                        className="flex gap-3 px-4 py-3 hover:bg-slate-800/60 transition-colors"
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
                          <p className="text-sm font-medium text-white truncate">{alert.title}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{alert.message}</p>
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
