"use client";
import { Megaphone } from "lucide-react";

import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { PageHeader, GlassCard, LoadingSpinner, EmptyState } from "@/components/ui/page-shell";

interface AlertRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  createdAt: string;
}

export default function ManagementAlertsPage() {
  const t = useTranslations("managementAlerts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["management-alerts"],
    queryFn: async () => (await api.getManagementAlerts("OPEN")).data as AlertRow[],
    retry: false,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.resolveManagementAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-alerts"] });
      toast.success(tCommon("saved"));
    },
    onError: () => toast.error(t("forbidden")),
  });

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {error ? (
        <GlassCard className="p-6 text-amber-300 text-sm">{t("forbidden")}</GlassCard>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("empty")} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <GlassCard key={row.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{row.title}</p>
                  <p className="text-sm text-slate-400 mt-1">{row.message}</p>
                  <p className="text-xs text-slate-500 mt-2">
                    {row.type} · {row.severity} · {new Date(row.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => resolveMutation.mutate(row.id)}
                  className="text-xs px-3 py-1.5 rounded bg-emerald-600/20 text-emerald-300"
                >
                  {t("resolve")}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
