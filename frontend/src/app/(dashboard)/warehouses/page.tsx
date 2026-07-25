"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";

type Branch = { id: string; code: string; name: string };
type Warehouse = {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  address?: string | null;
  sector?: string;
  branchId?: string | null;
  isActive?: boolean;
};

export default function WarehousesPage() {
  const t = useTranslations("erp");
  const { data: branches = [] } = useQuery({
    queryKey: ["branches-for-warehouses"],
    queryFn: async () => {
      const res = await api.getBranches();
      return (res.data as Branch[]) || [];
    },
  });

  const sectorLabel = (s?: string) => {
    if (s === "RESTAURANT") return "مطاعم / Restaurant";
    if (s === "RETAIL") return "تجزئة / Retail";
    return "عام / General";
  };

  return (
    <ErpCrudPage<Warehouse>
      title={t("warehousesTitle")}
      subtitle={t("warehousesSubtitle")}
      queryKey="warehouses"
      emptyLabel={t("warehousesTitle")}
      fetchAll={() => api.getWarehouses()}
      create={(d) =>
        api.createWarehouse({
          ...d,
          branchId: d.branchId || undefined,
        })
      }
      update={(id, d) =>
        api.updateWarehouse(id, {
          ...d,
          branchId: d.branchId || null,
        })
      }
      remove={(id) => api.deleteWarehouse(id)}
      toForm={(r) => ({
        code: r.code,
        name: r.name,
        nameEn: r.nameEn || "",
        address: r.address || "",
        sector: r.sector || "GENERAL",
        branchId: r.branchId || "",
      })}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("nameAr") },
        {
          key: "sector",
          label: "القطاع",
          render: (r) => sectorLabel(r.sector),
        },
        {
          key: "branchId",
          label: t("branch"),
          render: (r) => {
            const b = branches.find((x) => x.id === r.branchId);
            return b ? `${b.code} · ${b.name}` : "—";
          },
        },
        {
          key: "address",
          label: t("location"),
          render: (r) => r.address || "—",
        },
        {
          key: "isActive",
          label: t("status"),
          render: (r) => (r.isActive === false ? "—" : "✓"),
        },
      ]}
      fields={[
        { key: "code", label: t("code"), required: true },
        { key: "name", label: t("nameAr"), required: true, placeholder: t("nameArPlaceholder") },
        { key: "nameEn", label: t("nameEn"), required: true, placeholder: t("nameEnPlaceholder") },
        {
          key: "sector",
          label: "القطاع / Sector",
          type: "select",
          required: true,
          options: [
            { value: "GENERAL", label: "عام / General" },
            { value: "RETAIL", label: "تجزئة / Retail" },
            { value: "RESTAURANT", label: "مطاعم / Restaurant" },
          ],
        },
        {
          key: "branchId",
          label: t("branch"),
          type: "select",
          options: [
            { value: "", label: "—" },
            ...branches.map((b) => ({
              value: b.id,
              label: `${b.code} · ${b.name}`,
            })),
          ],
        },
        { key: "address", label: t("location") },
      ]}
    />
  );
}
