"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Pause,
  Play,
  Trash2,
  Zap,
  CalendarClock,
  Pencil,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney } from "@/components/erp/erp-crud-page";
import { useAuthStore } from "@/store/auth";
import { PageHeader, GlassCard, LoadingSpinner, EmptyState, QueryError } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";
import { EntityAttachments } from "@/components/attachments/entity-attachments";

interface AccountRow {
  id: string;
  code: string;
  name: string;
  type: string;
}

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
  expenseAccountId?: string | null;
  payableAccountId?: string | null;
}

type FormState = {
  name: string;
  type: string;
  amount: number;
  frequency: string;
  nextRunAt: string;
  bankAccountId: string;
  expenseAccountId: string;
  payableAccountId: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  type: "RENT",
  amount: 0,
  frequency: "MONTHLY",
  nextRunAt: new Date().toISOString().slice(0, 10),
  bankAccountId: "",
  expenseAccountId: "",
  payableAccountId: "",
  notes: "",
});

export default function CommitmentsPage() {
  const t = useTranslations("commitments");
  const tCommon = useTranslations("common");
  const currency = useAuthStore((s) => s.company?.currency) || "OMR";
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deferUnit, setDeferUnit] = useState<"DAY" | "MONTH" | "YEAR">("MONTH");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: ["commitments"],
    queryFn: async () => (await api.getCommitments()).data as Commitment[],
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () =>
      (await api.getBankAccounts()).data as { id: string; name: string; bankName: string }[],
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => (await api.getAccounts()).data as AccountRow[],
  });

  const expenseAccounts = accounts.filter((a) => a.type === "EXPENSE");
  const payableAccounts = accounts.filter((a) => a.type === "LIABILITY");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["commitments"] });

  const resetForm = () => {
    setForm(emptyForm());
    setEditingId(null);
    setOpen(false);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: Commitment) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      type: row.type || "RENT",
      amount: Number(row.amount),
      frequency: row.frequency || "MONTHLY",
      nextRunAt: new Date(row.nextRunAt).toISOString().slice(0, 10),
      bankAccountId: row.bankAccountId || "",
      expenseAccountId: row.expenseAccountId || "",
      payableAccountId: row.payableAccountId || "",
      notes: row.notes || "",
    });
    setOpen(true);
  };

  const payload = () => ({
    name: form.name,
    type: form.type,
    amount: form.amount,
    frequency: form.frequency,
    nextRunAt: new Date(form.nextRunAt).toISOString(),
    bankAccountId: form.bankAccountId || undefined,
    expenseAccountId: form.expenseAccountId || undefined,
    payableAccountId: form.payableAccountId || undefined,
    notes: form.notes.trim() || undefined,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      editingId
        ? api.updateCommitment(editingId, payload())
        : api.createCommitment(payload()),
    onSuccess: () => {
      invalidate();
      resetForm();
      toast.success(tCommon("saved"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) =>
      api.pauseCommitment(id, { deferUnit, deferCount: 1 }),
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

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

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
              onClick={openCreate}
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
          <p className="text-sm text-slate-300">{editingId ? t("edit") : t("add")}</p>
          <input
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder={t("name")}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.type}
              onChange={(e) => setField("type", e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              {["RENT", "SALARY", "LOAN", "VENDOR", "UTILITY", "OTHER"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
            <select
              value={form.frequency}
              onChange={(e) => setField("frequency", e.target.value)}
              className="h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
            >
              {["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <DecimalInput value={form.amount} onChange={(v) => setField("amount", v)} />
          <input
            type="date"
            value={form.nextRunAt}
            onChange={(e) => setField("nextRunAt", e.target.value)}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <select
            value={form.expenseAccountId}
            onChange={(e) => setField("expenseAccountId", e.target.value)}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="">{t("expenseAccount")}</option>
            {expenseAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <select
            value={form.payableAccountId}
            onChange={(e) => setField("payableAccountId", e.target.value)}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="">{t("payableAccount")}</option>
            {payableAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <select
            value={form.bankAccountId}
            onChange={(e) => setField("bankAccountId", e.target.value)}
            className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="">{t("optionalBank")}</option>
            {banks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} — {b.bankName}
              </option>
            ))}
          </select>
          <textarea
            value={form.notes}
            onChange={(e) => setField("notes", e.target.value)}
            placeholder={t("notes")}
            rows={2}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!form.name || form.amount <= 0 || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                tCommon("save")
              )}
            </button>
            <button type="button" onClick={resetForm} className="px-4 py-2 text-slate-300 text-sm">
              {tCommon("cancel")}
            </button>
          </div>
        </GlassCard>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>{t("deferUnit")}:</span>
        {(["DAY", "MONTH", "YEAR"] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setDeferUnit(u)}
            className={
              deferUnit === u
                ? "px-2 py-1 rounded bg-amber-600/20 text-amber-300"
                : "px-2 py-1 rounded bg-slate-800 text-slate-400"
            }
          >
            {t(`defer.${u}`)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : isError ? (
        <QueryError onRetry={() => refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t("empty")} />
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <GlassCard key={row.id} className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-white font-medium">{row.name}</p>
                  <p className="text-sm text-slate-400">
                    {row.type} · {row.frequency} · {row.status} ·{" "}
                    {new Date(row.nextRunAt).toLocaleDateString()}
                  </p>
                  <p className="text-emerald-400 mt-1">
                    {formatMoney(Number(row.amount), currency)}
                  </p>
                  {row.notes ? (
                    <p className="text-xs text-slate-500 mt-1">{row.notes}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="p-2 rounded bg-slate-700/60 text-slate-200"
                    title={t("edit")}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  {row.status === "ACTIVE" ? (
                    <button
                      type="button"
                      onClick={() => pauseMutation.mutate(row.id)}
                      className="p-2 rounded bg-amber-600/20 text-amber-300"
                      title={t("pause")}
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
                    onClick={() =>
                      setExpandedId((id) => (id === row.id ? null : row.id))
                    }
                    className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs"
                  >
                    {t("attachments")}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(row.id)}
                    className="p-2 rounded bg-rose-600/20 text-rose-300"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {expandedId === row.id && (
                <EntityAttachments entityType="COMMITMENT" entityId={row.id} />
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
