"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";

interface AssetRow {
  id: string;
  code: string;
  name: string;
  category: string;
  accountId?: string | null;
  purchaseDate?: string | null;
  purchaseCost: number;
  currentValue: number;
  depreciationRate: number;
  location?: string | null;
}

const CATEGORIES = ["BUILDING", "VEHICLE", "EQUIPMENT", "IT", "OTHER"] as const;

export default function AssetsPage() {
  const t = useTranslations("erp");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.getAccounts();
      return res.data as { id: string; code: string; name: string; type: string }[];
    },
  });

  const assetAccounts = accounts.filter((a) => a.type === "ASSET");

  const categoryOptions = CATEGORIES.map((c) => ({
    value: c,
    label: t(`assetCat_${c}` as "assetCat_BUILDING"),
  }));

  const depreciateMutation = useMutation({
    mutationFn: (id: string) => api.depreciateAsset(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assets"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-tree"] });
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
        accountId: row.accountId || "",
        purchaseDate: row.purchaseDate ? String(row.purchaseDate).split("T")[0] : "",
        purchaseCost: Number(row.purchaseCost),
        currentValue: Number(row.currentValue),
        depreciationRate: Number(row.depreciationRate),
        location: row.location || "",
      })}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("name") },
        {
          key: "category",
          label: t("category"),
          render: (r) => t(`assetCat_${r.category}` as "assetCat_BUILDING"),
        },
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
        { key: "category", label: t("category"), type: "select", options: categoryOptions },
        {
          key: "accountId",
          label: t("glAccount"),
          type: "select",
          options: assetAccounts.map((a) => ({ value: a.id, label: `${a.code} — ${a.name}` })),
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
