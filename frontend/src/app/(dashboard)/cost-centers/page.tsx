"use client";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCcw, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { ErpCrudPage } from "@/components/erp/erp-crud-page";

export default function CostCentersPage() {
  const t = useTranslations("erp");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const { data: branches = [] } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => (await api.getBranches()).data as { id: string; name: string }[],
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

  return (
    <div className="space-y-4">
      <div className="glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-slate-400">{t("costCentersDemoHint")}</p>
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
            key: "description",
            label: t("description"),
            render: (r) => (r as { description?: string }).description || "—",
          },
          {
            key: "branch",
            label: t("branch"),
            render: (r) => (r as { branch?: { name: string } }).branch?.name || "—",
          },
        ]}
        fields={[
          { key: "code", label: t("code"), required: true },
          { key: "name", label: t("name"), required: true },
          { key: "description", label: t("description"), type: "textarea" },
          {
            key: "branchId",
            label: t("branch"),
            type: "select",
            options: branches.map((b) => ({ value: b.id, label: b.name })),
          },
        ]}
      />
    </div>
  );
}
