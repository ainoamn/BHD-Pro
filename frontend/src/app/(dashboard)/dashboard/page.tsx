"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { DashboardStats } from "@/components/dashboard/stats";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentInvoices } from "@/components/dashboard/recent-invoices";
import { PageHeader, LoadingSpinner } from "@/components/ui/page-shell";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { SmartKpis } from "@/components/dashboard/smart-kpis";
import { OnboardingChecklist, OnboardingState } from "@/components/dashboard/onboarding-checklist";
import { RecordPaymentModal } from "@/components/invoices/record-payment-modal";

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
}

export default function DashboardPage() {
  const t = useTranslations("dashboard");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const [collectOpen, setCollectOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await api.getDashboardStats();
      return res.data as DashboardData;
    },
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const res = await api.getInvoices();
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {data?.onboarding && <OnboardingChecklist data={data.onboarding} />}

      <QuickActions
        todayReceived={data?.todayReceived ?? 0}
        todayExpenses={data?.todayExpenses ?? 0}
        pendingCollection={data?.pendingCollectionCount ?? 0}
        currency={currency}
        onCollect={() => setCollectOpen(true)}
      />

      {isLoading || !data ? (
        <LoadingSpinner />
      ) : (
        <>
          <SmartKpis
            data={{
              todaySales: data.todaySales ?? 0,
              todaySalesCount: data.todaySalesCount ?? 0,
              overdueCount: data.overdueCount ?? 0,
              overdueAmount: data.overdueAmount ?? 0,
              lowStockCount: data.lowStockCount ?? 0,
              vatPendingCount: data.vatPendingCount ?? 0,
              pendingCollectionCount: data.pendingCollectionCount ?? 0,
              pendingApprovalsCount: data.pendingApprovalsCount ?? 0,
              todayPosSales: data.todayPosSales ?? 0,
              todayPosSalesCount: data.todayPosSalesCount ?? 0,
              todayPosVoidedCount: data.todayPosVoidedCount ?? 0,
              openPosShiftsCount: data.openPosShiftsCount ?? 0,
              openManagementAlertsCount: data.openManagementAlertsCount ?? 0,
            }}
            currency={currency}
          />

          <DashboardStats
            data={{
              revenue: data.revenue,
              expenses: data.expenses,
              profit: data.profit,
              invoiceCount: data.invoiceCount,
              customerCount: data.customerCount,
              productCount: data.productCount,
            }}
            currency={currency}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="lg:col-span-2 min-w-0">
              <RevenueChart data={data.cashFlow} />
            </div>
            <div className="min-w-0">
              <RecentInvoices invoices={data.recentInvoices} currency={currency} />
            </div>
          </div>
        </>
      )}

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
    </div>
  );
}
