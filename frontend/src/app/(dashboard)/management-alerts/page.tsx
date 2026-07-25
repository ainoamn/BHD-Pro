"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { PageHeader, GlassCard, LoadingSpinner, EmptyState } from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";

type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED" | "ALL";

interface AlertRow {
  id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  status: string;
  entityType?: string | null;
  entityId?: string | null;
  payloadJson?: {
    invoiceId?: string;
    invoiceNumber?: string;
    reference?: string;
    otherPaymentId?: string;
    similarIds?: string[];
    invoices?: string[];
  } | null;
  createdAt: string;
}

const STATUSES: AlertStatus[] = ["OPEN", "ACKNOWLEDGED", "RESOLVED", "DISMISSED", "ALL"];

function severityClass(severity: string) {
  if (severity === "HIGH") return "bg-rose-500/15 text-rose-300 border-rose-500/30";
  if (severity === "LOW") return "bg-slate-500/15 text-slate-300 border-slate-500/30";
  return "bg-amber-500/15 text-amber-300 border-amber-500/30";
}

export default function ManagementAlertsPage() {
  const t = useTranslations("managementAlerts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AlertStatus>("OPEN");

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["management-alerts", status],
    queryFn: async () =>
      (await api.getManagementAlerts(status === "ALL" ? undefined : status)).data as AlertRow[],
    retry: false,
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api.resolveManagementAlert(id, next),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["management-alerts"] });
      toast.success(tCommon("saved"));
    },
    onError: () => toast.error(t("forbidden")),
  });

  const sorted = useMemo(() => {
    const rank = (s: string) => (s === "HIGH" ? 0 : s === "MEDIUM" ? 1 : 2);
    return [...rows].sort((a, b) => rank(a.severity) - rank(b.severity));
  }, [rows]);

  return (
    <div className="space-y-4">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs border transition-colors",
              status === s
                ? "bg-emerald-600/20 text-emerald-300 border-emerald-500/40"
                : "bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200",
            )}
          >
            {t(`status.${s}`)}
          </button>
        ))}
      </div>

      {error ? (
        <GlassCard className="p-6 text-amber-300 text-sm">{t("forbidden")}</GlassCard>
      ) : isLoading ? (
        <LoadingSpinner />
      ) : sorted.length === 0 ? (
        <EmptyState icon={Megaphone} title={t("empty")} />
      ) : (
        <div className="space-y-3">
          {sorted.map((row) => {
            const payload = row.payloadJson || {};
            const invoiceHint =
              payload.invoiceNumber ||
              (payload.invoices && payload.invoices.length
                ? payload.invoices.slice(0, 3).join(", ")
                : null);

            return (
              <GlassCard key={row.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "text-[10px] uppercase tracking-wide px-2 py-0.5 rounded border",
                          severityClass(row.severity),
                        )}
                      >
                        {t(`severity.${row.severity}` as "severity.HIGH")}
                      </span>
                      <span className="text-[10px] text-slate-500">{row.type}</span>
                      <span className="text-[10px] text-slate-500">
                        {t(`status.${row.status}` as "status.OPEN")}
                      </span>
                    </div>
                    <p className="text-white font-medium">{row.title}</p>
                    <p className="text-sm text-slate-400">{row.message}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(row.createdAt).toLocaleString()}
                      {invoiceHint ? ` · ${t("relatedInvoice")}: ${invoiceHint}` : ""}
                    </p>
                    {row.entityType === "PAYMENT" && payload.invoiceId ? (
                      <Link
                        href={`/accounting?open=${payload.invoiceId}`}
                        className="inline-block text-xs text-sky-400 hover:text-sky-300 mt-1"
                      >
                        {t("openInvoice")}
                        {payload.invoiceNumber ? ` · ${payload.invoiceNumber}` : ""}
                      </Link>
                    ) : row.entityType === "PAYMENT" ? (
                      <Link
                        href="/accounting?tab=sales"
                        className="inline-block text-xs text-sky-400 hover:text-sky-300 mt-1"
                      >
                        {t("openInvoices")}
                      </Link>
                    ) : null}
                  </div>
                </div>

                {row.status === "OPEN" || row.status === "ACKNOWLEDGED" ? (
                  <div className="flex flex-wrap gap-2">
                    {row.status === "OPEN" && (
                      <button
                        type="button"
                        disabled={patchMutation.isPending}
                        onClick={() =>
                          patchMutation.mutate({ id: row.id, next: "ACKNOWLEDGED" })
                        }
                        className="text-xs px-3 py-1.5 rounded bg-sky-600/20 text-sky-300"
                      >
                        {t("acknowledge")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={patchMutation.isPending}
                      onClick={() => patchMutation.mutate({ id: row.id, next: "RESOLVED" })}
                      className="text-xs px-3 py-1.5 rounded bg-emerald-600/20 text-emerald-300"
                    >
                      {t("resolve")}
                    </button>
                    <button
                      type="button"
                      disabled={patchMutation.isPending}
                      onClick={() => patchMutation.mutate({ id: row.id, next: "DISMISSED" })}
                      className="text-xs px-3 py-1.5 rounded bg-slate-700 text-slate-300"
                    >
                      {t("dismiss")}
                    </button>
                  </div>
                ) : null}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
