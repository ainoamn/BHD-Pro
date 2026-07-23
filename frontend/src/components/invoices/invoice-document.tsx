"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X, Printer, Download, Send, CheckCircle, Ban, Edit, Receipt, Undo2, FileOutput } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/utils";
import { openInvoicePrintDialog } from "@/lib/invoice-print";
import { DocumentWorkflowSteps } from "@/components/invoices/document-workflow-steps";
import { SendDocumentModal } from "@/components/invoices/send-document-modal";
import { CompanyLogo } from "@/components/company/company-logo";
import api from "@/lib/api";
import { buildDocumentQrDataUrl } from "@/lib/document-qr";
import { toAppAbsoluteUrl } from "@/lib/app-url";
import { formatContactAddressLines, formatCompanyAddressCompact } from "@/lib/contact-address";
import {
  documentColorDark,
  documentColorSoft,
  normalizeDocumentColor,
} from "@/lib/document-theme";

export interface InvoiceDocumentData {
  id: string;
  number: string;
  type: string;
  date: string;
  dueDate: string;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency?: string;
  exchangeRate?: number;
  foreignTotal?: number | null;
  status: string;
  paidAmount?: number;
  paymentStatus?: string;
  notes?: string;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    phone2?: string;
    address?: string;
    city?: string;
    country?: string;
    zipCode?: string;
    taxId?: string;
    crNumber?: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    taxAmount: number;
    total: number;
  }[];
}

interface CompanyInfo {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  email?: string;
  vatNumber?: string;
  crNumber?: string;
  logo?: string | null;
  signatureMode?: "ELECTRONIC" | "MANUAL";
  documentColor?: string | null;
}

interface InvoiceDocumentProps {
  invoice: InvoiceDocumentData;
  company?: CompanyInfo | null;
  currency?: string;
  baseCurrency?: string;
  variant?: "invoice" | "receipt";
  headerNote?: string | null;
  footerNote?: string | null;
  /** When set (e.g. public share page), QR points here instead of creating a new link */
  verifyUrl?: string | null;
  onClose: () => void;
  onMarkPaid?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onMarkSent?: () => void;
  onUnsend?: () => void;
  onReversePayment?: () => void;
  onViewReceipt?: () => void;
  onViewInvoice?: () => void;
  onConvertToInvoice?: () => void;
  actionsDisabled?: boolean;
}

