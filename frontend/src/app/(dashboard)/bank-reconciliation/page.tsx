"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2, Check, X, Landmark, FileText } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";

interface BankOption {
  id: string;
  name: string;
  bankName: string;
  accountNumber: string;
  currency: string;
}

interface StatementLine {
  id: string;
  date: string;
  description: string;
  reference?: string | null;
  amount: number;
  isReconciled: boolean;
}

interface ReconReport {
  bankAccount: BankOption & { openingBalance: number };
  bookBalance: number;
  statementBalance: number;
  difference: number;
  reconciledCount: number;
  unreconciledCount: number;
  reconciledTotal: number;
  unreconciledTotal: number;
  lines: StatementLine[];
}

export default function BankReconciliationPage() {
  const t = useTranslations("bankRecon");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();

  const [bankId, setBankId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState(0);

  const { data: banks = [], isLoading: banksLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const res = await api.getBankAccounts();
      return res.data as BankOption[];
    },
  });

  const selectedId = bankId || banks[0]?.id || "";

  const { data: report, isLoading: reportLoading } = useQuery({
    queryKey: ["bank-reconciliation", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const res = await api.getBankReconciliation(selectedId);
      return res.data as ReconReport;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["bank-reconciliation", selectedId] });
  };

  const addMutation = useMutation({
    mutationFn: () =>
      api.addBankStatementLine(selectedId, {
        date,
        description: description.trim(),
        reference: reference.trim() || undefined,
        amount: Number(amount),
      }),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("saved"));
      setDescription("");
      setReference("");
      setAmount(0);
    },
    onError: () => toast.error(tCommon("error")),
  });

  const toggleMutation = useMutation({
    mutationFn: (lineId: string) => api.toggleBankStatementReconciled(lineId),
    onSuccess: () => invalidate(),
    onError: () => toast.error(tCommon("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (lineId: string) => api.deleteBankStatementLine(lineId),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("deleted"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  if (banksLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {banks.length === 0 ? (
        <EmptyState icon={Landmark} title={t("noBanks")} />
      ) : (
        <>
          <GlassCard className="p-4">
            <label className="text-xs text-slate-400">{t("selectBank")}</label>
            <select
              value={selectedId}
              onChange={(e) => setBankId(e.target.value)}
              className="mt-1 w-full md:w-96 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
            >
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.bankName} ({b.accountNumber})
                </option>
              ))}
            </select>
          </GlassCard>

          {reportLoading || !report ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: t("bookBalance"), value: report.bookBalance },
                  { label: t("statementBalance"), value: report.statementBalance },
                  { label: t("difference"), value: report.difference },
                  { label: t("unreconciled"), value: report.unreconciledTotal },
                ].map((card) => (
                  <GlassCard key={card.label} className="p-4">
                    <p className="text-xs text-slate-400">{card.label}</p>
                    <p
                      className={cn(
                        "text-lg font-semibold mt-1",
                        card.label === t("difference") && Math.abs(card.value) > 0.001
                          ? "text-amber-400"
                          : "text-emerald-400"
                      )}
                    >
                      {formatMoney(card.value, currency)}
                    </p>
                  </GlassCard>
                ))}
              </div>

              <GlassCard className="p-4 space-y-3">
                <h3 className="text-sm font-medium text-white">{t("addLine")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <input
                    placeholder={t("description")}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="md:col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <input
                    placeholder={t("reference")}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                  <DecimalInput
                    value={amount}
                    onChange={setAmount}
                    className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <p className="text-xs text-slate-500">{t("amountHint")}</p>
                <button
                  onClick={() => {
                    if (!description.trim()) {
                      toast.error(t("needDescription"));
                      return;
                    }
                    addMutation.mutate();
                  }}
                  disabled={addMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-60"
                >
                  {addMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {t("addLine")}
                </button>
              </GlassCard>

              {report.lines.length === 0 ? (
                <EmptyState icon={FileText} title={t("empty")} />
              ) : (
                <>
                  <div className="md:hidden space-y-3">
                    {report.lines.map((line) => (
                      <GlassCard key={line.id} className="p-4 space-y-2">
                        <div className="flex justify-between gap-2">
                          <p className="text-white font-medium text-sm">{line.description}</p>
                          <span
                            className={cn(
                              "text-xs px-2 py-0.5 rounded shrink-0",
                              line.isReconciled
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-amber-500/10 text-amber-400"
                            )}
                          >
                            {line.isReconciled ? t("reconciled") : t("pending")}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">{formatDate(line.date)}</span>
                          <span
                            className={cn(
                              "font-medium",
                              Number(line.amount) >= 0 ? "text-emerald-400" : "text-rose-400"
                            )}
                          >
                            {formatMoney(Number(line.amount), currency)}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => toggleMutation.mutate(line.id)}
                            className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300"
                          >
                            {line.isReconciled ? (
                              <span className="inline-flex items-center gap-1">
                                <X className="w-3 h-3" /> {t("unreconcile")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1">
                                <Check className="w-3 h-3" /> {t("reconcile")}
                              </span>
                            )}
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate(line.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </GlassCard>
                    ))}
                  </div>

                  <GlassCard className="hidden md:block overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700/50 text-slate-400">
                            <th className="text-right px-4 py-3">{t("date")}</th>
                            <th className="text-right px-4 py-3">{t("description")}</th>
                            <th className="text-right px-4 py-3">{t("reference")}</th>
                            <th className="text-right px-4 py-3">{t("amount")}</th>
                            <th className="text-right px-4 py-3">{t("status")}</th>
                            <th className="text-right px-4 py-3">{tCommon("actions")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {report.lines.map((line) => (
                            <tr
                              key={line.id}
                              className="border-b border-slate-800/50 hover:bg-slate-800/30"
                            >
                              <td className="px-4 py-3 text-slate-300">{formatDate(line.date)}</td>
                              <td className="px-4 py-3 text-white">{line.description}</td>
                              <td className="px-4 py-3 text-slate-400">{line.reference || "—"}</td>
                              <td
                                className={cn(
                                  "px-4 py-3 font-medium",
                                  Number(line.amount) >= 0 ? "text-emerald-400" : "text-rose-400"
                                )}
                              >
                                {formatMoney(Number(line.amount), currency)}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={cn(
                                    "text-xs px-2 py-1 rounded",
                                    line.isReconciled
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : "bg-amber-500/10 text-amber-400"
                                  )}
                                >
                                  {line.isReconciled ? t("reconciled") : t("pending")}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 justify-end">
                                  <button
                                    onClick={() => toggleMutation.mutate(line.id)}
                                    className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                                  >
                                    {line.isReconciled ? t("unreconcile") : t("reconcile")}
                                  </button>
                                  <button
                                    onClick={() => deleteMutation.mutate(line.id)}
                                    className="p-1.5 text-slate-400 hover:text-rose-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </GlassCard>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
