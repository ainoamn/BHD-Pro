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
  pendingCollectionCount?: number;
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
        contact?: { name: string };
      }[];
    },
    enabled: collectOpen,
  });

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RevenueChart data={data.cashFlow} />
            </div>
            <div>
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
