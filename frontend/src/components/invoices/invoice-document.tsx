"use client";

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { X, Printer, Download, Mail, MessageCircle, CheckCircle, Ban, Edit, Send, Receipt } from "lucide-react";
import toast from "react-hot-toast";
import { formatMoney, formatDate } from "@/lib/utils";
import { buildInvoiceEmailBody, buildWhatsAppLink } from "@/lib/invoice-share";
import { formatPhoneForWhatsApp } from "@/lib/phone";

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
  status: string;
  notes?: string;
  contact: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    taxId?: string;
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
}

interface InvoiceDocumentProps {
  invoice: InvoiceDocumentData;
  company?: CompanyInfo | null;
  currency?: string;
  variant?: "invoice" | "receipt";
  onClose: () => void;
  onSendEmail?: () => void;
  onMarkPaid?: () => void;
  onCancel?: () => void;
  onEdit?: () => void;
  onMarkSent?: () => void;
  onViewReceipt?: () => void;
  onViewInvoice?: () => void;
  actionsDisabled?: boolean;
}

export function InvoiceDocument({
  invoice,
  company,
  currency = "OMR",
  variant = "invoice",
  onClose,
  onSendEmail,
  onMarkPaid,
  onCancel,
  onEdit,
  onMarkSent,
  onViewReceipt,
  onViewInvoice,
  actionsDisabled,
}: InvoiceDocumentProps) {
  const t = useTranslations("invoices");
  const tCommon = useTranslations("common");
  const tStatus = useTranslations("status");
  const printRef = useRef<HTMLDivElement>(null);

  const isReceipt = variant === "receipt";
  const docTitle = isReceipt ? t("receiptDoc") : t("invoiceDoc");
  const printTitle = isReceipt ? `${t("receiptDoc")} ${invoice.number}` : invoice.number;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;

    const win = window.open("", "_blank", "width=800,height=900");
    if (!win) return;

    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8" />
        <title>${printTitle}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 32px; color: #111; direction: rtl; }
          .header { display: flex; justify-content: space-between; margin-bottom: 32px; border-bottom: 2px solid #059669; padding-bottom: 16px; }
          .company { font-size: 20px; font-weight: bold; color: #059669; }
          .meta { text-align: left; font-size: 13px; color: #555; }
          .parties { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; }
          .box h3 { font-size: 12px; color: #64748b; margin-bottom: 8px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin: 24px 0; font-size: 13px; }
          th { background: #059669; color: white; padding: 10px; text-align: right; }
          td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
          .totals { margin-right: auto; width: 280px; font-size: 14px; }
          .totals div { display: flex; justify-content: space-between; padding: 6px 0; }
          .grand { font-weight: bold; font-size: 16px; border-top: 2px solid #059669; padding-top: 8px !important; color: #059669; }
          .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
          @media print { body { padding: 16px; } }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => {
      win.print();
      win.close();
    }, 400);
  };

  const handleDownloadPdf = async () => {
    handlePrint();
  };

  const handleWhatsApp = () => {
    if (!formatPhoneForWhatsApp(invoice.contact.phone)) {
      toast.error(t("whatsappNeedPhone"));
      return;
    }
    const link = buildWhatsAppLink(invoice.contact.phone, invoice, company?.name);
    window.open(link, "_blank");
  };

  const handleEmail = () => {
    if (onSendEmail) {
      onSendEmail();
      return;
    }
    const email = invoice.contact.email;
    if (!email) return;
    const subject = encodeURIComponent(`${t("invoiceDoc")} ${invoice.number}`);
    const body = encodeURIComponent(buildInvoiceEmailBody(invoice, company?.name));
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  const isSales = invoice.type === "SALES";
  const showWorkflowActions =
    !isReceipt &&
    (onMarkPaid || onCancel || onEdit || onMarkSent || onViewReceipt);

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
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700 disabled:opacity-40"
              >
                {t("invoiceDoc")}
              </button>
            )}
            {!isReceipt && invoice.status === "PAID" && onViewReceipt && (
              <button
                onClick={onViewReceipt}
                disabled={actionsDisabled}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-40"
              >
                <Receipt className="w-4 h-4" />
                {t("receipt")}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700"
              title={tCommon("print")}
            >
              <Printer className="w-4 h-4" />
              {tCommon("print")}
            </button>
            {!isReceipt && (
              <>
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-800 text-slate-200 rounded-lg hover:bg-slate-700"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </button>
                <button
                  onClick={handleEmail}
                  disabled={(!invoice.contact.email && !onSendEmail) || actionsDisabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40"
                >
                  <Mail className="w-4 h-4" />
                  {t("sendEmail")}
                </button>
                <button
                  onClick={handleWhatsApp}
                  disabled={actionsDisabled}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-500 disabled:opacity-40"
                >
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {showWorkflowActions && (
          <div className="flex flex-wrap gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/80">
            {onEdit && invoice.status !== "PAID" && invoice.status !== "CANCELLED" && (
              <button
                type="button"
                onClick={onEdit}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 disabled:opacity-40"
              >
                <Edit className="w-4 h-4" />
                {tCommon("edit")}
              </button>
            )}
            {onMarkSent && invoice.status === "DRAFT" && (
              <button
                type="button"
                onClick={onMarkSent}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600/30 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
                {t("markSent")}
              </button>
            )}
            {onMarkPaid && ["SENT", "OVERDUE", "VIEWED", "DRAFT"].includes(invoice.status) && (
              <button
                type="button"
                onClick={onMarkPaid}
                disabled={actionsDisabled}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 disabled:opacity-40"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 disabled:opacity-40"
              >
                <Ban className="w-4 h-4" />
                {t("cancelInvoice")}
              </button>
            )}
          </div>
        )}

        <div className="p-6 bg-white text-slate-900 rounded-b-2xl" ref={printRef}>
          {isReceipt && (
            <div className="mb-6 flex items-center justify-between rounded-lg border-2 border-emerald-600 bg-emerald-50 px-4 py-3">
              <div>
                <p className="text-lg font-bold text-emerald-700">{t("receiptDoc")}</p>
                <p className="text-sm text-emerald-600">{t("receiptPaidNote")}</p>
              </div>
              <span className="rounded-full bg-emerald-600 px-4 py-1 text-sm font-bold text-white">
                {tStatus("paid")}
              </span>
            </div>
          )}
          <div className="header flex justify-between items-start mb-8 pb-4 border-b-2 border-emerald-600">
            <div>
              <div className="company text-xl font-bold text-emerald-600">{company?.name || "BHD Pro"}</div>
              {company?.address && <p className="text-sm text-slate-600 mt-1">{company.address}</p>}
              {company?.city && <p className="text-sm text-slate-600">{company.city}</p>}
              {company?.phone && <p className="text-sm text-slate-600">{company.phone}</p>}
              {company?.vatNumber && (
                <p className="text-xs text-slate-500 mt-1">{t("vatNumber")}: {company.vatNumber}</p>
              )}
            </div>
            <div className="meta text-left text-sm text-slate-600">
              <p className="text-lg font-bold text-slate-900">
                {isReceipt
                  ? t("receiptDoc")
                  : isSales
                    ? t("salesInvoice")
                    : t("purchaseInvoice")}
              </p>
              <p className="mt-2"><strong>{t("number")}:</strong> {invoice.number}</p>
              <p><strong>{t("date")}:</strong> {formatDate(invoice.date)}</p>
              {!isReceipt && (
                <p><strong>{t("dueDate")}:</strong> {formatDate(invoice.dueDate)}</p>
              )}
              {isReceipt && (
                <p><strong>{t("amountPaid")}:</strong> {formatMoney(Number(invoice.total), currency)}</p>
              )}
            </div>
          </div>

          <div className="parties grid grid-cols-2 gap-6 mb-6">
            <div className="box bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h3 className="text-xs text-slate-500 uppercase mb-2">{isSales ? t("customer") : t("supplier")}</h3>
              <p className="font-semibold">{invoice.contact.name}</p>
              {invoice.contact.address && <p className="text-sm text-slate-600 mt-1">{invoice.contact.address}</p>}
              {invoice.contact.city && <p className="text-sm text-slate-600">{invoice.contact.city}</p>}
              {invoice.contact.phone && <p className="text-sm text-slate-600">{invoice.contact.phone}</p>}
              {invoice.contact.taxId && (
                <p className="text-xs text-slate-500 mt-1">{t("taxId")}: {invoice.contact.taxId}</p>
              )}
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="bg-emerald-600 text-white">
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
                  <td className="p-2">{formatMoney(Number(item.unitPrice), currency)}</td>
                  <td className="p-2">{formatMoney(Number(item.discount), currency)}</td>
                  <td className="p-2">{formatMoney(Number(item.taxAmount), currency)}</td>
                  <td className="p-2 font-medium">{formatMoney(Number(item.total), currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals mr-auto w-72 text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t("subtotal")}</span>
              <span>{formatMoney(Number(invoice.subtotal), currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("tax")}</span>
              <span>{formatMoney(Number(invoice.taxAmount), currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("discount")}</span>
              <span>{formatMoney(Number(invoice.discount), currency)}</span>
            </div>
            <div className="flex justify-between grand font-bold text-base border-t-2 border-emerald-600 pt-2 text-emerald-700">
              <span>{t("grandTotal")}</span>
              <span>{formatMoney(Number(invoice.total), currency)}</span>
            </div>
          </div>

          {invoice.notes && (
            <div className="mt-6 p-3 bg-slate-50 rounded-lg text-sm">
              <strong>{t("notes")}:</strong> {invoice.notes}
            </div>
          )}

          <div className="footer mt-8 text-center text-xs text-slate-400 border-t pt-4">
            {isReceipt ? t("receiptFooter") : t("printFooter")}
          </div>
        </div>
      </div>
    </div>
  );
}
