"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { X, Loader2, Undo2, AlertTriangle } from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  date: string;
  reference?: string | null;
  notes?: string | null;
}

interface ReversePaymentModalProps {
  open: boolean;
  invoiceId: string;
  invoiceNumber?: string;
  currency?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ReversePaymentModal({
  open,
  invoiceId,
  invoiceNumber,
  currency = "OMR",
  onClose,
  onSuccess,
}: ReversePaymentModalProps) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", invoiceId],
    queryFn: async () => {
      const res = await api.getInvoice(invoiceId);
      return res.data as {
        number: string;
        paidAmount: number;
        paymentStatus?: string;
        payments: PaymentRow[];
      };
    },
    enabled: open && !!invoiceId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] });
    queryClient.invalidateQueries({ queryKey: ["invoice", invoiceId] });
    queryClient.invalidateQueries({ queryKey: ["invoice-stats"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
  };

  const reverseOne = useMutation({
    mutationFn: (paymentId: string) => api.reverseInvoicePayment(invoiceId, paymentId),
    onSuccess: () => {
      invalidate();
      toast.success(t("paymentReversed"));
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || t("actionError"));
    },
  });

  const reverseAll = useMutation({
    mutationFn: () => api.reverseAllInvoicePayments(invoiceId),
    onSuccess: () => {
      invalidate();
      toast.success(t("allPaymentsReversed"));
      onSuccess?.();
      onClose();
    },
    onError: (err: unknown) => {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || t("actionError"));
    },
  });

  if (!open) return null;

  const payments = [...(invoice?.payments || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const paidRecorded =
    Number(invoice?.paidAmount || 0) > 0.0005 ||
    invoice?.paymentStatus === "PAID" ||
    invoice?.paymentStatus === "PARTIAL";
  const canForceReverse = payments.length === 0 && paidRecorded;
  const busy = reverseOne.isPending || reverseAll.isPending;
  const num = invoiceNumber || invoice?.number || "—";

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-16 bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Undo2 className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-semibold text-white">{t("reversePayment")}</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2 rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-sm text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <p>{t("reversePaymentHint")}</p>
          </div>

          <p className="text-sm text-slate-400">
            {t("number")}: <span className="text-white font-medium">{num}</span>
            {invoice && (
              <>
                {" — "}
                {t("amountPaid")}:{" "}
                <span className="text-emerald-400">
                  {formatMoney(Number(invoice.paidAmount), currency)}
                </span>
              </>
            )}
          </p>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            </div>
          ) : payments.length === 0 && canForceReverse ? (
            <div className="rounded-lg bg-slate-800/50 border border-slate-700 p-4 text-center space-y-3">
              <p className="text-sm text-slate-300">{t("legacyPaymentHint")}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(t("reverseAllConfirm"))) reverseAll.mutate();
                }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {reverseAll.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Undo2 className="w-4 h-4" />
                    {t("reverseRecordedAmount")}
                  </>
                )}
              </button>
            </div>
          ) : payments.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">{t("noPaymentsToReverse")}</p>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {payments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700"
                >
                  <div className="min-w-0">
                    <p className="text-white font-medium">
                      {formatMoney(Number(p.amount), currency)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(p.date)} — {t(`method_${p.method}`)}
                      {p.reference ? ` — ${p.reference}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(t("reversePaymentConfirm"))) {
                        reverseOne.mutate(p.id);
                      }
                    }}
                    className="shrink-0 px-3 py-1.5 text-xs rounded-lg bg-amber-600/20 text-amber-300 border border-amber-600/40 hover:bg-amber-600/30 disabled:opacity-50"
                  >
                    {t("reverseThis")}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              {tCommon("cancel")}
            </button>
            {payments.length >= 1 && (
              <button
                type="button"
                disabled={busy || (payments.length === 0 && !canForceReverse)}
                onClick={() => {
                  if (confirm(t("reverseAllConfirm"))) reverseAll.mutate();
                }}
                className="flex-1 h-10 rounded-lg bg-amber-600 text-white hover:bg-amber-500 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {reverseAll.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Undo2 className="w-4 h-4" />
                    {t("reverseAll")}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
