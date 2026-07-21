"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, X, Banknote, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatDate, formatMoney, cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";
import { DecimalInput } from "@/components/ui/decimal-input";

interface LineForm {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CashInvoice {
  id: string;
  number: string;
  date: string;
  total: number;
  currency?: string;
  exchangeRate?: number;
  foreignTotal?: number | null;
  status: string;
  paymentStatus: string;
  isCash?: boolean;
  notes?: string | null;
  contact?: { id: string; name: string };
  items: { description: string; quantity: number; unitPrice: number; total: number }[];
  payments?: { method: string; amount: number }[];
}

const CURRENCIES = ["OMR", "USD", "EUR", "SAR", "AED", "KWD", "BHD", "QAR", "GBP"];

const emptyLine = (): LineForm => ({
  description: "",
  quantity: 1,
  unitPrice: 0,
});

export function CashDocumentsPage({
  docType,
}: {
  docType: "SALES" | "PURCHASE";
}) {
  const t = useTranslations("cashDocs");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const baseCurrency = useAuthStore((s) => s.user?.company?.currency) || "OMR";
  const vatRate = Number(useAuthStore((s) => s.user?.company?.vatRate) ?? 5);
  const applyVat = useAuthStore((s) => s.user?.company?.applyVat) !== false;

  const [open, setOpen] = useState(false);
  const [contactId, setContactId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [method, setMethod] = useState("CASH");
  const [docCurrency, setDocCurrency] = useState(baseCurrency);
  const [exchangeRate, setExchangeRate] = useState(1);
  const [rateLoading, setRateLoading] = useState(false);
  const [lines, setLines] = useState<LineForm[]>([emptyLine()]);

  const contactType = docType === "SALES" ? "CUSTOMER" : "SUPPLIER";
  const isForeign = docCurrency.toUpperCase() !== baseCurrency.toUpperCase();
  const rateSafe = exchangeRate > 0 ? exchangeRate : 1;

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", contactType],
    queryFn: async () => {
      const res = await api.getContacts(contactType);
      return res.data as { id: string; name: string }[];
    },
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["cash-invoices", docType],
    queryFn: async () => {
      const res = await api.getInvoices({ isCash: true, type: docType });
      return res.data as CashInvoice[];
    },
  });

  const taxRate = applyVat ? vatRate : 0;
  const lineNet = (l: LineForm) => l.quantity * l.unitPrice;
  const subtotal = lines.reduce((s, l) => s + lineNet(l), 0);
  const taxAmount = Number(((subtotal * taxRate) / 100).toFixed(3));
  const total = Number((subtotal + taxAmount).toFixed(3));
  const baseTotal = isForeign ? Number((total * rateSafe).toFixed(3)) : total;

  const loadExchangeRate = useCallback(
    async (from: string, asOf: string) => {
      const to = baseCurrency.toUpperCase();
      if (from.toUpperCase() === to) {
        setExchangeRate(1);
        return;
      }
      setRateLoading(true);
      try {
        const res = await api.convertExchangeRate({ from, to, amount: 1, date: asOf });
        const data = res.data as { rate?: number };
        if (data.rate && data.rate > 0) setExchangeRate(Number(data.rate));
      } catch {
        /* keep manual rate */
      } finally {
        setRateLoading(false);
      }
    },
    [baseCurrency],
  );

  const reset = () => {
    setContactId("");
    setDate(new Date().toISOString().split("T")[0]);
    setNotes("");
    setMethod("CASH");
    setDocCurrency(baseCurrency);
    setExchangeRate(1);
    setLines([emptyLine()]);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cash-invoices"] });
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
  };

