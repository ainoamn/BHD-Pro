"use client";

import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";

interface AssetRow {
  id: string;
  code: string;
  name: string;
  category: string;
  purchaseDate?: string | null;
  purchaseCost: number;
  currentValue: number;
  depreciationRate: number;
  location?: string | null;
}

export default function AssetsPage() {
  const t = useTranslations("erp");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();

  const depreciateMutation = useMutation({
    mutationFn: (id: string) => api.depreciateAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      toast.success(t("depreciated"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  return (
    <ErpCrudPage<AssetRow>
      title={t("assetsTitle")}
      subtitle={t("assetsSubtitle")}
      queryKey="assets"
      emptyLabel={t("assetsTitle")}
      currency={currency}
      fetchAll={() => api.getAssets()}
      create={(d) => api.createAsset(d)}
      update={(id, d) => api.updateAsset(id, d)}
      remove={(id) => api.deleteAsset(id)}
      toForm={(row) => ({
        code: row.code,
        name: row.name,
        category: row.category,
        purchaseDate: row.purchaseDate ? String(row.purchaseDate).split("T")[0] : "",
        purchaseCost: Number(row.purchaseCost),
        currentValue: Number(row.currentValue),
        depreciationRate: Number(row.depreciationRate),
        location: row.location || "",
      })}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("name") },
        { key: "category", label: t("category") },
        {
          key: "purchaseCost",
          label: t("purchaseCost"),
          render: (r) => formatMoney(Number(r.purchaseCost), currency),
        },
        {
          key: "currentValue",
          label: t("currentValue"),
          render: (r) => formatMoney(Number(r.currentValue), currency),
        },
        {
          key: "depreciationRate",
          label: t("depreciationRate"),
          render: (r) => `${Number(r.depreciationRate)}%`,
        },
      ]}
      fields={[
        { key: "code", label: t("code"), required: true },
        { key: "name", label: t("name"), required: true },
        {
          key: "category",
          label: t("category"),
          type: "select",
          options: [
            { value: "BUILDING", label: "Building" },
            { value: "VEHICLE", label: "Vehicle" },
            { value: "EQUIPMENT", label: "Equipment" },
            { value: "IT", label: "IT" },
            { value: "OTHER", label: "Other" },
          ],
        },
        { key: "purchaseDate", label: t("purchaseDate"), type: "date" },
        { key: "purchaseCost", label: t("purchaseCost"), type: "number" },
        { key: "currentValue", label: t("currentValue"), type: "number" },
        { key: "depreciationRate", label: t("depreciationRate"), type: "number" },
        { key: "location", label: t("location") },
      ]}
      rowActions={(row) =>
        Number(row.depreciationRate) > 0 && Number(row.currentValue) > 0 ? (
          <button
            type="button"
            disabled={depreciateMutation.isPending}
            onClick={() => {
              if (confirm(t("depreciateConfirm"))) depreciateMutation.mutate(row.id);
            }}
            className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 disabled:opacity-50"
          >
            {t("depreciate")}
          </button>
        ) : null
      }
    />
  );
}
