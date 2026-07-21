"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, X, Truck, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";

interface LineForm {
  productId: string;
  description: string;
  quantity: number;
  unit: string;
}

interface NoteRow {
  id: string;
  number: string;
  date: string;
  status: string;
  notes?: string | null;
  contact: { id: string; name: string };
  warehouse?: { id: string; code: string; name: string } | null;
  items: { id: string; description: string; quantity: number; unit: string }[];
}

const emptyLine = (): LineForm => ({
  productId: "",
  description: "",
  quantity: 1,
  unit: "pcs",
});

export default function DeliveryNotesPage() {
  const t = useTranslations("deliveryNotes");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", "CUSTOMER"],
    queryFn: async () => {
      const res = await api.getContacts("CUSTOMER");
      return res.data as { id: string; name: string }[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await api.getProducts();
      return res.data as {
        id: string;
        name: string;
        sku: string;
        unit: string;
        quantity: number;
        isActive?: boolean;
      }[];
    },
  });

  const { data: warehouses = [] } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await api.getWarehouses();
      return res.data as { id: string; code: string; name: string }[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["delivery-notes"],
    queryFn: async () => {
      const res = await api.getDeliveryNotes();
      return res.data as NoteRow[];
    },
  });

  const reset = () => {
    setContactId("");
    setWarehouseId("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setLines([emptyLine()]);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["delivery-notes"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["product-stats"] });
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = lines
        .filter((l) => l.description.trim() && l.quantity > 0)
        .map((l) => ({
          productId: l.productId || undefined,
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unit: l.unit || "pcs",
        }));
      if (!contactId || items.length === 0) throw new Error(t("needItems"));
      return api.createDeliveryNote({
        contactId,
        date,
        warehouseId: warehouseId || undefined,
        notes: notes || undefined,
        items,
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

  const deliverMutation = useMutation({
    mutationFn: (id: string) => api.deliverDeliveryNote(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("delivered"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.cancelDeliveryNote(id),
    onSuccess: () => {
      invalidate();
      toast.success(t("cancelled"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteDeliveryNote(id),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("deleted"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const statusClass = (s: string) => {
    if (s === "DELIVERED") return "bg-emerald-500/10 text-emerald-400";
    if (s === "CANCELLED") return "bg-rose-500/10 text-rose-400";
    return "bg-amber-500/10 text-amber-400";
  };

  const activeProducts = products.filter((p) => p.isActive !== false);

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
        <EmptyState icon={Truck} title={t("empty")} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-3">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold">{row.number}</p>
                    <p className="text-sm text-slate-400">{row.contact.name}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-1 rounded h-fit", statusClass(row.status))}>
                    {t(`status_${row.status}` as "status_DRAFT")}
                  </span>
                </div>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>{formatDate(row.date)}</span>
                  <span>{row.items.length} {t("items")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {row.status === "DRAFT" && (
                    <>
                      <button
                        onClick={() => {
                          if (confirm(t("deliverConfirm"))) deliverMutation.mutate(row.id);
                        }}
                        className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400"
                      >
                        {t("deliver")}
                      </button>
                      <button
                        onClick={() => cancelMutation.mutate(row.id)}
                        className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        onClick={() => deleteMutation.mutate(row.id)}
                        className="p-1.5 text-rose-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </GlassCard>
            ))}
          </div>

          <GlassCard className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="text-right px-4 py-3">{t("number")}</th>
                    <th className="text-right px-4 py-3">{t("contact")}</th>
                    <th className="text-right px-4 py-3">{t("date")}</th>
                    <th className="text-right px-4 py-3">{t("items")}</th>
                    <th className="text-right px-4 py-3">{t("status")}</th>
                    <th className="text-right px-4 py-3">{tCommon("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-white font-medium">{row.number}</td>
                      <td className="px-4 py-3 text-slate-300">{row.contact.name}</td>
                      <td className="px-4 py-3 text-slate-300">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 text-slate-400">{row.items.length}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-1 rounded", statusClass(row.status))}>
                          {t(`status_${row.status}` as "status_DRAFT")}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          {row.status === "DRAFT" && (
                            <>
                              <button
                                onClick={() => {
                                  if (confirm(t("deliverConfirm"))) deliverMutation.mutate(row.id);
                                }}
                                className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400"
                              >
                                {t("deliver")}
                              </button>
                              <button
                                onClick={() => cancelMutation.mutate(row.id)}
                                className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300"
                              >
                                {t("cancel")}
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(row.id)}
                                className="p-1.5 text-rose-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
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

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h2 className="text-lg font-semibold text-white">{t("new")}</h2>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">{t("contact")}</label>
                  <select
                    value={contactId}
                    onChange={(e) => setContactId(e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">{t("selectContact")}</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400">{t("date")}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-slate-400">{t("warehouse")}</label>
                  <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  >
                    <option value="">—</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-xs text-slate-400">{t("items")}</label>
                  <button
                    type="button"
                    onClick={() => setLines([...lines, emptyLine()])}
                    className="text-xs text-emerald-400"
                  >
                    + {t("addItem")}
                  </button>
                </div>
                <div className="space-y-2">
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                      <select
                        value={line.productId}
                        onChange={(e) => {
                          const next = [...lines];
                          const p = activeProducts.find((x) => x.id === e.target.value);
                          next[idx].productId = e.target.value;
                          if (p) {
                            next[idx].description = p.name;
                            next[idx].unit = p.unit || "pcs";
                          }
                          setLines(next);
                        }}
                        className="col-span-4 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm"
                      >
                        <option value="">{t("selectProduct")}</option>
                        {activeProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} — {p.name} ({Number(p.quantity)})
                          </option>
                        ))}
                      </select>
                      <input
                        value={line.description}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx].description = e.target.value;
                          setLines(next);
                        }}
                        placeholder={t("description")}
                        className="col-span-4 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm"
                      />
                      <DecimalInput
                        value={line.quantity}
                        onChange={(v) => {
                          const next = [...lines];
                          next[idx].quantity = v;
                          setLines(next);
                        }}
                        className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm"
                      />
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="col-span-2 text-slate-400 hover:text-rose-400 p-2"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-400">{t("notes")}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="px-4 py-2 text-sm text-slate-400">
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-60"
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
