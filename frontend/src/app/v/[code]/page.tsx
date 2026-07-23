"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, ShieldCheck } from "lucide-react";
import axios from "axios";
import { InvoiceDocument, InvoiceDocumentData } from "@/components/invoices/invoice-document";

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

/** Short scannable authenticity URL: /v/CODE — opens the invoice immediately */
export default function VerifyDocumentPage({ params }: { params: { code: string } }) {
  const t = useTranslations("invoices");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<ReturnType<typeof mapPublicDocument> | null>(null);
  const verifyUrl =
    typeof window !== "undefined" ? `${window.location.origin}/v/${params.code}` : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/public/documents/c/${encodeURIComponent(params.code)}`);
        if (cancelled) return;
        setDoc(mapPublicDocument(res.data as Record<string, unknown>));
      } catch {
        if (!cancelled) setError(t("shareLinkInvalid"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.code, t]);

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

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-3xl mx-auto px-4 pt-6">
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200 mb-4">
          <ShieldCheck className="w-6 h-6 shrink-0" />
          <p className="text-sm font-medium">{t("documentVerifiedBanner")}</p>
        </div>
      </div>
      <InvoiceDocument
        invoice={doc.invoice}
        company={doc.company}
        currency={(doc.invoice.currency || (doc.company.currency as string)) || "OMR"}
        baseCurrency={(doc.company.currency as string) || "OMR"}
        variant={doc.variant}
        headerNote={doc.headerNote}
        footerNote={doc.footerNote}
        verifyUrl={verifyUrl}
        onClose={() => {
          if (typeof window !== "undefined") window.history.back();
        }}
      />
    </div>
  );
}
