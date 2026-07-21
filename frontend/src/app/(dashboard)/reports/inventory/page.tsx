"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { ReportStatCards } from "@/components/reports/report-stat-cards";
import { ExportButtons } from "@/components/reports/export-buttons";

export default function InventoryReportPage() {
  const t = useTranslations("reportsInventory");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";

  const { data, isLoading } = useQuery({
    queryKey: ["report-inventory-summary"],
    queryFn: async () => {
      const res = await api.getInventorySummary();
      return res.data as {
        productCount: number;
        lowStockCount: number;
        totalCostValue: number;
        totalSaleValue: number;
        lowStock: { sku: string; name: string; quantity: number; minQuantity: number }[];
      };
    },
  });

  if (isLoading || !data) return <LoadingSpinner />;

  const exportRows = data.lowStock.map((p) => [
    p.sku,
    p.name,
    p.quantity,
    p.minQuantity,
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <ExportButtons
            filename="inventory-low-stock"
            headers={[t("sku"), t("product"), t("quantity"), t("minQty")]}
            rows={exportRows}
            printTitle={t("title")}
          />
        }
      />

      <ReportStatCards
        currency={currency}
        stats={[
          { label: t("productCount"), value: data.productCount, isCount: true },
          { label: t("lowStock"), value: data.lowStockCount, isCount: true, color: "text-amber-400" },
          { label: t("costValue"), value: data.totalCostValue, isMoney: true },
          { label: t("saleValue"), value: data.totalSaleValue, isMoney: true, color: "text-emerald-400" },
        ]}
      />

      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-amber-400" />
          <h3 className="font-semibold text-white">{t("lowStockList")}</h3>
        </div>
        {data.lowStock.length === 0 ? (
          <p className="text-sm text-slate-500">{t("noLowStock")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-slate-400 border-b border-slate-800">
                  <th className="text-right py-2">{t("sku")}</th>
                  <th className="text-right py-2">{t("product")}</th>
                  <th className="text-right py-2">{t("quantity")}</th>
                  <th className="text-right py-2">{t("minQty")}</th>
                </tr>
              </thead>
              <tbody>
                {data.lowStock.map((p) => (
                  <tr key={p.sku} className="border-b border-slate-800/50">
                    <td className="py-2 text-slate-400">{p.sku}</td>
                    <td className="py-2 text-white">{p.name}</td>
                    <td className="py-2 text-amber-400">{p.quantity}</td>
                    <td className="py-2 text-slate-400">{p.minQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
