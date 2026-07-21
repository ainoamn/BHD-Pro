"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, X, ClipboardList, Trash2, CheckCircle2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";

interface CountLine {
  id: string;
  productId: string;
  systemQty: number;
  countedQty: number;
  variance?: number;
  product: { id: string; sku: string; name: string; unit: string };
}

interface CountRow {
  id: string;
  number: string;
  date: string;
  status: string;
  notes?: string | null;
  warehouse?: { id: string; code: string; name: string } | null;
  lines: CountLine[];
  _count?: { lines: number };
}

export default function StockCountsPage() {
  const t = useTranslations("stockCounts");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [warehouseId, setWarehouseId] = useState("");
  const [notes, setNotes] = useState("");
  const [editLines, setEditLines] = useState<{ productId: string; countedQty: number }[]>([]);

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await api.getWarehouses();
      return res.data as { id: string; code: string; name: string }[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["stock-counts"],
    queryFn: async () => {
      const res = await api.getStockCounts();
      return res.data as CountRow[];
    },
  });

  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["stock-counts", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await api.getStockCount(detailId!);
      const data = res.data as CountRow;
      setEditLines(
        data.lines.map((l) => ({
          productId: l.productId,
          countedQty: Number(l.countedQty),
        })),
      );
      return data;
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["stock-counts"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["product-stats"] });
  };

  const createMutation = useMutation({
    mutationFn: () =>
      api.createStockCount({
        date,
        warehouseId: warehouseId || undefined,
        notes: notes || undefined,
        seedProducts: true,
      }),
    onSuccess: (res) => {
      invalidate();
      toast.success(tCommon("saved"));
      setCreateOpen(false);
      setDate(new Date().toISOString().split("T")[0]);
      setWarehouseId("");
      setNotes("");
      setDetailId((res.data as CountRow).id);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const saveLinesMutation = useMutation({
    mutationFn: () => api.updateStockCountLines(detailId!, { lines: editLines }),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("saved"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (detail?.status === "DRAFT") {
        await api.updateStockCountLines(detailId!, { lines: editLines });
      }
      return api.completeStockCount(detailId!);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("completed"));
      setDetailId(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelStockCount(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("cancelled"));
      setDetailId(null);
    },
    onError: () => toast.error(tCommon("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteStockCount(id),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("deleted"));
      setDetailId(null);
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const statusClass = (s: string) => {
    if (s === "COMPLETED") return "bg-emerald-500/10 text-emerald-400";
    if (s === "CANCELLED") return "bg-rose-500/10 text-rose-400";
    return "bg-amber-500/10 text-amber-400";
  };

  const countedFor = (productId: string) =>
    editLines.find((l) => l.productId === productId)?.countedQty ?? 0;

  const setCounted = (productId: string, countedQty: number) => {
    setEditLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, countedQty } : l)),
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <button
            onClick={() => setCreateOpen(true)}
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
        <EmptyState icon={ClipboardList} title={t("empty")} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <div key={row.id} onClick={() => setDetailId(row.id)} className="cursor-pointer">
                <GlassCard className="p-4 space-y-3">
                  <div className="flex justify-between gap-2">
                    <div>
                      <p className="font-medium text-white">{row.number}</p>
                      <p className="text-sm text-slate-400">{formatDate(row.date)}</p>
                    </div>
                    <span className={cn("text-xs px-2 py-1 rounded-full h-fit", statusClass(row.status))}>
                      {t(`status_${row.status}` as "status_DRAFT")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">
                    {row.warehouse?.name || "—"} · {row._count?.lines ?? row.lines?.length ?? 0} {t("items")}
                  </p>
                </GlassCard>
              </div>
            ))}
          </div>

          <div className="hidden md:block glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3">{t("number")}</th>
                  <th className="px-4 py-3">{t("date")}</th>
                  <th className="px-4 py-3">{t("warehouse")}</th>
                  <th className="px-4 py-3">{t("items")}</th>
                  <th className="px-4 py-3">{t("status")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-800/30 cursor-pointer"
                    onClick={() => setDetailId(row.id)}
                  >
                    <td className="px-4 py-3 text-white font-medium">{row.number}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-slate-300">{row.warehouse?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {row._count?.lines ?? row.lines?.length ?? 0}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs px-2 py-1 rounded-full", statusClass(row.status))}>
                        {t(`status_${row.status}` as "status_DRAFT")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-end" onClick={(e) => e.stopPropagation()}>
                      {row.status === "DRAFT" && (
                        <button
                          onClick={() => {
                            if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(row.id);
                          }}
                          className="p-1.5 text-rose-400 hover:bg-rose-500/10 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{t("new")}</h3>
              <button onClick={() => setCreateOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400">{t("seedHint")}</p>
            <div>
              <label className="text-sm text-slate-400">{t("date")}</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400">{t("warehouse")}</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="">{t("defaultWarehouse")}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
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

      {detailId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-3xl bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {detail?.number || "…"}
                </h3>
                {detail && (
                  <p className="text-sm text-slate-400">
                    {formatDate(detail.date)}
                    {detail.warehouse ? ` · ${detail.warehouse.name}` : ""}
                  </p>
                )}
              </div>
              <button onClick={() => setDetailId(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading || !detail ? (
              <LoadingSpinner />
            ) : (
              <>
                <span className={cn("text-xs px-2 py-1 rounded-full", statusClass(detail.status))}>
                  {t(`status_${detail.status}` as "status_DRAFT")}
                </span>

                <div className="space-y-2">
                  <div className="hidden sm:grid grid-cols-12 gap-2 text-xs text-slate-500 px-1">
                    <div className="col-span-5">{t("product")}</div>
                    <div className="col-span-2 text-end">{t("systemQty")}</div>
                    <div className="col-span-2 text-end">{t("countedQty")}</div>
                    <div className="col-span-3 text-end">{t("variance")}</div>
                  </div>
                  {detail.lines.map((line) => {
                    const counted = countedFor(line.productId);
                    const variance = Number((counted - Number(line.systemQty)).toFixed(3));
                    return (
                      <div
                        key={line.id}
                        className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center glass rounded-lg p-3"
                      >
                        <div className="sm:col-span-5">
                          <p className="text-white text-sm font-medium">{line.product.name}</p>
                          <p className="text-xs text-slate-500">
                            {line.product.sku} · {line.product.unit}
                          </p>
                        </div>
                        <div className="sm:col-span-2 sm:text-end text-slate-300 text-sm">
                          <span className="sm:hidden text-slate-500 me-2">{t("systemQty")}:</span>
                          {Number(line.systemQty)}
                        </div>
                        <div className="sm:col-span-2">
                          {detail.status === "DRAFT" ? (
                            <DecimalInput
                              value={counted}
                              onChange={(v) => setCounted(line.productId, v)}
                              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-white text-sm text-end"
                            />
                          ) : (
                            <p className="text-sm text-white sm:text-end">{Number(line.countedQty)}</p>
                          )}
                        </div>
                        <div
                          className={cn(
                            "sm:col-span-3 sm:text-end text-sm font-medium",
                            variance > 0 && "text-emerald-400",
                            variance < 0 && "text-rose-400",
                            variance === 0 && "text-slate-400",
                          )}
                        >
                          <span className="sm:hidden text-slate-500 me-2">{t("variance")}:</span>
                          {variance > 0 ? "+" : ""}
                          {variance}
                        </div>
                      </div>
                    );
                  })}
                  {detail.lines.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">{t("noLines")}</p>
                  )}
                </div>

                {detail.status === "DRAFT" && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button
                      onClick={() => saveLinesMutation.mutate()}
                      disabled={saveLinesMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {saveLinesMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                      {tCommon("save")}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("completeConfirm"))) completeMutation.mutate();
                      }}
                      disabled={completeMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-lg disabled:opacity-50"
                    >
                      {completeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      {t("complete")}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(t("cancelConfirm"))) cancelMutation.mutate(detail.id);
                      }}
                      className="px-4 py-2 text-amber-400 hover:bg-amber-500/10 rounded-lg"
                    >
                      {t("cancel")}
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(tCommon("confirmDelete"))) deleteMutation.mutate(detail.id);
                      }}
                      className="px-4 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg"
                    >
                      {tCommon("delete")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
