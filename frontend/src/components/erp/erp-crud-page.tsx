"use client";

import { useState, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Plus, Edit, Trash2, X, Loader2, Inbox } from "lucide-react";
import toast from "react-hot-toast";
import { PageHeader, EmptyState, LoadingSpinner, GlassCard } from "@/components/ui/page-shell";
import { cn, formatMoney } from "@/lib/utils";

export interface ErpColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
}

export interface ErpField {
  key: string;
  label: string;
  type?: "text" | "number" | "select" | "date";
  required?: boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface ErpCrudPageProps<T extends { id: string }> {
  title: string;
  subtitle: string;
  queryKey: string;
  emptyLabel: string;
  columns: ErpColumn<T>[];
  fields: ErpField[];
  fetchAll: () => Promise<{ data: unknown }>;
  create: (data: Record<string, unknown>) => Promise<unknown>;
  update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  remove: (id: string) => Promise<unknown>;
  toForm?: (row: T) => Record<string, unknown>;
  currency?: string;
  rowActions?: (row: T) => ReactNode;
}

export function ErpCrudPage<T extends { id: string }>({
  title,
  subtitle,
  queryKey,
  emptyLabel,
  columns,
  fields,
  fetchAll,
  create,
  update,
  remove,
  toForm,
  currency = "OMR",
  rowActions,
}: ErpCrudPageProps<T>) {
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const emptyForm = () =>
    Object.fromEntries(fields.map((f) => [f.key, f.type === "number" ? 0 : ""]));
  const [form, setForm] = useState<Record<string, unknown>>(emptyForm());

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = await fetchAll();
      return res.data as T[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => (editId ? update(editId, form) : create(form)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(tCommon("saved"));
      setOpen(false);
      setEditId(null);
      setForm(emptyForm());
    },
    onError: () => toast.error(tCommon("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(tCommon("deleted"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setOpen(true);
  };

  const openEdit = (row: T) => {
    setEditId(row.id);
    setForm(toForm ? toForm(row) : ({ ...row } as Record<string, unknown>));
    setOpen(true);
  };

  const actionsFor = (row: T) => (
    <div className="flex gap-1 items-center justify-end flex-wrap">
      {rowActions?.(row)}
      <button
        onClick={() => openEdit(row)}
        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-700"
      >
        <Edit className="w-4 h-4" />
      </button>
      <button
        onClick={() => {
          if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(row.id);
        }}
        className="p-1.5 rounded text-rose-400 hover:bg-rose-500/10"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );

  const cellValue = (row: T, c: ErpColumn<T>) =>
    c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? "—");

  const mobileColumns = columns.slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            {tCommon("add")}
          </button>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={Inbox} title={emptyLabel} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-3">
                <div className="space-y-1.5">
                  {mobileColumns.map((c, i) => (
                    <div key={c.key} className="flex justify-between gap-3 text-sm">
                      <span className="text-slate-500 shrink-0">{c.label}</span>
                      <span className={cn("text-right", i === 0 ? "text-white font-medium" : "text-slate-300")}>
                        {cellValue(row, c)}
                      </span>
                    </div>
                  ))}
                </div>
                {actionsFor(row)}
              </GlassCard>
            ))}
          </div>

          <GlassCard className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    {columns.map((c) => (
                      <th key={c.key} className="p-4 text-right font-medium">
                        {c.label}
                      </th>
                    ))}
                    <th className="p-4 w-28" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      {columns.map((c) => (
                        <td key={c.key} className="p-4 text-slate-200">
                          {cellValue(row, c)}
                        </td>
                      ))}
                      <td className="p-4">{actionsFor(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 bg-black/70 p-4">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">
                {editId ? tCommon("edit") : tCommon("add")}
              </h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-sm text-slate-400 mb-1">{f.label}</label>
                  {f.type === "select" ? (
                    <select
                      value={String(form[f.key] ?? "")}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value || undefined })}
                      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                    >
                      <option value="">—</option>
                      {f.options?.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                      value={String(form[f.key] ?? "")}
                      step={f.type === "number" ? "0.001" : undefined}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [f.key]:
                            f.type === "number" ? Number(e.target.value) || 0 : e.target.value,
                        })
                      }
                      className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                      required={f.required}
                    />
                  )}
                </div>
              ))}
              <button
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
                className="w-full h-10 mt-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {tCommon("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { formatMoney, cn };
