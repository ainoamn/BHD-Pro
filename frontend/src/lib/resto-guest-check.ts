/** Guest check / pre-pay print for Hisaby Restaurants — reuses POS receipt browser print. */

import {
  printPosReceiptBrowser,
  type PosReceiptCompany,
} from "@/lib/pos-receipt-print";
import type { RestoOrderPayload } from "@/lib/api";

export function printRestoGuestCheck(opts: {
  order: RestoOrderPayload;
  company?: PosReceiptCompany | null;
  currency?: string;
  locale?: "ar" | "en";
  tipAmount?: number;
  paymentLabel?: string;
}) {
  const { order, company, currency = "OMR", locale = "ar", tipAmount = 0 } = opts;
  const lines = order.items
    .filter((i) => i.status !== "CANCELLED")
    .map((i) => ({
      name: i.notes ? `${i.name} (${i.notes})` : i.name,
      qty: i.qty,
      lineTotal: i.lineTotal,
    }));
  const subtotal = order.subtotal;
  const total = subtotal + (tipAmount || 0);
  const tableLabel = order.table
    ? `${order.table.code}${order.table.name ? ` · ${order.table.name}` : ""}`
    : locale === "en"
      ? "Takeaway"
      : "سفري";

  printPosReceiptBrowser({
    brand: "Hisaby Resto",
    company: company || { name: "Hisaby" },
    number: order.number,
    paymentMethod: opts.paymentLabel || (locale === "en" ? "Guest check" : "فاتورة ضيف"),
    warehouseLabel: `${tableLabel} · ${order.guests} ${locale === "en" ? "guests" : "ضيوف"}`,
    total,
    currency,
    lines,
    locale,
    labels: {
      vat: locale === "en" ? "VAT" : "ضريبة",
      cr: locale === "en" ? "CR" : "س.ت",
      phone: locale === "en" ? "Phone" : "هاتف",
      email: locale === "en" ? "Email" : "بريد",
      warehouse: locale === "en" ? "Table" : "طاولة",
      payment: locale === "en" ? "Type" : "النوع",
      total:
        tipAmount > 0
          ? locale === "en"
            ? `Total (incl. tip ${tipAmount.toFixed(3)})`
            : `الإجمالي (شامل بقشيش ${tipAmount.toFixed(3)})`
          : locale === "en"
            ? "Total"
            : "الإجمالي",
      barcode: locale === "en" ? "Code" : "رمز",
      printBtn: locale === "en" ? "Print" : "طباعة",
    },
  });
}
