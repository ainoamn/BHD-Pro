"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, GlassCard, EmptyState } from "@/components/ui/page-shell";
import { ExportButtons } from "@/components/reports/export-buttons";
import { BookOpen } from "lucide-react";

export default function LedgerReportPage() {
  const t = useTranslations("reportsLedger");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const [accountId, setAccountId] = useState("");

  const { data: accounts = [] } = useQuery({
    queryKey: ["chart-accounts-flat"],
    queryFn: async () => {
      const res = await api.getAccounts();
      return res.data as { id: string; code: string; name: string }[];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-general-ledger", accountId],
    queryFn: async () => {
      const res = await api.getGeneralLedger(accountId || undefined);
      return res.data as {
        entries: {
          id: string;
          date: string;
          journalNumber: string;
          reference?: string;
          description?: string;
          accountCode: string;
          accountName: string;
          costCenter?: string | null;
          project?: string | null;
          debit: number;
          credit: number;
          balance: number;
        }[];
      };
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          data?.entries.length ? (
            <ExportButtons
              filename="general-ledger"
              headers={[
                t("date"),
                t("journal"),
                t("account"),
                t("description"),
                t("costCenter"),
                t("project"),
                t("debit"),
                t("credit"),
                t("balance"),
              ]}
              rows={
                data?.entries.map((e) => [
                  formatDate(e.date),
                  e.journalNumber,
                  e.accountCode,
                  e.description || "",
                  e.costCenter || "",
                  e.project || "",
                  e.debit,
                  e.credit,
                  e.balance,
                ]) || []
              }
              printTitle={t("title")}
            />
          ) : undefined
        }
      />

      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        className="w-full max-w-md bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-white text-sm"
      >
        <option value="">{t("allAccounts")}</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.code} — {a.name}
          </option>
        ))}
      </select>

      {isLoading ? (
        <LoadingSpinner />
      ) : !data?.entries.length ? (
        <EmptyState icon={BookOpen} title={t("empty")} />
      ) : (
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="border-b border-slate-700/50 text-slate-400">
                  <th className="text-right px-3 py-3">{t("date")}</th>
                  <th className="text-right px-3 py-3">{t("journal")}</th>
                  <th className="text-right px-3 py-3">{t("account")}</th>
                  <th className="text-right px-3 py-3">{t("description")}</th>
                  <th className="text-right px-3 py-3">{t("costCenter")}</th>
                  <th className="text-right px-3 py-3">{t("project")}</th>
                  <th className="text-right px-3 py-3">{t("debit")}</th>
                  <th className="text-right px-3 py-3">{t("credit")}</th>
                  <th className="text-right px-3 py-3">{t("balance")}</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-3 py-2 text-slate-300">{formatDate(e.date)}</td>
                    <td className="px-3 py-2 text-slate-400">{e.journalNumber}</td>
                    <td className="px-3 py-2 text-white">{e.accountCode}</td>
                    <td className="px-3 py-2 text-slate-400 max-w-[200px] truncate">
                      {e.description || "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-400">{e.costCenter || "—"}</td>
                    <td className="px-3 py-2 text-slate-400">{e.project || "—"}</td>
                    <td className="px-3 py-2 text-slate-300">
                      {e.debit > 0 ? formatMoney(e.debit, currency) : "—"}
                    </td>
                    <td className="px-3 py-2 text-slate-300">
                      {e.credit > 0 ? formatMoney(e.credit, currency) : "—"}
                    </td>
                    <td className="px-3 py-2 text-emerald-400 font-medium">
                      {formatMoney(e.balance, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
