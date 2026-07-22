"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X, Mail, MessageCircle, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { InvoiceDocumentData } from "@/components/invoices/invoice-document";
import {
  openInvoiceEmailClient,
  openInvoiceWhatsApp,
  shareDocumentLabel,
} from "@/lib/invoice-share";
import { formatPhoneForWhatsApp } from "@/lib/phone";
import api from "@/lib/api";
import { toAppAbsoluteUrl } from "@/lib/app-url";

interface SendDocumentModalProps {
  invoice: InvoiceDocumentData;
  companyName?: string;
  variant?: "invoice" | "receipt";
  onClose: () => void;
}

export function SendDocumentModal({
  invoice,
  companyName,
  variant = "invoice",
  onClose,
}: SendDocumentModalProps) {
  const t = useTranslations("invoices");
  const docLabel = shareDocumentLabel(invoice.type, variant);
  const [loading, setLoading] = useState<"whatsapp" | "email" | null>(null);

  const waPhone = formatPhoneForWhatsApp(invoice.contact.phone);
  const hasPhone = !!waPhone;

  const createShareUrl = async (): Promise<string> => {
    const res = await api.createDocumentShareLink(invoice.id, variant);
    const data = res.data as { shareUrl: string; sharePath?: string };
    return data.sharePath
      ? toAppAbsoluteUrl(data.sharePath)
      : toAppAbsoluteUrl(data.shareUrl);
  };

  const handleWhatsApp = async () => {
    if (!hasPhone) {
      toast.error(t("whatsappNeedPhone"));
      return;
    }
    setLoading("whatsapp");
    try {
      const shareUrl = await createShareUrl();
      const { opened } = openInvoiceWhatsApp(invoice, companyName, variant, shareUrl);
      if (!opened) {
        toast.error(t("whatsappOpenFailed"));
        return;
      }
      toast.success(t("sendWhatsAppOpened"));
      window.setTimeout(() => onClose(), 200);
    } catch {
      toast.error(t("shareLinkError"));
    } finally {
      setLoading(null);
    }
  };

  const handleEmail = async () => {
    if (!invoice.contact.email?.trim()) {
      toast.error(t("emailNeedAddress"));
      return;
    }
    setLoading("email");
    try {
      const shareUrl = await createShareUrl();
      openInvoiceEmailClient(invoice, companyName, variant, shareUrl);
      toast.success(t("sendEmailOpened"));
      window.setTimeout(() => onClose(), 200);
    } catch {
      toast.error(t("shareLinkError"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <div>
            <h2 className="text-lg font-semibold text-white">{t("sendDocumentTitle")}</h2>
            <p className="text-sm text-slate-400 mt-0.5">
              {docLabel} — {invoice.number}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-400 leading-relaxed">{t("sendDocumentHint")}</p>

          <button
            type="button"
            onClick={handleWhatsApp}
            disabled={!!loading || !hasPhone}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-green-800/50 bg-green-950/30 hover:bg-green-950/50 transition-colors text-right disabled:opacity-50"
          >
            <div className="w-11 h-11 rounded-xl bg-green-600/20 flex items-center justify-center shrink-0">
              {loading === "whatsapp" ? (
                <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
              ) : (
                <MessageCircle className="w-5 h-5 text-green-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{t("sendViaWhatsApp")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t("sendViaWhatsAppHint")}</p>
              {hasPhone ? (
                <p className="text-xs text-green-400/80 mt-1 truncate">
                  {invoice.contact.phone}
                </p>
              ) : (
                <p className="text-xs text-amber-400/80 mt-1">{t("whatsappNeedPhone")}</p>
              )}
            </div>
          </button>

          <button
            type="button"
            onClick={handleEmail}
            disabled={!!loading}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-blue-800/50 bg-blue-950/30 hover:bg-blue-950/50 transition-colors text-right disabled:opacity-50"
          >
            <div className="w-11 h-11 rounded-xl bg-blue-600/20 flex items-center justify-center shrink-0">
              {loading === "email" ? (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              ) : (
                <Mail className="w-5 h-5 text-blue-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-white">{t("sendViaEmail")}</p>
              <p className="text-xs text-slate-400 mt-0.5">{t("sendViaEmailHint")}</p>
              {invoice.contact.email ? (
                <p className="text-xs text-blue-400/80 mt-1 truncate">{invoice.contact.email}</p>
              ) : (
                <p className="text-xs text-amber-400/80 mt-1">{t("emailNeedAddress")}</p>
              )}
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
