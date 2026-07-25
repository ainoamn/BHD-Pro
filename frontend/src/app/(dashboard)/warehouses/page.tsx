"use client";

import { useTranslations } from "next-intl";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";

export default function WarehousesPage() {
  const t = useTranslations("erp");
  return (
    <ErpCrudPage
      title={t("warehousesTitle")}
      subtitle={t("warehousesSubtitle")}
      queryKey="warehouses"
      emptyLabel={t("warehousesTitle")}
      fetchAll={() => api.getWarehouses()}
      create={(d) => api.createWarehouse(d)}
      update={(id, d) => api.updateWarehouse(id, d)}
      remove={(id) => api.deleteWarehouse(id)}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("nameAr") },
        {
          key: "nameEn",
          label: t("nameEn"),
          render: (r) => (r as { nameEn?: string | null }).nameEn || "—",
        },
        {
          key: "address",
          label: t("location"),
          render: (r) => (r as { address?: string | null }).address || "—",
        },
        {
          key: "isActive",
          label: t("status"),
          render: (r) =>
            (r as { isActive?: boolean }).isActive === false ? "—" : "✓",
        },
      ]}
      fields={[
        { key: "code", label: t("code"), required: true },
        { key: "name", label: t("nameAr"), required: true, placeholder: t("nameArPlaceholder") },
        { key: "nameEn", label: t("nameEn"), required: true, placeholder: t("nameEnPlaceholder") },
        { key: "address", label: t("location") },
      ]}
    />
  );
}
