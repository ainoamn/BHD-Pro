"use client";

import { useTranslations } from "next-intl";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";

export default function BranchesPage() {
  const t = useTranslations("erp");
  return (
    <ErpCrudPage
      title={t("branchesTitle")}
      subtitle={t("branchesSubtitle")}
      queryKey="branches"
      emptyLabel={t("branchesTitle")}
      fetchAll={() => api.getBranches()}
      create={(d) => api.createBranch(d)}
      update={(id, d) => api.updateBranch(id, d)}
      remove={(id) => api.deleteBranch(id)}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("name") },
        { key: "city", label: t("branch") },
        {
          key: "isHeadOffice",
          label: t("headOffice"),
          render: (r) => ((r as { isHeadOffice?: boolean }).isHeadOffice ? "✓" : "—"),
        },
      ]}
      fields={[
        { key: "code", label: t("code"), required: true },
        { key: "name", label: t("name"), required: true },
        { key: "city", label: t("branch") },
        { key: "phone", label: "Phone" },
        { key: "address", label: "Address" },
      ]}
    />
  );
}
