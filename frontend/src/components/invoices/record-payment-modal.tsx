"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Loader2, Receipt } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney } from "@/lib/utils";
import { DecimalInput } from "@/components/ui/decimal-input";

export interface CollectibleInvoice {
  id: string;
  number: string;
  type: string;
  total: number;
  paidAmount: number;
  status: string;
  paymentStatus: string;
  contact?: { name: string };
}

interface RecordPaymentModalProps {
  open: boolean;
  invoices: CollectibleInvoice[];
  currency?: string;
  defaultInvoiceId?: string;
  onClose: () => void;
  onSuccess?: (invoiceId: string) => void;
}

const PAYMENT_METHODS = [
  "CASH",
  "BANK_TRANSFER",
  "CREDIT_CARD",
  "CHECK",
  "ONLINE",
  "OTHER",
] as const;

export function RecordPaymentModal({
  open,
  invoices,
  currency = "OMR",
  defaultInvoiceId,
  onClose,
  onSuccess,
}: RecordPaymentModalProps) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const collectible = invoices.filter(
    (inv) =>
      inv.status !== "CANCELLED" &&
      inv.status !== "PAID" &&
      inv.paymentStatus !== "PAID"
  );

  const [invoiceId, setInvoiceId] = useState(defaultInvoiceId || "");
  const [method, setMethod] = useState<string>("CASH");
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");

  const selected = collectible.find((i) => i.id === invoiceId);
  const remaining = selected
    ? Number((Number(selected.total) - Number(selected.paidAmount || 0)).toFixed(3))
    : 0;

  useEffect(() => {
    if (!open) return;
    const id = defaultInvoiceId || collectible[0]?.id || "";
    setInvoiceId(id);
  }, [open, defaultInvoiceId, collectible]);

  useEffect(() => {
    if (selected) setAmount(remaining);
  }, [selected?.id, remaining]);

  const mutation = useMutation({
    mutationFn: () =>
      api.recordInvoicePayment(invoiceId, {
        method,
        amount,
        date,
        reference: reference || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(t("paidSuccess"));
      onSuccess?.(invoiceId);
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || t("actionError"));
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-16 bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-semibold text-white">{t("recordReceipt")}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {collectible.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">{t("noCollectible")}</p>
          ) : (
            <>
              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("selectInvoice")}</label>
                <select
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                >
                  {collectible.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.number} — {inv.contact?.name} —{" "}
                      {formatMoney(Number(inv.total), currency)}
                    </option>
                  ))}
                </select>
              </div>

              {selected && (
                <div className="rounded-lg bg-slate-800/50 p-3 text-sm flex justify-between">
                  <span className="text-slate-400">{t("remaining")}</span>
                  <span className="text-white font-semibold">
                    {formatMoney(remaining, currency)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("paymentMethod")}</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`method_${m}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">{t("date")}</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("amount")}</label>
                <DecimalInput
                  value={amount}
                  min={0.001}
                  decimals={3}
                  onChange={(v) => setAmount(v)}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("reference")}</label>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder={t("referenceHint")}
                  className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">{t("notes")}</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                />
              </div>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={!invoiceId || amount <= 0 || mutation.isPending || collectible.length === 0}
              onClick={() => mutation.mutate()}
              className="flex-1 h-10 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Receipt className="w-4 h-4" />
                  {t("recordReceipt")}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
