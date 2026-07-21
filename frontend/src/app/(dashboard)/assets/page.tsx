"use client";

import { useTranslations } from "next-intl";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";

export default function AssetsPage() {
  const t = useTranslations("erp");
  const { company } = useAuthStore();

  return (
    <ErpCrudPage
      title={t("assetsTitle")}
      subtitle={t("assetsSubtitle")}
      queryKey="assets"
      emptyLabel={t("assetsTitle")}
      currency={company?.currency}
      fetchAll={() => api.getAssets()}
      create={(d) => api.createAsset(d)}
      update={(id, d) => api.updateAsset(id, d)}
      remove={(id) => api.deleteAsset(id)}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("name") },
        { key: "category", label: t("category") },
        {
          key: "purchaseCost",
          label: t("purchaseCost"),
          render: (r) =>
            formatMoney(Number((r as Record<string, unknown>).purchaseCost), company?.currency || "OMR"),
        },
        {
          key: "currentValue",
          label: t("currentValue"),
          render: (r) =>
            formatMoney(Number((r as Record<string, unknown>).currentValue), company?.currency || "OMR"),
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
        { key: "purchaseCost", label: t("purchaseCost"), type: "number" },
        { key: "location", label: "Location" },
      ]}
    />
  );
}
