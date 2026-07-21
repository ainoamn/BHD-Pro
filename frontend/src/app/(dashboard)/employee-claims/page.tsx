"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Loader2,
  X,
  Wallet,
  Trash2,
  Send,
  CheckCircle2,
  Ban,
  Banknote,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";

interface LineForm {
  description: string;
  amount: number;
  category: string;
  receiptRef: string;
}

interface ClaimRow {
  id: string;
  number: string;
  date: string;
  status: string;
  total: number;
  notes?: string | null;
  rejectReason?: string | null;
  employee: { id: string; name: string; employeeNumber: string };
  lines: {
    id: string;
    description: string;
    amount: number;
    category?: string | null;
    receiptRef?: string | null;
  }[];
}

const emptyLine = (): LineForm => ({
  description: "",
  amount: 0,
  category: "",
  receiptRef: "",
});

export default function EmployeeClaimsPage() {
  const t = useTranslations("employeeClaims");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const currency = useAuthStore((s) => s.user?.company?.currency) || "OMR";

  const [open, setOpen] = useState(false);
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const res = await api.getEmployees();
      return res.data as { id: string; name: string; employeeNumber: string; isActive?: boolean }[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["employee-claims"],
    queryFn: async () => {
      const res = await api.getEmployeeClaims();
      return res.data as ClaimRow[];
    },
  });

  const total = Number(
    lines.reduce((s, l) => s + (Number(l.amount) || 0), 0).toFixed(3),
  );

  const reset = () => {
    setEmployeeId("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setLines([emptyLine()]);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["employee-claims"] });
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const items = lines
        .filter((l) => l.description.trim() && Number(l.amount) > 0)
        .map((l) => ({
          description: l.description.trim(),
          amount: Number(l.amount),
          category: l.category.trim() || undefined,
          receiptRef: l.receiptRef.trim() || undefined,
        }));
      if (!employeeId || items.length === 0) throw new Error(t("needItems"));
      return api.createEmployeeClaim({
        employeeId,
        date,
        notes: notes || undefined,
        lines: items,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("saved"));
      setOpen(false);
      reset();
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || tCommon("error"));
    },
  });

  const actionMutation = useMutation({
    mutationFn: ({
      id,
      action,
      reason,
    }: {
      id: string;
      action: "submit" | "approve" | "reject" | "pay";
      reason?: string;
    }) => {
      if (action === "submit") return api.submitEmployeeClaim(id);
      if (action === "approve") return api.approveEmployeeClaim(id);
      if (action === "reject") return api.rejectEmployeeClaim(id, { reason });
      return api.payEmployeeClaim(id);
    },
    onSuccess: (_res, vars) => {
      invalidate();
      toast.success(t(`action_${vars.action}` as "action_submit"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteEmployeeClaim(id),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("deleted"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const statusClass = (s: string) => {
    if (s === "PAID") return "bg-emerald-500/10 text-emerald-400";
    if (s === "APPROVED") return "bg-sky-500/10 text-sky-400";
    if (s === "SUBMITTED") return "bg-amber-500/10 text-amber-400";
    if (s === "REJECTED") return "bg-rose-500/10 text-rose-400";
    return "bg-slate-500/10 text-slate-400";
  };

  const activeEmployees = employees.filter((e) => e.isActive !== false);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            onClick={() => {
              reset();
              setOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg"
          >
            <Plus className="w-4 h-4" />
            {t("new")}
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={Wallet} title={t("empty")} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{row.number}</p>
                    <p className="text-sm text-slate-400">{row.employee.name}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-1 rounded-full h-fit", statusClass(row.status))}>
                    {t(`status_${row.status}` as "status_DRAFT")}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">{formatDate(row.date)}</span>
                  <span className="text-emerald-400 font-medium">
                    {formatMoney(Number(row.total), currency)}
                  </span>
                </div>
                <ClaimActions
                  row={row}
                  t={t}
                  tCommon={tCommon}
                  busy={actionMutation.isPending || deleteMutation.isPending}
                  onAction={(action, reason) =>
                    actionMutation.mutate({ id: row.id, action, reason })
                  }
                  onDelete={() => {
                    if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(row.id);
                  }}
                />
              </GlassCard>
            ))}
          </div>

          <div className="hidden md:block glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3">{t("number")}</th>
                  <th className="px-4 py-3">{t("employee")}</th>
                  <th className="px-4 py-3">{t("date")}</th>
                  <th className="px-4 py-3 text-end">{t("total")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30 align-top">
                    <td className="px-4 py-3 text-white font-medium">{row.number}</td>
                    <td className="px-4 py-3 text-slate-300">
                      <div>{row.employee.name}</div>
                      <div className="text-xs text-slate-500">{row.employee.employeeNumber}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-end text-emerald-400 font-medium">
                      {formatMoney(Number(row.total), currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-1 rounded-full", statusClass(row.status))}>
                        {t(`status_${row.status}` as "status_DRAFT")}
                      </span>
                      {row.rejectReason && (
                        <p className="text-xs text-rose-400 mt-1 max-w-[160px]">{row.rejectReason}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ClaimActions
                        row={row}
                        t={t}
                        tCommon={tCommon}
                        busy={actionMutation.isPending || deleteMutation.isPending}
                        onAction={(action, reason) =>
                          actionMutation.mutate({ id: row.id, action, reason })
                        }
                        onDelete={() => {
                          if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(row.id);
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{t("new")}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="text-sm text-slate-400">{t("employee")}</label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="">{t("selectEmployee")}</option>
                {activeEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employeeNumber} — {e.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-400">{t("date")}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm text-slate-400">{t("items")}</label>
                <button
                  type="button"
                  onClick={() => setLines((prev) => [...prev, emptyLine()])}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  {t("addItem")}
                </button>
              </div>
              {lines.map((line, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end glass rounded-lg p-3">
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      value={line.description}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, description: e.target.value } : l,
                          ),
                        )
                      }
                      placeholder={t("description")}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <DecimalInput
                      value={line.amount}
                      onChange={(v) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, amount: v } : l)),
                        )
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <input
                      value={line.category}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) =>
                            i === idx ? { ...l, category: e.target.value } : l,
                          ),
                        )
                      }
                      placeholder={t("category")}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                        className="p-2 text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between text-sm font-medium text-white border-t border-slate-700 pt-3">
              <span>{t("total")}</span>
              <span className="text-emerald-400">{formatMoney(total, currency)}</span>
            </div>

            <div>
              <label className="text-sm text-slate-400">{t("notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>

            <button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg disabled:opacity-50"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {tCommon("save")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ClaimActions({
  row,
  t,
  tCommon,
  busy,
  onAction,
  onDelete,
}: {
  row: ClaimRow;
  t: (key: string) => string;
  tCommon: (key: string) => string;
  busy: boolean;
  onAction: (action: "submit" | "approve" | "reject" | "pay", reason?: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {row.status === "DRAFT" && (
        <>
          <IconBtn
            title={t("submit")}
            disabled={busy}
            onClick={() => onAction("submit")}
            className="text-amber-400 hover:bg-amber-500/10"
          >
            <Send className="w-4 h-4" />
          </IconBtn>
          <IconBtn
            title={tCommon("delete")}
            disabled={busy}
            onClick={onDelete}
            className="text-rose-400 hover:bg-rose-500/10"
          >
            <Trash2 className="w-4 h-4" />
          </IconBtn>
        </>
      )}
      {row.status === "SUBMITTED" && (
        <>
          <IconBtn
            title={t("approve")}
            disabled={busy}
            onClick={() => onAction("approve")}
            className="text-sky-400 hover:bg-sky-500/10"
          >
            <CheckCircle2 className="w-4 h-4" />
          </IconBtn>
          <IconBtn
            title={t("reject")}
            disabled={busy}
            onClick={() => {
              const reason = prompt(t("rejectReasonPrompt")) || undefined;
              onAction("reject", reason);
            }}
            className="text-rose-400 hover:bg-rose-500/10"
          >
            <Ban className="w-4 h-4" />
          </IconBtn>
        </>
      )}
      {row.status === "APPROVED" && (
        <>
          <IconBtn
            title={t("pay")}
            disabled={busy}
            onClick={() => {
              if (confirm(t("payConfirm"))) onAction("pay");
            }}
            className="text-emerald-400 hover:bg-emerald-500/10"
          >
            <Banknote className="w-4 h-4" />
          </IconBtn>
          <IconBtn
            title={t("reject")}
            disabled={busy}
            onClick={() => {
              const reason = prompt(t("rejectReasonPrompt")) || undefined;
              onAction("reject", reason);
            }}
            className="text-rose-400 hover:bg-rose-500/10"
          >
            <Ban className="w-4 h-4" />
          </IconBtn>
        </>
      )}
      {row.status === "REJECTED" && (
        <IconBtn
          title={tCommon("delete")}
          disabled={busy}
          onClick={onDelete}
          className="text-rose-400 hover:bg-rose-500/10"
        >
          <Trash2 className="w-4 h-4" />
        </IconBtn>
      )}
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={cn("p-1.5 rounded disabled:opacity-50", className)}
    >
      {children}
    </button>
  );
}
