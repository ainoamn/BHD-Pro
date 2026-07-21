"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";

export default function ProjectsPage() {
  const t = useTranslations("erp");
  const { company } = useAuthStore();
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.getBranches()).data as { id: string; name: string }[],
  });

  return (
    <ErpCrudPage
      title={t("projectsTitle")}
      subtitle={t("projectsSubtitle")}
      queryKey="projects"
      emptyLabel={t("projectsTitle")}
      currency={company?.currency}
      fetchAll={() => api.getProjects()}
      create={(d) => api.createProject(d)}
      update={(id, d) => api.updateProject(id, d)}
      remove={(id) => api.deleteProject(id)}
      columns={[
        { key: "code", label: t("code") },
        { key: "name", label: t("name") },
        {
          key: "budget",
          label: t("budget"),
          render: (r) => formatMoney(Number((r as Record<string, unknown>).budget), company?.currency || "OMR"),
        },
        { key: "status", label: t("status") },
      ]}
      fields={[
        { key: "code", label: t("code"), required: true },
        { key: "name", label: t("name"), required: true },
        { key: "budget", label: t("budget"), type: "number" },
        {
          key: "branchId",
          label: t("branch"),
          type: "select",
          options: branches.map((b) => ({ value: b.id, label: b.name })),
        },
        {
          key: "status",
          label: t("status"),
          type: "select",
          options: [
            { value: "ACTIVE", label: "Active" },
            { value: "PLANNED", label: "Planned" },
            { value: "COMPLETED", label: "Completed" },
          ],
        },
      ]}
    />
  );
}
