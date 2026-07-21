"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Eye, Printer, Receipt } from "lucide-react";
import api from "@/lib/api";
import { formatMoney, formatDate } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { PageHeader, LoadingSpinner, EmptyState, GlassCard } from "@/components/ui/page-shell";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoices/invoice-document";

interface ReceiptRow {
  id: string;
  amount: number;
  method: string;
  reference?: string;
  date: string;
  notes?: string;
  invoice: {
    id: string;
    number: string;
    type: string;
    contact: { id: string; name: string; nameEn?: string };
  };
}

interface ReceiptsListPageProps {
  direction: "SALES" | "PURCHASE";
  title: string;
  subtitle: string;
  emptyLabel: string;
}

function toDocumentData(inv: Record<string, unknown>): InvoiceDocumentData {
  const items = (inv.items as Record<string, unknown>[]) || [];
  return {
    id: inv.id as string,
    number: inv.number as string,
    type: inv.type as string,
    date: inv.date as string,
    dueDate: inv.dueDate as string,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount),
    taxRate: Number(inv.taxRate),
    taxAmount: Number(inv.taxAmount),
    total: Number(inv.total),
    status: inv.status as string,
    paidAmount: Number(inv.paidAmount || 0),
    paymentStatus: inv.paymentStatus as string | undefined,
    notes: inv.notes as string | undefined,
    contact: inv.contact as InvoiceDocumentData["contact"],
    items: items.map((i) => ({
      description: i.description as string,
      quantity: Number(i.quantity),
      unitPrice: Number(i.unitPrice),
      discount: Number(i.discount),
      taxAmount: Number(i.taxAmount),
      total: Number(i.total),
    })),
  };
}

export function ReceiptsListPage({
  direction,
  title,
  subtitle,
  emptyLabel,
}: ReceiptsListPageProps) {
  const t = useTranslations("receipts");
  const tInvoices = useTranslations("invoices");
  const { company } = useAuthStore();
  const currency = company?.currency || "OMR";
  const [documentInvoice, setDocumentInvoice] = useState<InvoiceDocumentData | null>(null);
  const [loadingDoc, setLoadingDoc] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["payment-vouchers", direction],
    queryFn: async () => {
      const res = await api.getPaymentVouchers(direction);
      return res.data as ReceiptRow[];
    },
  });

  const { data: receiptTemplate } = useQuery({
    queryKey: ["document-templates", "RECEIPT"],
    queryFn: async () => {
      const res = await api.getDefaultDocumentTemplate("RECEIPT");
      return res.data as { headerText?: string | null; footerText?: string | null } | null;
    },
  });

  const total = rows.reduce((s, r) => s + r.amount, 0);

  const openReceipt = async (invoiceId: string) => {
    setLoadingDoc(invoiceId);
    try {
      const res = await api.getInvoice(invoiceId);
      setDocumentInvoice(toDocumentData(res.data as Record<string, unknown>));
    } finally {
      setLoadingDoc(null);
    }
  };

  const renderActions = (row: ReceiptRow) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => openReceipt(row.invoice.id)}
        disabled={loadingDoc === row.invoice.id}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700"
      >
        <Eye className="w-3.5 h-3.5" />
        {t("view")}
      </button>
      <button
        type="button"
        onClick={() => openReceipt(row.invoice.id)}
        disabled={loadingDoc === row.invoice.id}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
      >
        <Printer className="w-3.5 h-3.5" />
        {t("print")}
      </button>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard className="p-4">
          <p className="text-xs text-slate-400">{t("count")}</p>
          <p className="text-2xl font-bold text-white mt-1">{rows.length}</p>
        </GlassCard>
        <GlassCard className="p-4 sm:col-span-2">
          <p className="text-xs text-slate-400">{t("totalAmount")}</p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{formatMoney(total, currency)}</p>
        </GlassCard>
      </div>

      {isLoading ? (
        <LoadingSpinner />
      ) : rows.length === 0 ? (
        <EmptyState icon={Receipt} title={emptyLabel} />
      ) : (
        <>
          <div className="md:hidden space-y-3">
            {rows.map((row) => (
              <GlassCard key={row.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-white font-semibold">{row.invoice.number}</p>
                    <p className="text-sm text-slate-400 mt-0.5">{row.invoice.contact.name}</p>
                  </div>
                  <p className="text-emerald-400 font-bold shrink-0">
                    {formatMoney(row.amount, currency)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                  <span>{formatDate(row.date)}</span>
                  <span>{tInvoices(`method_${row.method}` as "method_CASH")}</span>
                  {row.reference && <span>{row.reference}</span>}
                </div>
                {renderActions(row)}
              </GlassCard>
            ))}
          </div>

          <GlassCard className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50 text-slate-400">
                    <th className="text-right px-4 py-3 font-medium">{t("date")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("contact")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("invoice")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("method")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("reference")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("amount")}</th>
                    <th className="text-right px-4 py-3 font-medium">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-300">{formatDate(row.date)}</td>
                      <td className="px-4 py-3 text-white">{row.invoice.contact.name}</td>
                      <td className="px-4 py-3 text-slate-300">{row.invoice.number}</td>
                      <td className="px-4 py-3 text-slate-300">
                        {tInvoices(`method_${row.method}` as "method_CASH")}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{row.reference || "—"}</td>
                      <td className="px-4 py-3 text-emerald-400 font-medium">
                        {formatMoney(row.amount, currency)}
                      </td>
                      <td className="px-4 py-3">{renderActions(row)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </>
      )}

      {documentInvoice && (
        <InvoiceDocument
          invoice={documentInvoice}
          company={company}
          currency={currency}
          variant="receipt"
          headerNote={receiptTemplate?.headerText}
          footerNote={receiptTemplate?.footerText}
          onClose={() => setDocumentInvoice(null)}
        />
      )}
    </div>
  );
}
