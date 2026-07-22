import { InvoiceDocumentData } from "@/components/invoices/invoice-document";
import { formatPhoneForWhatsApp } from "@/lib/phone";
import { isMobileDevice, openExternalUrl } from "@/lib/open-external-url";
import { formatDate, getCurrencySymbol, CURRENCY_SYMBOLS } from "@/lib/utils";

export function shareDocumentLabel(type: string, variant: "invoice" | "receipt" = "invoice"): string {
  if (variant === "receipt") return "إيصال سداد";
  if (type === "QUOTATION") return "عرض سعر";
  if (type === "CREDIT_NOTE") return "إشعار دائن";
  if (type === "SALES") return "فاتورة مبيعات";
  if (type === "PURCHASE") return "فاتورة مشتريات";
  if (type === "DEBIT_NOTE") return "إشعار مدين";
  return "مستند";
}

function formatShareAmount(invoice: InvoiceDocumentData): string {
  const code = (invoice.currency || "OMR").toUpperCase();
  const meta = CURRENCY_SYMBOLS[code] || { ar: code, en: code, decimals: 3 };
  const total =
    invoice.foreignTotal && invoice.currency
      ? Number(invoice.foreignTotal)
      : Number(invoice.total);
  const formatted = new Intl.NumberFormat("en-OM", {
    minimumFractionDigits: meta.decimals,
    maximumFractionDigits: meta.decimals,
  }).format(total);
  return `${formatted} ${getCurrencySymbol(code, "ar")}`;
}

function formatShareDate(date: string): string {
  return new Intl.DateTimeFormat("ar-OM", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    numberingSystem: "latn",
  }).format(new Date(date));
}

function appendShareLink(lines: string[], shareUrl?: string): string[] {
  if (!shareUrl) return lines;
  return [
    ...lines,
    "",
    "📄 عرض وتحميل المستند (PDF):",
    shareUrl,
  ];
}

export function buildInvoiceEmailBody(
  invoice: InvoiceDocumentData,
  companyName?: string,
  variant: "invoice" | "receipt" = "invoice",
  shareUrl?: string
): string {
  const docLabel = shareDocumentLabel(invoice.type, variant);
  const lines = appendShareLink(
    [
      `مرحباً ${invoice.contact.name}،`,
      "",
      `نرفق لكم ${docLabel} رقم ${invoice.number} من ${companyName || "BHD Pro"}.`,
      "",
      `المبلغ الإجمالي: ${formatShareAmount(invoice)}`,
      ...(variant !== "receipt"
        ? [`تاريخ الاستحقاق: ${formatShareDate(invoice.dueDate)}`]
        : []),
    ],
    shareUrl
  );
  lines.push("", "شكراً لتعاملكم معنا.", companyName || "BHD Pro");
  return lines.join("\n");
}

export function buildWhatsAppMessage(
  invoice: InvoiceDocumentData,
  companyName?: string,
  variant: "invoice" | "receipt" = "invoice",
  shareUrl?: string
): string {
  const docLabel = shareDocumentLabel(invoice.type, variant);
  const lines = appendShareLink(
    [
      `*${companyName || "BHD Pro"}*`,
      `${docLabel} رقم: ${invoice.number}`,
      `المبلغ: ${formatShareAmount(invoice)}`,
      ...(variant !== "receipt"
        ? [`تاريخ الاستحقاق: ${formatShareDate(invoice.dueDate)}`]
        : []),
    ],
    shareUrl
  );
  lines.push("شكراً لتعاملكم معنا.");
  return lines.join("\n");
}

export function buildWhatsAppShareUrl(
  phone: string | undefined,
  message: string
): { url: string; hasPhone: boolean } {
  const encoded = encodeURIComponent(message);
  const waPhone = formatPhoneForWhatsApp(phone);
  const mobile = isMobileDevice();

  if (waPhone) {
    const url = mobile
      ? `https://wa.me/${waPhone}?text=${encoded}`
      : `https://web.whatsapp.com/send?phone=${waPhone}&text=${encoded}`;
    return { url, hasPhone: true };
  }

  const url = mobile
    ? `https://wa.me/?text=${encoded}`
    : `https://web.whatsapp.com/send?text=${encoded}`;
  return { url, hasPhone: false };
}

export function openInvoiceWhatsApp(
  invoice: InvoiceDocumentData,
  companyName?: string,
  variant: "invoice" | "receipt" = "invoice",
  shareUrl?: string
): { opened: boolean; hasPhone: boolean } {
  const message = buildWhatsAppMessage(invoice, companyName, variant, shareUrl);
  const { url, hasPhone } = buildWhatsAppShareUrl(invoice.contact.phone, message);
  const opened = openExternalUrl(url);
  return { opened, hasPhone };
}

export function openInvoiceEmailClient(
  invoice: InvoiceDocumentData,
  companyName?: string,
  variant: "invoice" | "receipt" = "invoice",
  shareUrl?: string
): void {
  const email = invoice.contact.email?.trim();
  if (!email) return;
  const docLabel = shareDocumentLabel(invoice.type, variant);
  const subject = encodeURIComponent(`${docLabel} ${invoice.number}`);
  const body = encodeURIComponent(
    buildInvoiceEmailBody(invoice, companyName, variant, shareUrl)
  );
  openExternalUrl(`mailto:${email}?subject=${subject}&body=${body}`);
}

export function getAppOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
}
