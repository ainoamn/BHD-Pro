"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, X, FileInput, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney, formatDate, cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";
import { FormLabel, LineFieldLabel, LineItemsGrid } from "@/components/ui/form-field";

interface LineForm {
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface ContactOption {
  id: string;
  name: string;
}

interface DocumentRow {
  id: string;
  number?: string;
  name?: string;
  date?: string;
  nextDate?: string;
  expectedDate?: string;
  total: number;
  status?: string;
  frequency?: string;
  isActive?: boolean;
  contact: ContactOption;
}

type ProcurementMode = "purchaseOrder" | "scheduled";

const emptyLine = (): LineForm => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
});

interface ProcurementPageProps {
  mode: ProcurementMode;
}

export function ProcurementPage({ mode }: ProcurementPageProps) {
  const isPO = mode === "purchaseOrder";
  const t = useTranslations(isPO ? "purchaseOrders" : "scheduledInvoices");
  const tCommon = useTranslations("common");
  const tInvoices = useTranslations("invoices");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const queryClient = useQueryClient();
  const queryKey = isPO ? "purchase-orders" : "scheduled-invoices";

  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [expectedDate, setExpectedDate] = useState("");
  const [nextDate, setNextDate] = useState(new Date().toISOString().split("T")[0]);
  const [frequency, setFrequency] = useState("MONTHLY");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const contactType = isPO ? "SUPPLIER" : "CUSTOMER";

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", contactType],
    queryFn: async () => {
      const res = await api.getContacts(contactType);
      return res.data as ContactOption[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const res = isPO ? await api.getPurchaseOrders() : await api.getScheduledInvoices();
      return res.data as DocumentRow[];
    },
  });

  const resetForm = () => {
    setContactId("");
    setName("");
    setDate(new Date().toISOString().split("T")[0]);
    setExpectedDate("");
    setNextDate(new Date().toISOString().split("T")[0]);
    setFrequency("MONTHLY");
    setNotes("");
    setLines([emptyLine()]);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = lines
        .filter((l) => l.description.trim())
        .map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discount: Number(l.discount || 0),
        }));
      if (!contactId || items.length === 0) {
        throw new Error(tInvoices("needItems"));
      }
      if (isPO) {
        return api.createPurchaseOrder({
          contactId,
          date,
          expectedDate: expectedDate || undefined,
          notes: notes || undefined,
          items,
        });
      }
      if (!name.trim()) throw new Error(t("nameRequired"));
      return api.createScheduledInvoice({
        name: name.trim(),
        contactId,
        frequency,
        nextDate,
        notes: notes || undefined,
        items,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(tCommon("saved"));
      setOpen(false);
      resetForm();
    },
    onError: () => toast.error(tCommon("error")),
  });

  const convertMutation = useMutation({
    mutationFn: (id: string) =>
      isPO ? api.convertPurchaseOrder(id) : api.generateScheduledInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(isPO ? t("converted") : t("generated"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      isPO ? api.deletePurchaseOrder(id) : api.deleteScheduledInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(tCommon("deleted"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: (id: string) => api.toggleScheduledInvoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      toast.success(tCommon("saved"));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const processDueMutation = useMutation({
    mutationFn: () => api.processDueScheduledInvoices(),
    onSuccess: (res) => {
      const data = res.data as { checked: number; generated: number };
      queryClient.invalidateQueries({ queryKey: [queryKey] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(t("processDueDone", { count: data.generated }));
    },
    onError: () => toast.error(tCommon("error")),
  });

  const lineTotal = lines.reduce((s, l) => {
    const sub = l.quantity * l.unitPrice - (l.discount || 0);
    return s + sub * 1.05;
  }, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        action={
          <div className="flex items-center gap-2">
            {!isPO && (
              <button
                onClick={() => processDueMutation.mutate()}
                disabled={processDueMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-sm font-medium border border-slate-700"
              >
                {t("processDue")}
              </button>
            )}
            <button
              onClick={() => setOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              {t("new")}
            </button>
          </div>
        }
      />

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={FileInput} title={t("empty")} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold">{isPO ? row.number : row.name}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{row.contact.name}</p>
                  </div>
                  {isPO && (
                    <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 shrink-0">
                      {t(`status_${row.status}` as "status_DRAFT")}
                    </span>
                  )}
                  {!isPO && row.isActive === false && (
                    <span className="text-xs px-2 py-1 rounded bg-amber-500/10 text-amber-400 shrink-0">
                      {t("paused")}
                    </span>
                  )}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{formatDate(isPO ? row.date! : row.nextDate!)}</span>
                  <span className="text-emerald-400 font-semibold">
                    {formatMoney(Number(row.total), currency)}
                  </span>
                </div>
                {!isPO && (
                  <p className="text-xs text-slate-400">
                    {t("frequency")}: {t(`freq_${row.frequency}` as "freq_MONTHLY")}
                  </p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  {(isPO ? row.status !== "RECEIVED" && row.status !== "CANCELLED" : row.isActive !== false) && (
                    <button
                      onClick={() => convertMutation.mutate(row.id)}
                      disabled={convertMutation.isPending}
                      className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    >
                      {isPO ? t("convert") : t("generateNow")}
                    </button>
                  )}
                  {!isPO && (
                    <button
                      onClick={() => toggleScheduleMutation.mutate(row.id)}
                      disabled={toggleScheduleMutation.isPending}
                      className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                    >
                      {row.isActive === false ? t("resume") : t("pause")}
                    </button>
                  )}
                  <button
                    onClick={() => deleteMutation.mutate(row.id)}
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
                  <th className="text-right px-4 py-3">{isPO ? t("number") : t("name")}</th>
                  <th className="text-right px-4 py-3">{t("contact")}</th>
                  <th className="text-right px-4 py-3">{t("date")}</th>
                  {!isPO && <th className="text-right px-4 py-3">{t("frequency")}</th>}
                  {!isPO && <th className="text-right px-4 py-3">{t("status")}</th>}
                  <th className="text-right px-4 py-3">{t("total")}</th>
                  {isPO && <th className="text-right px-4 py-3">{t("status")}</th>}
                  <th className="text-right px-4 py-3">{tCommon("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">
                      {isPO ? row.number : row.name}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{row.contact.name}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {formatDate(isPO ? row.date! : row.nextDate!)}
                    </td>
                    {!isPO && (
                      <td className="px-4 py-3 text-slate-400">
                        {t(`freq_${row.frequency}` as "freq_MONTHLY")}
                      </td>
                    )}
                    {!isPO && (
                      <td className="px-4 py-3">
                        <span
                          className={cn(
                            "text-xs px-2 py-1 rounded",
                            row.isActive === false
                              ? "bg-amber-500/10 text-amber-400"
                              : "bg-emerald-500/10 text-emerald-400"
                          )}
                        >
                          {row.isActive === false ? t("paused") : t("active")}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3 text-emerald-400">
                      {formatMoney(Number(row.total), currency)}
                    </td>
                    {isPO && (
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300">
                          {t(`status_${row.status}` as "status_DRAFT")}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {(isPO ? row.status !== "RECEIVED" && row.status !== "CANCELLED" : row.isActive !== false) && (
                          <button
                            onClick={() => convertMutation.mutate(row.id)}
                            disabled={convertMutation.isPending}
                            className="text-xs px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          >
                            {isPO ? t("convert") : t("generateNow")}
                          </button>
                        )}
                        {!isPO && (
                          <button
                            onClick={() => toggleScheduleMutation.mutate(row.id)}
                            disabled={toggleScheduleMutation.isPending}
                            className="text-xs px-2 py-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                          >
                            {row.isActive === false ? t("resume") : t("pause")}
                          </button>
                        )}
                        <button
                          onClick={() => deleteMutation.mutate(row.id)}
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
              {!isPO && (
                <div>
                  <label className="text-xs text-slate-400">{t("scheduleName")}</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
              )}
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
              <div className="grid grid-cols-2 gap-3">
                {isPO ? (
                  <>
                    <div>
                      <label className="text-xs text-slate-400">{t("date")}</label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">{t("expectedDate")}</label>
                      <input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="text-xs text-slate-400">{t("nextDate")}</label>
                      <input
                        type="date"
                        value={nextDate}
                        onChange={(e) => setNextDate(e.target.value)}
                        className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400">{t("frequency")}</label>
                      <select
                        value={frequency}
                        onChange={(e) => setFrequency(e.target.value)}
                        className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                      >
                        {["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"].map((f) => (
                          <option key={f} value={f}>{t(`freq_${f}` as "freq_MONTHLY")}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-slate-400">{tInvoices("items")}</label>
                  <button
                    type="button"
                    onClick={() => setLines([...lines, emptyLine()])}
                    className="text-xs text-emerald-400"
                  >
                    + {tInvoices("addItem")}
                  </button>
                </div>
                <div className="space-y-2">
                  <LineItemsGrid
                    headerColumns={[
                      { key: "desc", label: tInvoices("description"), className: "col-span-5" },
                      { key: "qty", label: tInvoices("quantity"), className: "col-span-2" },
                      { key: "price", label: tInvoices("unitPrice"), className: "col-span-2" },
                      { key: "disc", label: tInvoices("discount"), className: "col-span-2" },
                      { key: "act", label: "", className: "col-span-1" },
                    ]}
                  >
                  {lines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-end sm:items-center">
                      <div className="col-span-12 sm:col-span-5">
                        <LineFieldLabel>{tInvoices("description")}</LineFieldLabel>
                      <input
                        aria-label={tInvoices("description")}
                        value={line.description}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx].description = e.target.value;
                          setLines(next);
                        }}
                        className="col-span-5 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm w-full"
                      />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <LineFieldLabel>{tInvoices("quantity")}</LineFieldLabel>
                      <DecimalInput
                        aria-label={tInvoices("quantity")}
                        value={line.quantity}
                        onChange={(v) => {
                          const next = [...lines];
                          next[idx].quantity = v;
                          setLines(next);
                        }}
                        className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm w-full"
                      />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <LineFieldLabel>{tInvoices("unitPrice")}</LineFieldLabel>
                      <DecimalInput
                        aria-label={tInvoices("unitPrice")}
                        value={line.unitPrice}
                        onChange={(v) => {
                          const next = [...lines];
                          next[idx].unitPrice = v;
                          setLines(next);
                        }}
                        className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm w-full"
                      />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <LineFieldLabel>{tInvoices("discount")}</LineFieldLabel>
                      <DecimalInput
                        aria-label={tInvoices("discount")}
                        value={line.discount}
                        onChange={(v) => {
                          const next = [...lines];
                          next[idx].discount = v;
                          setLines(next);
                        }}
                        className="col-span-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-2 text-white text-sm w-full"
                      />
                      </div>
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== idx))}
                          className="col-span-12 sm:col-span-1 text-slate-400 hover:text-rose-400 p-2 flex justify-end sm:justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  </LineItemsGrid>
                </div>
                <p className="text-sm text-slate-400 mt-2">
                  {t("estimatedTotal")}: {formatMoney(lineTotal, currency)}
                </p>
              </div>
              <div>
                <label className="text-xs text-slate-400">{tInvoices("notes")}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm"
                />
              </div>
            </div>
            <div className="p-5 border-t border-slate-800 flex justify-end gap-3">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm",
                  saveMutation.isPending && "opacity-60"
                )}
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