export function InvoiceDocument({
  invoice,
  company,
  currency = "OMR",
  baseCurrency = "OMR",
  variant = "invoice",
  headerNote,
  footerNote,
  verifyUrl: verifyUrlProp,
  onClose,
  onMarkPaid,
  onCancel,
  onEdit,
  onMarkSent,
  onUnsend,
  onReversePayment,
  onViewReceipt,
  onViewInvoice,
  onConvertToInvoice,
  actionsDisabled,
}: InvoiceDocumentProps) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const printRef = useRef<HTMLDivElement>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const signatureMode = company?.signatureMode === "ELECTRONIC" ? "ELECTRONIC" : "MANUAL";
  const docColor = normalizeDocumentColor(company?.documentColor);
  const docColorDark = documentColorDark(docColor);
  const docColorSoft = documentColorSoft(docColor);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let url = verifyUrlProp || null;
        if (!url && invoice.id) {
          const res = await api.createDocumentVerifyLink(invoice.id, variant);
          // Prefer absolute API verifyUrl (Render HTML) so phone QR works
          // even when www.hisaby.pro is unreachable.
          const absolute = (res.data.verifyUrl || "").trim();
          if (/^https?:\/\//i.test(absolute)) {
            url = absolute;
          } else if (res.data.verifyPath) {
            url = toAppAbsoluteUrl(res.data.verifyPath);
          } else if (absolute) {
            url = toAppAbsoluteUrl(absolute);
          }
        } else if (url && !/^https?:\/\//i.test(url)) {
          url = toAppAbsoluteUrl(url);
        }
        if (!url || cancelled) return;
        const dataUrl = await buildDocumentQrDataUrl(url, 280);
        if (!cancelled) setQrDataUrl(dataUrl);
      } catch {
        if (!cancelled) setQrDataUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoice.id, variant, verifyUrlProp]);

  const docCurrency = (invoice.currency || currency).toUpperCase();
  const rate = Number(invoice.exchangeRate || 1) || 1;
  const isFx =
    !!invoice.foreignTotal &&
    docCurrency !== baseCurrency.toUpperCase() &&
    rate !== 1;
  const displayCurrency = isFx ? docCurrency : baseCurrency;
  const displaySubtotal = isFx
    ? invoice.items.reduce((s, i) => s + Number(i.quantity) * Number(i.unitPrice) - Number(i.discount), 0)
    : Number(invoice.subtotal);
  const displayTax = isFx
    ? invoice.items.reduce((s, i) => s + Number(i.taxAmount), 0)
    : Number(invoice.taxAmount);
  const displayDiscount = isFx
    ? Number((Number(invoice.discount) / rate).toFixed(3))
    : Number(invoice.discount);
  const displayTotal = isFx ? Number(invoice.foreignTotal) : Number(invoice.total);
  const headerTaxRate = Number(invoice.taxRate ?? 0);
  const taxLabel =
    headerTaxRate > 0
      ? t("taxAtRate", { rate: headerTaxRate })
      : t("taxExempt");

  const isReceipt = variant === "receipt";
  const isQuotation = invoice.type === "QUOTATION";
  const isCreditNote = invoice.type === "CREDIT_NOTE";
  const isCustomerDoc = ["SALES", "QUOTATION", "CREDIT_NOTE"].includes(invoice.type);

  const documentTypeLabel = () => {
    if (isReceipt) return t("receiptDoc");
    if (isQuotation) return t("quotationDoc");
    if (isCreditNote) return t("creditNoteDoc");
    if (invoice.type === "SALES") return t("salesInvoice");
    if (invoice.type === "PURCHASE") return t("purchaseInvoice");
    if (invoice.type === "DEBIT_NOTE") return t("creditNoteDoc");
    return t("invoiceDoc");
  };

  const docTitle = documentTypeLabel();

  const printLabels = {
    docTitle,
    number: t("number"),
    date: t("date"),
    dueDate: t("dueDate"),
    customer: t("customer"),
    supplier: t("supplier"),
    description: t("description"),
    quantity: t("quantity"),
    unitPrice: t("unitPrice"),
    discount: t("discount"),
    tax: t("tax"),
    lineTotal: t("lineTotal"),
    subtotal: t("subtotal"),
    grandTotal: t("grandTotal"),
    notes: t("notes"),
    amountPaid: t("amountPaid"),
    receiptDoc: t("receiptDoc"),
    receiptPaidNote: t("receiptPaidNote"),
    paid: tStatus("paid"),
    currency: t("currency"),
    exchangeRate: t("exchangeRate"),
    baseEquivalent: t("baseEquivalent"),
    vatNumber: t("vatNumber"),
    taxId: t("taxId"),
    crNumber: t("crNumber"),
    printFooter: t("printFooter"),
    receiptFooter: t("receiptFooter"),
    electronicSignatureNote: t("electronicSignatureNote"),
    signatureAuthorized: t("signatureAuthorized"),
    signatureStamp: t("signatureStamp"),
    signatureCustomer: t("signatureCustomer"),
    verifyQrTitle: t("verifyQrTitle"),
    verifyQrHint: t("verifyQrHint"),
    workflowDraft: t("workflowDraft"),
    workflowIssued: t("workflowIssued"),
    workflowClaim: t("workflowClaim"),
    workflowReceipt: t("workflowReceipt"),
    workflowQuoteDraft: t("workflowQuoteDraft"),
    workflowQuoteSent: t("workflowQuoteSent"),
    workflowQuoteInvoice: t("workflowQuoteInvoice"),
  };

  const handlePrint = () => {
    openInvoicePrintDialog(invoice, company, {
      variant,
      baseCurrency,
      headerNote,
      footerNote,
      signatureMode,
      qrDataUrl,
      documentColor: docColor,
      labels: printLabels,
    });
  };

  const handleDownloadPdf = () => {
    handlePrint();
  };

  const isSales = isCustomerDoc;
  const hasPayments =
    Number(invoice.paidAmount || 0) > 0 ||
    invoice.paymentStatus === "PARTIAL" ||
    invoice.paymentStatus === "PAID";
  const canUnsend =
    onUnsend &&
    ["SENT", "VIEWED", "OVERDUE"].includes(invoice.status) &&
    !hasPayments;
  const showWorkflowActions =
    !isReceipt &&
    (onMarkPaid || onCancel || onEdit || onMarkSent || onViewReceipt || onUnsend || onReversePayment);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">
            {docTitle} — {invoice.number}
          </h2>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {isReceipt && onViewInvoice && (
              <button
                onClick={onViewInvoice}
                disabled={actionsDisabled}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100 disabled:opacity-40"
              >
                {t("invoiceDoc")}
              </button>
            )}
            {isReceipt && onReversePayment && hasPayments && (
              <button
                onClick={onReversePayment}
                disabled={actionsDisabled}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-orange-600 text-white rounded-lg hover:bg-orange-500 disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" />
                {t("reversePayment")}
              </button>
            )}
            {!isReceipt && invoice.status === "PAID" && onViewReceipt && (
              <button
                onClick={onViewReceipt}
                disabled={actionsDisabled}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-40"
              >
                <Receipt className="w-4 h-4" />
                {t("receipt")}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-white text-slate-900 rounded-lg hover:bg-slate-100"
              title={tCommon("print")}
            >
              <Printer className="w-4 h-4" />
              {tCommon("print")}
            </button>
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-slate-100 text-slate-900 rounded-lg hover:bg-white border border-slate-300"
            >
              <Download className="w-4 h-4" />
              {t("download")}
            </button>
            <button
              onClick={() => setSendOpen(true)}
              disabled={actionsDisabled}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {t("sendDocument")}
            </button>
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showWorkflowActions && (
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/80 space-y-3">
            <DocumentWorkflowSteps
              docType={invoice.type}
              status={invoice.status}
              paymentStatus={invoice.paymentStatus}
            />
            <div className="flex flex-wrap gap-2">
            {isQuotation && onConvertToInvoice && invoice.status !== "CANCELLED" && (
              <button
                type="button"
                onClick={onConvertToInvoice}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <FileOutput className="w-4 h-4" />
                {t("convertQuotation")}
              </button>
            )}
            {onEdit &&
              invoice.status !== "PAID" &&
              invoice.status !== "CANCELLED" &&
              !hasPayments && (
              <button
                type="button"
                onClick={onEdit}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40"
              >
                <Edit className="w-4 h-4" />
                {tCommon("edit")}
              </button>
            )}
            {canUnsend && (
              <button
                type="button"
                onClick={onUnsend}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-400 disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" />
                {t("undoSend")}
              </button>
            )}
            {onReversePayment && hasPayments && (
              <button
                type="button"
                onClick={onReversePayment}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-orange-600 text-white hover:bg-orange-500 disabled:opacity-40"
              >
                <Undo2 className="w-4 h-4" />
                {t("reversePayment")}
              </button>
            )}
            {onMarkSent && invoice.status === "DRAFT" && (
              <button
                type="button"
                onClick={onMarkSent}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {isQuotation ? t("sendQuotation") : t("issueInvoice")}
              </button>
            )}
            {onMarkPaid &&
              !isQuotation &&
              ["SENT", "OVERDUE", "VIEWED", "DRAFT"].includes(invoice.status) && (
              <button
                type="button"
                onClick={onMarkPaid}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40"
              >
                <CheckCircle className="w-4 h-4" />
                {t("recordReceipt")}
              </button>
            )}
            {onCancel && ["DRAFT", "SENT", "OVERDUE", "VIEWED"].includes(invoice.status) && (
              <button
                type="button"
                onClick={onCancel}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg bg-amber-700 text-white hover:bg-amber-600 disabled:opacity-40"
              >
                <Ban className="w-4 h-4" />
                {t("cancelInvoice")}
              </button>
            )}
            </div>
          </div>
        )}

        <div className="p-5 bg-white text-slate-900 rounded-b-2xl" ref={printRef}>
          {isReceipt && (
            <div
              className="mb-4 flex items-center justify-between rounded-md border px-3 py-2"
              style={{ borderColor: docColor, backgroundColor: docColorSoft }}
            >
              <div>
                <p className="text-sm font-bold" style={{ color: docColorDark }}>
                  {t("receiptDoc")}
                </p>
                <p className="text-xs" style={{ color: docColor }}>
                  {t("receiptPaidNote")}
                </p>
              </div>
              <span
                className="rounded-full px-3 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: docColor }}
              >
                {tStatus("paid")}
              </span>
            </div>
          )}
          <div
            className="header flex justify-between items-start gap-4 mb-5 pb-3 border-b-2"
            style={{ borderColor: docColor }}
          >
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <CompanyLogo src={company?.logo} name={company?.name} size="md" className="shrink-0 mt-0.5" />
              <div className="min-w-0">
                <div className="company text-base sm:text-lg font-bold leading-tight" style={{ color: docColorDark }}>
                  {company?.name || "BHD Pro"}
                </div>
                {!isReceipt && (invoice.type === "SALES" || invoice.type === "QUOTATION") && (
                  <DocumentWorkflowSteps
                    docType={invoice.type}
                    status={invoice.status}
                    paymentStatus={invoice.paymentStatus}
                    appearance="document"
                    accentColor={docColor}
                  />
                )}
                {formatCompanyAddressCompact(company) && (
                  <p className="text-xs sm:text-sm text-slate-700 mt-2 leading-snug font-medium">
                    {formatCompanyAddressCompact(company)}
                  </p>
                )}
                {company?.vatNumber && (
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    {t("vatNumber")}: {company.vatNumber}
                  </p>
                )}
                {company?.crNumber && (
                  <p className="text-xs text-slate-600 font-medium">
                    {t("crNumber")}: {company.crNumber}
                  </p>
                )}
              </div>
            </div>
            <div className="meta text-left shrink-0 text-xs sm:text-sm text-slate-700 leading-relaxed">
              <p className="text-base font-bold text-slate-900 mb-1.5">{documentTypeLabel()}</p>
              <p><strong>{t("number")}:</strong> {invoice.number}</p>
              <p><strong>{t("date")}:</strong> {formatDate(invoice.date)}</p>
              {!isReceipt && (
                <p><strong>{t("dueDate")}:</strong> {formatDate(invoice.dueDate)}</p>
              )}
              {isReceipt && (
                <p><strong>{t("amountPaid")}:</strong> {formatMoney(displayTotal, displayCurrency)}</p>
              )}
              <p><strong>{t("currency")}:</strong> {displayCurrency}</p>
              {isFx && (
                <p><strong>{t("exchangeRate")}:</strong> {rate}</p>
              )}
            </div>
          </div>

          {headerNote && (
            <div className="mb-3 text-[11px] text-slate-500 whitespace-pre-wrap leading-snug">{headerNote}</div>
          )}

          <div className="parties mb-4">
            <div className="box border border-slate-200 rounded-md px-3 py-2 bg-slate-50/80">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="text-[10px] uppercase tracking-wide text-slate-400">
                  {isSales ? t("customer") : t("supplier")}
                </span>
                <span className="text-xs font-semibold text-slate-900">{invoice.contact.name}</span>
              </div>
              {(formatContactAddressLines(invoice.contact).length > 0 ||
                invoice.contact.taxId ||
                invoice.contact.crNumber) && (
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  {[
                    ...formatContactAddressLines(invoice.contact),
                    invoice.contact.taxId ? `${t("taxId")}: ${invoice.contact.taxId}` : null,
                    invoice.contact.crNumber ? `${t("crNumber")}: ${invoice.contact.crNumber}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-white" style={{ backgroundColor: docColor }}>
                <th className="p-2 text-right">{t("description")}</th>
                <th className="p-2 text-right">{t("quantity")}</th>
                <th className="p-2 text-right">{t("unitPrice")}</th>
                <th className="p-2 text-right">{t("discount")}</th>
                <th className="p-2 text-right">{t("tax")}</th>
                <th className="p-2 text-right">{t("lineTotal")}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((item, i) => (
                <tr key={i} className="border-b border-slate-200">
                  <td className="p-2">{item.description}</td>
                  <td className="p-2">{Number(item.quantity)}</td>
                  <td className="p-2">{formatMoney(Number(item.unitPrice), displayCurrency)}</td>
                  <td className="p-2">{formatMoney(Number(item.discount), displayCurrency)}</td>
                  <td className="p-2">{formatMoney(Number(item.taxAmount), displayCurrency)}</td>
                  <td className="p-2 font-medium">{formatMoney(Number(item.total), displayCurrency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals mr-auto w-72 text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t("subtotal")}</span>
              <span>{formatMoney(displaySubtotal, displayCurrency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{taxLabel}</span>
              <span>{formatMoney(displayTax, displayCurrency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("discount")}</span>
              <span>{formatMoney(displayDiscount, displayCurrency)}</span>
            </div>
            <div
              className="flex justify-between grand font-bold text-base border-t-2 pt-2"
              style={{ borderColor: docColor, color: docColorDark }}
            >
              <span>{t("grandTotal")}</span>
              <span>{formatMoney(displayTotal, displayCurrency)}</span>
            </div>
            {isFx && (
              <div className="flex justify-between text-slate-500 pt-1">
                <span>{t("baseEquivalent")} ({baseCurrency})</span>
                <span>{formatMoney(Number(invoice.total), baseCurrency)}</span>
              </div>
            )}
          </div>

          {invoice.notes && (
            <div className="mt-6 p-3 bg-slate-50 rounded-lg text-sm">
              <strong>{t("notes")}:</strong> {invoice.notes}
            </div>
          )}

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-6 items-end border-t border-slate-200 pt-6">
            <div>
              {signatureMode === "ELECTRONIC" ? (
                <div className="rounded-lg border-2 border-red-600 bg-red-50 px-4 py-3">
                  <p className="font-bold text-sm sm:text-base text-red-700 leading-snug">
                    {t("electronicSignatureNote")}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-xs text-slate-500">
                  <div className="pt-10 border-b border-slate-400 text-center pb-1">
                    {t("signatureAuthorized")}
                  </div>
                  <div className="pt-10 border-b border-slate-400 text-center pb-1">
                    {t("signatureStamp")}
                  </div>
                  {isCustomerDoc && (
                    <div className="col-span-2 pt-10 border-b border-slate-400 text-center pb-1">
                      {t("signatureCustomer")}
                    </div>
                  )}
                </div>
              )}
            </div>
            {qrDataUrl && (
              <div className="flex flex-col items-center sm:items-end gap-1.5 text-center sm:text-right">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={t("verifyQrTitle")}
                  className="w-[200px] h-[200px] border border-slate-200 rounded bg-white p-1.5"
                />
                <p className="text-sm font-bold text-slate-800">{t("verifyQrTitle")}</p>
                <p className="text-xs text-slate-600 max-w-[220px] leading-snug">
                  {t("verifyQrHint")}
                </p>
              </div>
            )}
          </div>

          <div className="footer mt-8 text-center text-xs text-slate-400 border-t pt-4 whitespace-pre-wrap">
            {footerNote || (isReceipt ? t("receiptFooter") : t("printFooter"))}
          </div>
        </div>
      </div>

      {sendOpen && (
        <SendDocumentModal
          invoice={invoice}
          companyName={company?.name}
          variant={variant}
          onClose={() => setSendOpen(false)}
        />
      )}
    </div>
  );
}
