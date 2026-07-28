"use client";

import { useState } from "react";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import api from "@/lib/api";
import {
  PageHeader,
  GlassCard,
  LoadingSpinner,
  EmptyState,
  QueryError,
} from "@/components/ui/page-shell";
import { apiErrorMessage, cn } from "@/lib/utils";

type DisputeStatus = "OPEN" | "REVIEWED" | "RESOLVED" | "DISMISSED" | "ALL";

type DisputeRow = {
  id: string;
  status: string;
  reason: string;
  reporterName?: string | null;
  reporterPhone?: string | null;
  publicCode: string;
  createdAt: string;
  invoice: {
    id: string;
    number: string;
    total: number;
    status: string;
    date: string;
  };
};

const STATUSES: DisputeStatus[] = [
  "OPEN",
  "REVIEWED",
  "RESOLVED",
  "DISMISSED",
  "ALL",
];

export default function CustomerDisputesPage() {
  const t = useTranslations("customerDisputes");
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<DisputeStatus>("OPEN");

  const { data: rows = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ["customer-disputes", status],
    queryFn: async () =>
      (await api.getCustomerDisputes(status === "ALL" ? undefined : status))
        .data as DisputeRow[],
    retry: false,
  });

  const isForbidden =
    !!error &&
    typeof error === "object" &&
    "response" in error &&
    (error as { response?: { status?: number } }).response?.status === 403;

  const patchMutation = useMutation({
    mutationFn: ({ id, next }: { id: string; next: string }) =>
      api.updateCustomerDisputeStatus(id, next),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["customer-disputes"] });
      const notify = (
        res.data as {
          reporterNotify?: { status?: string };
        }
      )?.reporterNotify;
      const st = notify?.status;
      if (st === "ok") toast.success(t("reporterNotifyOk"));
      else if (st === "mock")
        toast(t("reporterNotifyMock"), { icon: "🧪", duration: 6000 });
      else if (st === "fail")
        toast(t("reporterNotifyFail"), { icon: "⚠️", duration: 6000 });
      else toast.success(t("reporterNotifySkipped"));
    },
    onError: (err) => toast.error(apiErrorMessage(err, t("forbidden"))),
  });

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
              "rounded-lg px-3 py-1.5 text-xs font-bold border",
              status === s
                ? "bg-amber-500 text-slate-950 border-amber-400"
                : "bg-slate-900 text-slate-300 border-slate-700",
            )}
          >
            {t(`status_${s}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <QueryError
          onRetry={() => refetch()}
          message={isForbidden ? t("forbidden") : undefined}
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ShieldAlert}
          title={t("empty")}
          description={t("emptyHint")}
        />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <GlassCard key={row.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">
                    {t("invoice")}{" "}
                    <Link
                      href="/sales"
                      className="text-amber-300 hover:underline"
                    >
                      {row.invoice.number}
                    </Link>
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(row.createdAt).toLocaleString()} ·{" "}
                    {Number(row.invoice.total).toFixed(3)} · {row.invoice.status}
                  </p>
                </div>
                <span className="text-[11px] font-bold rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-200 px-2 py-1">
                  {t(`status_${row.status}` as "status_OPEN")}
                </span>
              </div>
              <p className="text-sm text-slate-200 whitespace-pre-wrap">{row.reason}</p>
              <p className="text-xs text-slate-500">
                {[row.reporterName, row.reporterPhone].filter(Boolean).join(" · ") ||
                  t("anonymous")}
                {" · "}
                <span className="font-mono">{row.publicCode}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {(["REVIEWED", "RESOLVED", "DISMISSED", "OPEN"] as const)
                  .filter((s) => s !== row.status)
                  .map((next) => (
                    <button
                      key={next}
                      type="button"
                      disabled={patchMutation.isPending}
                      onClick={() =>
                        patchMutation.mutate({ id: row.id, next })
                      }
                      className="rounded-lg border border-slate-600 px-2.5 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                    >
                      {t(`mark_${next}`)}
                    </button>
                  ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
