"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage, formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";

export default function ProjectsPage() {
  const t = useTranslations("erp");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const { company } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.getBranches()).data as { id: string; name: string }[],
  });
  const { data: costCenters = [] } = useQuery({
    queryKey: ["cost-centers"],
    queryFn: async () => (await api.getCostCenters()).data as { id: string; name: string; code: string }[],
  });

  const seedMutation = useMutation({
    mutationFn: () => api.seedDefaultAnalytics(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cost-centers"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("defaultsRestored"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      ACTIVE: tStatus("active"),
      PLANNED: tStatus("planned"),
      COMPLETED: tStatus("completed"),
      ON_HOLD: tStatus("onHold"),
      CANCELLED: tStatus("cancelled"),
    };
    return map[status] || status;
  };

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-400">{t("projectsDemoHint")}</p>
        <button
          type="button"
          onClick={() => seedMutation.mutate()}
          disabled={seedMutation.isPending}
          className="inline-flex items-center justify-center gap-2 px-3 py-2 text-sm rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50 shrink-0"
        >
          {seedMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4" />
          )}
          {t("restoreDefaults")}
        </button>
      </div>

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
            key: "description",
            label: t("description"),
            render: (r) => (r as { description?: string }).description || "—",
          },
          {
            key: "costCenter",
            label: t("costCenter"),
            render: (r) => {
              const cc = (r as Record<string, unknown>).costCenter as { name?: string } | null;
              return cc?.name || "—";
            },
          },
          {
            key: "budget",
            label: t("budget"),
            render: (r) => formatMoney(Number((r as Record<string, unknown>).budget), company?.currency || "OMR"),
          },
          {
            key: "status",
            label: t("status"),
            render: (r) => statusLabel(String((r as Record<string, unknown>).status || "")),
          },
        ]}
        fields={[
          { key: "code", label: t("code"), required: true },
          { key: "name", label: t("name"), required: true },
          { key: "description", label: t("description"), type: "textarea" },
          { key: "budget", label: t("budget"), type: "number" },
          {
            key: "branchId",
            label: t("branch"),
            type: "select",
            options: branches.map((b) => ({ value: b.id, label: b.name })),
          },
          {
            key: "costCenterId",
            label: t("costCenter"),
            type: "select",
            options: costCenters.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` })),
          },
          {
            key: "status",
            label: t("status"),
            type: "select",
            options: [
              { value: "ACTIVE", label: tStatus("active") },
              { value: "PLANNED", label: tStatus("planned") },
              { value: "COMPLETED", label: tStatus("completed") },
            ],
          },
        ]}
      />
    </div>
  );
}
