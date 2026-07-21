"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";

export default function CostCentersPage() {
  const t = useTranslations("erp");
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.getBranches()).data as { id: string; name: string }[],
  });

  return (
    <ErpCrudPage
      title={t("costCentersTitle")}
      subtitle={t("costCentersSubtitle")}
      queryKey="cost-centers"
      emptyLabel={t("costCentersTitle")}
      fetchAll={() => api.getCostCenters()}
      create={(d) => api.createCostCenter(d)}
      update={(id, d) => api.updateCostCenter(id, d)}
      remove={(id) => api.deleteCostCenter(id)}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("name") },
        {
          key: "branch",
          label: t("branch"),
          render: (r) => (r as { branch?: { name: string } }).branch?.name || "—",
        },
      ]}
      fields={[
        { key: "code", label: t("code"), required: true },
        { key: "name", label: t("name"), required: true },
        {
          key: "branchId",
          label: t("branch"),
          type: "select",
          options: branches.map((b) => ({ value: b.id, label: b.name })),
        },
      ]}
    />
  );
}
