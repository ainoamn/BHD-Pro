"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { ReportStatCards } from "@/components/reports/report-stat-cards";
import { ExportButtons } from "@/components/reports/export-buttons";

export default function VatReportPage() {
  const t = useTranslations("reportsVat");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data, isLoading } = useQuery({
    queryKey: ["report-vat-summary"],
    queryFn: async () => {
      const res = await api.getVatSummary();
      return res.data as {
        outputVat: number;
        inputVat: number;
        netVat: number;
        salesInvoiceCount: number;
        purchaseInvoiceCount: number;
        salesTotal: number;
        purchaseTotal: number;
      };
    },
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const exportRows: (string | number)[][] = [
    [t("outputVat"), data.outputVat],
    [t("inputVat"), data.inputVat],
    [t("netVat"), data.netVat],
    [t("salesTotal"), data.salesTotal],
    [t("purchaseTotal"), data.purchaseTotal],
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <ExportButtons
            filename="vat-report"
            headers={[t("item"), t("amount")]}
            rows={exportRows}
            printTitle={t("title")}
          />
        }
      />

      <ReportStatCards
        currency={currency}
        stats={[
          { label: t("outputVat"), value: data.outputVat, isMoney: true, color: "text-emerald-400" },
          { label: t("inputVat"), value: data.inputVat, isMoney: true, color: "text-rose-400" },
          { label: t("netVat"), value: data.netVat, isMoney: true, color: "text-white" },
          {
            label: t("invoiceCount"),
            value: `${data.salesInvoiceCount} / ${data.purchaseInvoiceCount}`,
          },
        ]}
      />

      <GlassCard className="p-5 space-y-3">
        <div className="flex justify-between text-sm py-2 border-b border-slate-800/50">
          <span className="text-slate-400">{t("salesTotal")}</span>
          <span className="text-white">{formatMoney(data.salesTotal, currency)}</span>
        </div>
        <div className="flex justify-between text-sm py-2">
          <span className="text-slate-400">{t("purchaseTotal")}</span>
          <span className="text-white">{formatMoney(data.purchaseTotal, currency)}</span>
        </div>
      </GlassCard>
    </div>
  );
}
