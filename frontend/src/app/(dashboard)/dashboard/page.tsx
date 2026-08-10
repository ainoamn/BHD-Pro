"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import Link from "next/link";
import dynamic from "next/dynamic";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { DashboardStats } from "@/components/dashboard/stats";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { PageHeader, QueryError } from "@/components/ui/page-shell";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SmartKpis } from "@/components/dashboard/smart-kpis";
import { OnboardingChecklist, OnboardingState } from "@/components/dashboard/onboarding-checklist";
import { HisabyAppsPanel } from "@/components/dashboard/hisaby-apps-panel";
import { RecordPaymentModal } from "@/components/invoices/record-payment-modal";
import {
  isChildGranted,
  type PlanModuleGrant,
} from "@/lib/plan-access-catalog";
import { UpgradeBadge } from "@/components/billing/plan-upgrade-gate";
import { subscriptionUpgradeHref } from "@/lib/plan-upgrade";

const RevenueChart = dynamic(
  () =>
    import("@/components/dashboard/revenue-chart").then((m) => m.RevenueChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 animate-pulse" />
    ),
  },
);

interface DashboardData {
  revenue: number;
  expenses: number;
  profit: number;
  invoiceCount: number;
  customerCount: number;
  productCount: number;
  todayReceived?: number;
  todayExpenses?: number;
  todaySales?: number;
  todaySalesCount?: number;
  pendingCollectionCount?: number;
  overdueCount?: number;
  overdueAmount?: number;
  lowStockCount?: number;
  vatPendingCount?: number;
  pendingApprovalsCount?: number;
  todayPosSales?: number;
  todayPosSalesCount?: number;
  todayPosVoidedCount?: number;
  openPosShiftsCount?: number;
  openManagementAlertsCount?: number;
  onboarding?: OnboardingState;
  recentInvoices: {
    id: string;
    number: string;
    customer?: string;
    date: string;
    amount: number;
    status: string;
  }[];
  cashFlow: { month: string; revenue: number; expenses: number }[];
  cached?: boolean;
}

const DASH_CACHE_PREFIX = "hisaby.dashboard.stats.";

function readDashCache(companyId?: string | null): DashboardData | undefined {
  if (!companyId || typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(DASH_CACHE_PREFIX + companyId);
    if (!raw) return undefined;
    return JSON.parse(raw) as DashboardData;
  } catch {
    return undefined;
  }
}

