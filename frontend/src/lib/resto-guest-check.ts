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
  /** When set, print only this seat (null = shared lines only) */
  seat?: number | null;
}) {
  const {
    order,
    company,
    currency = "OMR",
    locale = "ar",
    tipAmount = 0,
    seat,
  } = opts;
  const filtered =
    seat === undefined
      ? order.items.filter((i) => i.status !== "CANCELLED")
      : order.items.filter(
          (i) =>
            i.status !== "CANCELLED" &&
            (seat === null ? i.seat == null : i.seat === seat),
        );
  const lines = filtered.map((i) => ({
    name: i.notes ? `${i.name} (${i.notes})` : i.name,
    qty: i.qty,
    lineTotal: i.lineTotal,
  }));
  const subtotal = filtered
    .filter((i) => !i.isComp)
    .reduce((s, i) => s + i.lineTotal, 0);
  const total = subtotal + (tipAmount || 0);
  const tableLabel = order.table
    ? `${order.table.code}${order.table.name ? ` · ${order.table.name}` : ""}`
    : locale === "en"
      ? "Takeaway"
      : "سفري";
  const seatLabel =
    seat === undefined
      ? ""
      : seat === null
        ? locale === "en"
          ? " · Shared"
          : " · مشترك"
        : locale === "en"
          ? ` · Seat ${seat}`
          : ` · مقعد ${seat}`;

  printPosReceiptBrowser({
    brand: "Hisaby Resto",
    company: company || { name: "Hisaby" },
    number: order.number,
    paymentMethod:
      opts.paymentLabel || (locale === "en" ? "Guest check" : "فاتورة ضيف"),
    warehouseLabel: `${tableLabel}${seatLabel} · ${order.guests} ${
      locale === "en" ? "guests" : "ضيوف"
    }`,
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
