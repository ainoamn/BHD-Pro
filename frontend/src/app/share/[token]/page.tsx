"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Loader2, Printer, ShieldCheck } from "lucide-react";
import axios from "axios";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoices/invoice-document";
import { openInvoicePrintDialog } from "@/lib/invoice-print";
import { buildDocumentQrDataUrl } from "@/lib/document-qr";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" ? "/backend-api" : "http://localhost:3001/api");

function mapPublicDocument(payload: Record<string, unknown>): {
  invoice: InvoiceDocumentData;
  company: Record<string, unknown>;
  variant: "invoice" | "receipt";
  purpose?: string;
  headerNote?: string | null;
  footerNote?: string | null;
} {
  const invoice = payload.invoice as Record<string, unknown>;
  const company = payload.company as Record<string, unknown>;
  const template = payload.template as { headerText?: string; footerText?: string } | null;
  const items = (invoice.items as Record<string, unknown>[]) || [];

  return {
    variant: (payload.variant as "invoice" | "receipt") || "invoice",
    purpose: payload.purpose as string | undefined,
    company,
    headerNote: template?.headerText,
    footerNote: template?.footerText,
    invoice: {
      id: invoice.id as string,
      number: invoice.number as string,
      type: invoice.type as string,
      date: invoice.date as string,
      dueDate: invoice.dueDate as string,
      subtotal: Number(invoice.subtotal),
      discount: Number(invoice.discount),
      taxRate: Number(invoice.taxRate),
      taxAmount: Number(invoice.taxAmount),
      total: Number(invoice.total),
      currency: invoice.currency as string | undefined,
      exchangeRate: invoice.exchangeRate != null ? Number(invoice.exchangeRate) : undefined,
      foreignTotal: invoice.foreignTotal != null ? Number(invoice.foreignTotal) : null,
      status: invoice.status as string,
      paidAmount: Number(invoice.paidAmount || 0),
      paymentStatus: invoice.paymentStatus as string | undefined,
      notes: invoice.notes as string | undefined,
      contact: invoice.contact as InvoiceDocumentData["contact"],
      items: items.map((i) => ({
        description: i.description as string,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        discount: Number(i.discount),
        taxAmount: Number(i.taxAmount),
        total: Number(i.total),
      })),
    },
  };
}

export default function ShareDocumentPage({ params }: { params: { token: string } }) {
  const t = useTranslations("invoices");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<ReturnType<typeof mapPublicDocument> | null>(null);
  const [showDocument, setShowDocument] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const verifyUrl =
    typeof window !== "undefined" ? `${window.location.origin}/share/${params.token}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/public/documents/${params.token}`);
        if (cancelled) return;
        const mapped = mapPublicDocument(res.data as Record<string, unknown>);
        setDoc(mapped);
        // Auto-open document when arriving via authenticity QR scan
        if (mapped.purpose === "doc_verify") {
          setShowDocument(true);
        }
      } catch {
        if (!cancelled) setError(t("shareLinkInvalid"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.token, t]);

  useEffect(() => {
    if (!verifyUrl) return;
    let cancelled = false;
    buildDocumentQrDataUrl(verifyUrl)
      .then((url) => {
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [verifyUrl]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
        <p className="text-slate-300 text-center">{error || t("shareLinkInvalid")}</p>
      </div>
    );
  }

  const printLabels = {
    docTitle: t("invoiceDoc"),
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
    paid: t("paid"),
    currency: t("currency"),
    exchangeRate: t("exchangeRate"),
    baseEquivalent: t("baseEquivalent"),
    vatNumber: t("vatNumber"),
    taxId: t("taxId"),
    printFooter: t("printFooter"),
    receiptFooter: t("receiptFooter"),
    electronicSignatureNote: t("electronicSignatureNote"),
    signatureAuthorized: t("signatureAuthorized"),
    signatureStamp: t("signatureStamp"),
    signatureCustomer: t("signatureCustomer"),
    verifyQrTitle: t("verifyQrTitle"),
    verifyQrHint: t("verifyQrHint"),
  };

  const signatureMode =
    doc.company.signatureMode === "ELECTRONIC" ? "ELECTRONIC" : "MANUAL";
  const documentColor =
    typeof doc.company.documentColor === "string"
      ? doc.company.documentColor
      : undefined;

  const handleDownload = () => {
    openInvoicePrintDialog(doc.invoice, doc.company, {
      variant: doc.variant,
      baseCurrency: (doc.company.currency as string) || "OMR",
      headerNote: doc.headerNote,
      footerNote: doc.footerNote,
      signatureMode,
      qrDataUrl,
      documentColor,
      labels: printLabels,
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {doc.purpose === "doc_verify" && (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200">
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <p className="text-sm font-medium">{t("documentVerifiedBanner")}</p>
          </div>
        )}

        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold">{t("sharePageTitle")}</h1>
          <p className="text-slate-400 text-sm">
            {doc.invoice.number} — {doc.invoice.contact?.name}
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <button
            type="button"
            onClick={() => setShowDocument(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
          >
            <Printer className="w-4 h-4" />
            {t("view")}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            {t("downloadPdf")}
          </button>
        </div>

        <p className="text-center text-xs text-slate-500">{t("sharePageHint")}</p>
      </div>

      {showDocument && (
        <InvoiceDocument
          invoice={doc.invoice}
          company={doc.company}
          currency={(doc.invoice.currency || (doc.company.currency as string)) || "OMR"}
          baseCurrency={(doc.company.currency as string) || "OMR"}
          variant={doc.variant}
          headerNote={doc.headerNote}
          footerNote={doc.footerNote}
          verifyUrl={verifyUrl}
          onClose={() => setShowDocument(false)}
        />
      )}
    </div>
  );
}