function writeDashCache(companyId: string | undefined | null, data: DashboardData) {
  if (!companyId || typeof window === "undefined") return;
  try {
    sessionStorage.setItem(DASH_CACHE_PREFIX + companyId, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

function LockedHint({ label }: { label: string }) {
  return (
    <Link
      href={subscriptionUpgradeHref("advancedReports", "/dashboard")}
      className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 px-4 py-6 text-center text-sm text-amber-800"
    >
      <span className="font-bold">{label}</span>
      <div className="mt-2 flex justify-center">
        <UpgradeBadge />
      </div>
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800/50" />
        ))}
      </div>
      <div className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800/50" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-64 rounded-xl bg-slate-100 dark:bg-slate-800/50" />
        <div className="h-64 rounded-xl bg-slate-100 dark:bg-slate-800/50" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const [collectOpen, setCollectOpen] = useState(false);
  const [cachedBoot, setCachedBoot] = useState<DashboardData | undefined>(undefined);

  useEffect(() => {
    setCachedBoot(readDashCache(company?.id));
  }, [company?.id]);

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["dashboard-stats", company?.id],
    queryFn: async () => {
      const res = await api.getDashboardStats();
      const row = res.data as DashboardData;
      writeDashCache(company?.id, row);
      return row;
    },
    staleTime: 90_000,
    gcTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    initialData: () => readDashCache(company?.id),
    initialDataUpdatedAt: 0, // treat as stale → still refetch, but paint immediately
  });

  const { data: subscription } = useQuery({
    queryKey: ["subscription-modules", company?.id],
    queryFn: async () => {
      const res = await api.getCurrentSubscription({ light: true });
      return res.data as {
        modules?: Record<string, PlanModuleGrant>;
        features?: Record<string, boolean>;
        plan?: string;
      };
    },
    staleTime: 120_000,
  });
  const modules = subscription?.modules;

  /**
   * Fail-open while subscription still loading so the page never shows
   * a wall of yellow "Upgrade" placeholders for 5–10 seconds.
   */
  const grant = (child: string) => {
    if (!modules) return true;
    return isChildGranted(modules, "dashboard", child);
  };

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices", "collect-modal"],
    queryFn: async () => {
      const res = await api.getInvoices({ summary: true, take: 40 });
      return res.data as {
        id: string;
        number: string;
        type: string;
        total: number;
        paidAmount: number;
        status: string;
        paymentStatus: string;
        date: string;
        dueDate?: string;
        contact?: { id: string; name: string };
      }[];
    },
    enabled: collectOpen,
  });

  const view = data ?? cachedBoot;
  const showColdSkeleton = !view && isLoading;

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        {isFetching && view ? (
          <span className="text-xs text-slate-400 pt-1">جاري التحديث…</span>
        ) : null}
      </div>

      {showColdSkeleton ? (
        <DashboardSkeleton />
      ) : isError && !view ? (
        <QueryError onRetry={() => refetch()} />
      ) : view ? (
        <>
          {view.cached ? (
            <p className="text-xs text-slate-500 -mt-2">{t("cachedHint")}</p>
          ) : null}

          {grant("onboarding") && view.onboarding ? (
            <OnboardingChecklist data={view.onboarding} />
          ) : null}

          {grant("appsPanel") ? <HisabyAppsPanel /> : null}

          {grant("quickActions") ? (
            <QuickActions
              todayReceived={view.todayReceived ?? 0}
              todayExpenses={view.todayExpenses ?? 0}
              pendingCollection={view.pendingCollectionCount ?? 0}
              currency={currency}
              onCollect={
                grant("collectPayment") ? () => setCollectOpen(true) : () => undefined
              }
            />
          ) : null}

          {grant("smartKpis") ? (
            <SmartKpis
              data={{
                todaySales: view.todaySales ?? 0,
                todaySalesCount: view.todaySalesCount ?? 0,
                overdueCount: view.overdueCount ?? 0,
                overdueAmount: view.overdueAmount ?? 0,
                lowStockCount: view.lowStockCount ?? 0,
                vatPendingCount: view.vatPendingCount ?? 0,
                pendingCollectionCount: view.pendingCollectionCount ?? 0,
                pendingApprovalsCount: view.pendingApprovalsCount ?? 0,
                todayPosSales: view.todayPosSales ?? 0,
                todayPosSalesCount: view.todayPosSalesCount ?? 0,
                todayPosVoidedCount: view.todayPosVoidedCount ?? 0,
                openPosShiftsCount: view.openPosShiftsCount ?? 0,
                openManagementAlertsCount: view.openManagementAlertsCount ?? 0,
              }}
              currency={currency}
            />
          ) : (
            <LockedHint label={t("title")} />
          )}

          {grant("stats") ? (
            <DashboardStats
              data={{
                revenue: view.revenue,
                expenses: view.expenses,
                profit: view.profit,
                invoiceCount: view.invoiceCount,
                customerCount: view.customerCount,
                productCount: view.productCount,
              }}
              currency={currency}
            />
          ) : null}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 min-w-0 overflow-hidden">
              {grant("cashFlow") ? (
                <RevenueChart data={view.cashFlow || []} />
              ) : (
                <LockedHint label="Cash flow" />
              )}
            </div>
            <div className="min-w-0">
              {grant("recentInvoices") ? (
                <RecentInvoices
                  invoices={view.recentInvoices || []}
                  currency={currency}
                />
              ) : (
                <LockedHint label="Invoices" />
              )}
            </div>
          </div>
        </>
      ) : null}

      {grant("collectPayment") ? (
        <RecordPaymentModal
          open={collectOpen}
          invoices={invoices
            .filter((i) => i.type === "SALES")
            .map((i) => ({
              ...i,
              total: Number(i.total),
              paidAmount: Number(i.paidAmount || 0),
            }))}
          currency={currency}
          onClose={() => setCollectOpen(false)}
        />
      ) : null}
    </div>
  );
}
