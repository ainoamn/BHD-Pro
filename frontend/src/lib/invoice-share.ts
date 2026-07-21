import { InvoiceDocumentData } from "@/components/invoices/invoice-document";
import { formatPhoneForWhatsApp } from "@/lib/phone";

export function buildInvoiceEmailBody(
  invoice: InvoiceDocumentData,
  companyName?: string
): string {
  const lines = [
    `مرحباً ${invoice.contact.name}،`,
    "",
    `نرفق لكم ${invoice.type === "SALES" ? "فاتورة مبيعات" : "فاتورة مشتريات"} رقم ${invoice.number} من ${companyName || "BHD Pro"}.`,
    "",
    `المبلغ الإجمالي: ${Number(invoice.total).toFixed(3)} ر.ع`,
    `تاريخ الاستحقاق: ${new Date(invoice.dueDate).toLocaleDateString("ar-OM")}`,
    "",
    "شكراً لتعاملكم معنا.",
    companyName || "BHD Pro",
  ];
  return lines.join("\n");
}

export function buildWhatsAppLink(
  phone: string | undefined,
  invoice: InvoiceDocumentData,
  companyName?: string
): string {
  const text = encodeURIComponent(
    `*${companyName || "BHD Pro"}*\n` +
      `فاتورة رقم: ${invoice.number}\n` +
      `المبلغ: ${Number(invoice.total).toFixed(3)} ر.ع\n` +
      `تاريخ الاستحقاق: ${new Date(invoice.dueDate).toLocaleDateString("ar-OM")}\n` +
      `شكراً لتعاملكم معنا.`
  );
  const waPhone = formatPhoneForWhatsApp(phone);
  if (waPhone) {
    return `https://wa.me/${waPhone}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}
