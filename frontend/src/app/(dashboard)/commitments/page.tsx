"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pause, Play, Trash2, Zap, CalendarClock } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";
import { PageHeader, GlassCard, LoadingSpinner, EmptyState } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";

interface Commitment {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  nextRunAt: string;
  status: string;
  notes?: string | null;
  bankAccountId?: string | null;
}

export default function CommitmentsPage() {
  const t = useTranslations("commitments");
  const tCommon = useTranslations("common");
  const currency = useAuthStore((s) => s.user?.company?.currency) || "OMR";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("RENT");
  const [amount, setAmount] = useState(0);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [nextRunAt, setNextRunAt] = useState(new Date().toISOString().slice(0, 10));
  const [bankAccountId, setBankAccountId] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["commitments"],
    queryFn: async () => (await api.getCommitments()).data as Commitment[],
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () =>
      (await api.getBankAccounts()).data as { id: string; name: string; bankName: string }[],
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["commitments"] });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createCommitment({
        name,
        type,
        amount,
        frequency,
        nextRunAt: new Date(nextRunAt).toISOString(),
        bankAccountId: bankAccountId || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setOpen(false);
      setName("");
      setAmount(0);
      toast.success(tCommon("saved"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.pauseCommitment(id, { deferUnit: "MONTH", deferCount: 1 }),
    onSuccess: () => {
      invalidate();
      toast.success(t("paused"));
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => api.resumeCommitment(id),
    onSuccess: invalidate,
  });

  const runMutation = useMutation({
    mutationFn: () => api.runDueCommitments(),
    onSuccess: (res) => {
      invalidate();
      toast.success(`${t("ran")}: ${(res.data as { processed: number }).processed}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteCommitment(id),
    onSuccess: invalidate,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => runMutation.mutate()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800 text-slate-200 text-sm"
            >
              <Zap className="w-4 h-4" />
              {t("runDue")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
            >
              <Plus className="w-4 h-4" />
              {t("add")}
            </button>
          </div>
        }
      />

      {open && (
        <GlassCard className="p-4 space-y-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("name")}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              {["RENT", "SALARY", "LOAN", "VENDOR", "UTILITY", "OTHER"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              {["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <DecimalInput value={amount} onChange={setAmount} />
          <input
            type="date"
            value={nextRunAt}
            onChange={(e) => setNextRunAt(e.target.value)}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <select
            value={bankAccountId}
            onChange={(e) => setBankAccountId(e.target.value)}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="">{t("optionalBank")}</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.bankName}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!name || amount <= 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : tCommon("save")}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 text-slate-300 text-sm">
              {tCommon("cancel")}
            </button>
          </div>
        </GlassCard>
      )}

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("empty")} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <GlassCard key={row.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-white font-medium">{row.name}</p>
                <p className="text-sm text-slate-400">
                  {row.type} · {row.frequency} · {row.status} ·{" "}
                  {new Date(row.nextRunAt).toLocaleDateString()}
                </p>
                <p className="text-emerald-400 mt-1">{formatMoney(Number(row.amount), currency)}</p>
              </div>
              <div className="flex gap-2">
                {row.status === "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={() => pauseMutation.mutate(row.id)}
                    className="p-2 rounded bg-amber-600/20 text-amber-300"
                    title={t("pauseMonth")}
                  >
                    <Pause className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => resumeMutation.mutate(row.id)}
                    className="p-2 rounded bg-sky-600/20 text-sky-300"
                  >
                    <Play className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate(row.id)}
                  className="p-2 rounded bg-rose-600/20 text-rose-300"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