  const displayRowAmount = (row: CashInvoice) => {
    const rowCur = (row.currency || baseCurrency).toUpperCase();
    const foreign = row.foreignTotal != null && rowCur !== baseCurrency.toUpperCase();
    if (foreign) {
      return formatMoney(Number(row.foreignTotal), rowCur);
    }
    return formatMoney(Number(row.total), baseCurrency);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const items = lines
        .filter((l) => l.description.trim() && l.quantity > 0)
        .map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          taxRate,
        }));
      if (!contactId || items.length === 0) throw new Error(t("needItems"));
      return api.createInvoice({
        type: docType,
        contactId,
        date,
        dueDate: date,
        notes: notes || undefined,
        taxRate,
        payImmediately: true,
        paymentMethod: method,
        currency: docCurrency,
        exchangeRate: isForeign ? Number(rateSafe) : 1,
        items,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t("created"));
      setOpen(false);
      reset();
    },
    onError: (err: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(err.response?.data?.message || err.message || tCommon("error"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteInvoice(id),
    onSuccess: () => {
      invalidate();
      toast.success(tCommon("deleted"));
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err.response?.data?.message || tCommon("error"));
    },
  });

  const title = docType === "SALES" ? t("salesTitle") : t("purchaseTitle");
  const subtitle = docType === "SALES" ? t("salesSubtitle") : t("purchaseSubtitle");
  const empty = docType === "SALES" ? t("salesEmpty") : t("purchaseEmpty");
  const contactLabel = docType === "SALES" ? t("customer") : t("supplier");

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
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
        <EmptyState icon={Banknote} title={empty} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-2">
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="font-medium text-white">{row.number}</p>
                    <p className="text-sm text-slate-400">{row.contact?.name}</p>
                  </div>
                  <p className="text-emerald-400 font-medium">{displayRowAmount(row)}</p>
                </div>
                <div className="flex justify-between text-sm text-slate-400">
                  <span>{formatDate(row.date)}</span>
                  <span className="text-emerald-400/80">{t("paidCash")}</span>
                </div>
                {row.foreignTotal != null &&
                  (row.currency || "").toUpperCase() !== baseCurrency.toUpperCase() && (
                    <p className="text-xs text-slate-500">
                      {t("baseEquivalent")}: {formatMoney(Number(row.total), baseCurrency)}
                    </p>
                  )}
              </GlassCard>
            ))}
          </div>

          <div className="hidden md:block glass rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/50 text-slate-400 text-left">
                <tr>
                  <th className="px-4 py-3">{t("number")}</th>
                  <th className="px-4 py-3">{contactLabel}</th>
                  <th className="px-4 py-3">{t("date")}</th>
                  <th className="px-4 py-3">{t("currency")}</th>
                  <th className="px-4 py-3 text-end">{t("total")}</th>
                  <th className="px-4 py-3">{t("method")}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3 text-white font-medium">{row.number}</td>
                    <td className="px-4 py-3 text-slate-300">{row.contact?.name || "—"}</td>
                    <td className="px-4 py-3 text-slate-300">{formatDate(row.date)}</td>
                    <td className="px-4 py-3 text-slate-300">{row.currency || baseCurrency}</td>
                    <td className="px-4 py-3 text-end text-emerald-400 font-medium">
                      {displayRowAmount(row)}
                      {row.foreignTotal != null &&
                        (row.currency || "").toUpperCase() !== baseCurrency.toUpperCase() && (
                          <div className="text-xs text-slate-500 font-normal">
                            {formatMoney(Number(row.total), baseCurrency)}
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3 text-slate-300">
                      {row.payments?.[0]?.method || "CASH"}
                    </td>
                    <td className="px-4 py-3 text-end">
                      {row.status !== "PAID" && (
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

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-slate-900 rounded-t-2xl sm:rounded-xl border border-slate-700 p-5 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">{t("new")}</h3>
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400">{t("hint")}</p>

            <div>
              <label className="text-sm text-slate-400">{contactLabel}</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
              >
                <option value="">{t("selectContact")}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <label className="text-sm text-slate-400">{t("method")}</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                >
                  <option value="CASH">{t("methodCash")}</option>
                  <option value="BANK_TRANSFER">{t("methodBank")}</option>
                  <option value="CREDIT_CARD">{t("methodCard")}</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-slate-400">{t("currency")}</label>
                <select
                  value={docCurrency}
                  onChange={(e) => {
                    const next = e.target.value;
                    setDocCurrency(next);
                    void loadExchangeRate(next, date);
                  }}
                  className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400">
                  {t("exchangeRate")}
                  {rateLoading ? "…" : ""}
                </label>
                <DecimalInput
                  value={exchangeRate}
                  onChange={setExchangeRate}
                  min={0.000001}
                  disabled={!isForeign}
                  className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white disabled:opacity-50"
                />
              </div>
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
                <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-12 sm:col-span-5">
                    <input
                      value={line.description}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, description: e.target.value } : l)),
                        )
                      }
                      placeholder={t("description")}
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-4 sm:col-span-2">
                    <DecimalInput
                      value={line.quantity}
                      onChange={(v) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, quantity: v } : l)),
                        )
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-3">
                    <DecimalInput
                      value={line.unitPrice}
                      onChange={(v) =>
                        setLines((prev) =>
                          prev.map((l, i) => (i === idx ? { ...l, unitPrice: v } : l)),
                        )
                      }
                      className="w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-2 text-white text-sm"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-2 flex justify-end">
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

            <div className="rounded-lg bg-slate-800/50 p-3 text-sm space-y-1">
              <div className="flex justify-between text-slate-400">
                <span>{t("subtotal")}</span>
                <span>{formatMoney(subtotal, docCurrency)}</span>
              </div>
              {taxRate > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>
                    {t("vat")} ({taxRate}%)
                  </span>
                  <span>{formatMoney(taxAmount, docCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-medium pt-1 border-t border-slate-700">
                <span>{t("total")}</span>
                <span className="text-emerald-400">{formatMoney(total, docCurrency)}</span>
              </div>
              {isForeign && (
                <div className="flex justify-between text-slate-400 text-xs pt-1">
                  <span>
                    {t("baseEquivalent")} ({baseCurrency} × {rateSafe})
                  </span>
                  <span className="text-emerald-400">{formatMoney(baseTotal, baseCurrency)}</span>
                </div>
              )}
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
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-white",
                "bg-gradient-to-r from-emerald-500 to-teal-600 disabled:opacity-50",
              )}
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t("createAndPay")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
