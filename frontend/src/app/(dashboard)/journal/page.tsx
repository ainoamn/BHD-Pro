"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, Trash2, X, Loader2, Scale } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, EmptyState, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";

interface Account {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  type: string;
}

interface JournalLine {
  id: string;
  accountId: string;
  description?: string;
  debit: number;
  credit: number;
  account?: { code: string; name: string };
}

interface Journal {
  id: string;
  number: string;
  date: string;
  description?: string;
  reference?: string;
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  lines: JournalLine[];
  createdBy?: { name: string };
}

interface LineForm {
  accountId: string;
  description: string;
  debit: number;
  credit: number;
}

const emptyLine = (): LineForm => ({
  accountId: "",
  description: "",
  debit: 0,
  credit: 0,
});

export default function JournalPage() {
  const t = useTranslations("journal");
  const tCommon = useTranslations("common");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [reference, setReference] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine(), emptyLine()]);

  const { data: journals = [], isLoading } = useQuery({
    queryKey: ["journals"],
    queryFn: async () => {
      const res = await api.getJournals();
      return res.data as Journal[];
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["journal-accounts"],
    queryFn: async () => {
      const res = await api.getJournalAccounts();
      return res.data as Account[];
    },
    enabled: modalOpen,
  });

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.001 && totalDebit > 0;

  const resetForm = () => {
    setDate(new Date().toISOString().split("T")[0]);
    setDescription("");
    setReference("");
    setLines([emptyLine(), emptyLine()]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createJournal({
        date,
        description,
        reference,
        lines: lines
          .filter((l) => l.accountId)
          .map((l) => ({
            accountId: l.accountId,
            description: l.description || undefined,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast.success(t("saved"));
      setModalOpen(false);
      resetForm();
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || t("saveError"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteJournal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
      toast.success(t("deleted"));
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            onClick={() => { resetForm(); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg font-medium hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            {t("newEntry")}
          </button>
        }
      />

      <GlassCard>
        {isLoading ? (
          <LoadingSpinner />
        ) : journals.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={t("noEntries")}
            description={t("createFirst")}
            action={
              <button
                onClick={() => { resetForm(); setModalOpen(true); }}
                className="text-emerald-400 hover:underline text-sm"
              >
                {t("newEntry")}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="text-right p-4 font-medium">{t("number")}</th>
                  <th className="text-right p-4 font-medium">{t("date")}</th>
                  <th className="text-right p-4 font-medium">{t("description")}</th>
                  <th className="text-right p-4 font-medium">{t("debit")}</th>
                  <th className="text-right p-4 font-medium">{t("credit")}</th>
                  <th className="text-right p-4 font-medium">{t("balanced")}</th>
                  <th className="text-right p-4 font-medium">{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {journals.map((journal) => (
                  <tr key={journal.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="p-4 text-white font-medium">{journal.number}</td>
                    <td className="p-4 text-slate-400">{formatDate(journal.date)}</td>
                    <td className="p-4 text-slate-300">{journal.description || "—"}</td>
                    <td className="p-4 text-white">{formatMoney(Number(journal.totalDebit), currency)}</td>
                    <td className="p-4 text-white">{formatMoney(Number(journal.totalCredit), currency)}</td>
                    <td className="p-4">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        journal.isBalanced ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      )}>
                        {journal.isBalanced ? t("yes") : t("no")}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => { if (confirm(t("deleteConfirm"))) deleteMutation.mutate(journal.id); }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">{t("newEntry")}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("date")}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("description")}</label>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("reference")}</label>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-slate-400">{t("lines")}</label>
                  <button
                    type="button"
                    onClick={() => setLines([...lines, emptyLine()])}
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    + {t("addLine")}
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                      <select
                        value={line.accountId}
                        onChange={(e) => {
                          const n = [...lines];
                          n[idx].accountId = e.target.value;
                          setLines(n);
                        }}
                        className="col-span-4 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      >
                        <option value="">{t("selectAccount")}</option>
                        {accounts.map((a) => (
                          <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                        ))}
                      </select>
                      <input
                        placeholder={t("lineDescription")}
                        value={line.description}
                        onChange={(e) => {
                          const n = [...lines];
                          n[idx].description = e.target.value;
                          setLines(n);
                        }}
                        className="col-span-3 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        placeholder={t("debit")}
                        value={line.debit || ""}
                        min={0}
                        step={0.001}
                        onChange={(e) => {
                          const n = [...lines];
                          n[idx].debit = parseFloat(e.target.value) || 0;
                          if (n[idx].debit > 0) n[idx].credit = 0;
                          setLines(n);
                        }}
                        className="col-span-2 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      <input
                        type="number"
                        placeholder={t("credit")}
                        value={line.credit || ""}
                        min={0}
                        step={0.001}
                        onChange={(e) => {
                          const n = [...lines];
                          n[idx].credit = parseFloat(e.target.value) || 0;
                          if (n[idx].credit > 0) n[idx].debit = 0;
                          setLines(n);
                        }}
                        className="col-span-2 h-9 px-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:border-emerald-500"
                      />
                      {lines.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="col-span-1 text-rose-400 hover:text-rose-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className={cn(
                "flex items-center justify-between p-4 rounded-lg border",
                isBalanced ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"
              )}>
                <div className="flex items-center gap-2">
                  <Scale className={cn("w-5 h-5", isBalanced ? "text-emerald-400" : "text-rose-400")} />
                  <span className={cn("text-sm font-medium", isBalanced ? "text-emerald-400" : "text-rose-400")}>
                    {isBalanced ? t("balancedOk") : t("notBalanced")}
                  </span>
                </div>
                <div className="text-sm text-slate-300">
                  {t("debit")}: {formatMoney(totalDebit, currency)} | {t("credit")}: {formatMoney(totalCredit, currency)}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-slate-800">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={!isBalanced || createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50"
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {tCommon("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
