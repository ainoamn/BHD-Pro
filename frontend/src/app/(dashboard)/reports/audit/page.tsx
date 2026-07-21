"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import api from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";

interface AuditRow {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  userName: string;
  userEmail?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  summary: string;
}

interface AuditResponse {
  total: number;
  limit: number;
  rows: AuditRow[];
}

export default function AuditLogPage() {
  const t = useTranslations("auditLog");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["report-audit-log", entity, action],
    queryFn: async () => {
      const res = await api.getAuditLog({
        limit: 150,
        entity: entity || undefined,
        action: action || undefined,
      });
      return res.data as AuditResponse;
    },
  });

  const rows = data?.rows || [];

  const actionClass = (a: string) => {
    if (a === "DELETE") return "bg-rose-500/10 text-rose-400";
    if (a === "CREATE" || a === "PAYMENT") return "bg-emerald-500/10 text-emerald-400";
    if (a === "LOCK") return "bg-amber-500/10 text-amber-400";
    return "bg-slate-800 text-slate-300";
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <GlassCard className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="text-xs text-slate-400">{t("entity")}</label>
          <input
            value={entity}
            onChange={(e) => setEntity(e.target.value)}
            placeholder="invoices, journals, periods…"
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400">{t("action")}</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
          >
            <option value="">{t("allActions")}</option>
            {["CREATE", "UPDATE", "DELETE", "PAYMENT", "LOCK", "UNLOCK", "ADJUST", "TOGGLE"].map(
              (a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              )
            )}
          </select>
        </div>
        <div className="flex items-end">
          <p className="text-sm text-slate-400">
            {t("showing", { count: rows.length, total: data?.total ?? 0 })}
          </p>
        </div>
      </GlassCard>

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={t("empty")} description={t("emptyHint")} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white text-sm font-medium">{row.summary}</p>
                  <span className={cn("text-xs px-2 py-0.5 rounded shrink-0", actionClass(row.action))}>
                    {row.action}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{row.userName}</span>
                  <span>{formatDate(row.createdAt)}</span>
                </div>
                <p className="text-xs text-slate-600">{row.entity}</p>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="text-right px-4 py-3">{t("when")}</th>
                    <th className="text-right px-4 py-3">{t("user")}</th>
                    <th className="text-right px-4 py-3">{t("action")}</th>
                    <th className="text-right px-4 py-3">{t("entity")}</th>
                    <th className="text-right px-4 py-3">{t("summary")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{row.userName}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-1 rounded", actionClass(row.action))}>
                          {row.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{row.entity}</td>
                      <td className="px-4 py-3 text-white">{row.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}
