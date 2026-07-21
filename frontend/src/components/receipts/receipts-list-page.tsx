"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Receipt } from "lucide-react";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";

interface ReceiptRow {
  id: string;
  amount: number;
  method: string;
  reference?: string;
  date: string;
  notes?: string;
  invoice: {
    id: string;
    number: string;
    type: string;
    contact: { id: string; name: string; nameEn?: string };
  };
}

interface ReceiptsListPageProps {
  direction: "SALES" | "PURCHASE";
  title: string;
  subtitle: string;
  emptyLabel: string;
}

export function ReceiptsListPage({
  direction,
  title,
  subtitle,
  emptyLabel,
}: ReceiptsListPageProps) {
  const t = useTranslations("receipts");
  const tInvoices = useTranslations("invoices");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payment-vouchers", direction],
    queryFn: async () => {
      const res = await api.getPaymentVouchers(direction);
      return res.data as ReceiptRow[];
    },
  });

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <p className="text-xs text-slate-400">{t("count")}</p>
          <p className="text-2xl font-bold text-white mt-1">{rows.length}</p>
        </GlassCard>
        <GlassCard className="p-4 sm:col-span-2">
          <p className="text-xs text-slate-400">{t("totalAmount")}</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatMoney(total, currency)}</p>
        </GlassCard>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title={emptyLabel} />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400">
                  <th className="text-right px-4 py-3 font-medium">{t("date")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("contact")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("invoice")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("method")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("reference")}</th>
                  <th className="text-right px-4 py-3 font-medium">{t("amount")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-slate-300">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-white">{row.invoice.contact.name}</td>
                    <td className="px-4 py-3 text-slate-300">{row.invoice.number}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {tInvoices(`method_${row.method}` as "method_CASH")}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{row.reference || "—"}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">
                      {formatMoney(row.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
