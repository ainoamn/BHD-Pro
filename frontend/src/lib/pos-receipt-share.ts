import { openExternalUrl } from "@/lib/open-external-url";
import { formatMoney } from "@/lib/utils";
import {
  buildPosReceiptPdfBlob,
  downloadBlob,
  type PosReceiptPrintData,
} from "@/lib/pos-receipt-print";
import { buildContactWhatsAppLink } from "@/lib/phone";

export type PosReceiptShareData = {
  companyName?: string;
  number?: string;
  warehouseLabel?: string;
  paymentMethod?: string;
  total?: number;
  currency?: string;
  lines?: { name: string; qty: number; lineTotal: number; barcode?: string | null }[];
  customerPhone?: string | null;
  /** Public / share URL to include in the WhatsApp message */
  viewUrl?: string | null;
};

export type PosShiftReportShareData = {
  kind: "X" | "Z";
  companyName?: string;
  currency?: string;
  openingCash?: number;
  salesTotal?: number;
  salesCount?: number;
  cashSales?: number;
  cardSales?: number;
  cashIn?: number;
  cashOut?: number;
  refundTotal?: number;
  voidedTotal?: number;
  expectedCash?: number;
  closingCash?: number | null;
  variance?: number | null;
  varianceStatus?: string | null;
  tipsTotal?: number | null;
};

export function buildPosReceiptPlainText(receipt: PosReceiptShareData): string {
  const currency = receipt.currency || "OMR";
  const lines = [
    receipt.companyName || "Hisaby POS",
    receipt.number ? `# ${receipt.number}` : "",
    receipt.warehouseLabel ? `Warehouse: ${receipt.warehouseLabel}` : "",
    receipt.paymentMethod ? `Payment: ${receipt.paymentMethod}` : "",
    "",
    ...(receipt.lines || []).map((l) => {
      const bc = (l.barcode || "").trim();
      return `${l.name} × ${l.qty} = ${formatMoney(l.lineTotal, currency)}${bc ? ` [${bc}]` : ""}`;
    }),
    "",
    `Total: ${formatMoney(receipt.total || 0, currency)}`,
    receipt.viewUrl ? `\nView / PDF: ${receipt.viewUrl}` : "",
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));
  return lines.join("\n");
}

/** Open WhatsApp with receipt text (no PDF). */
export function openPosReceiptWhatsApp(receipt: PosReceiptShareData): boolean {
  const text = buildPosReceiptPlainText(receipt);
  const url = receipt.customerPhone
    ? buildContactWhatsAppLink(receipt.customerPhone, "", text)
    : `https://wa.me/?text=${encodeURIComponent(text)}`;
  return openExternalUrl(url);
}

/**
 * Generate PDF, try native share (mobile → WhatsApp with attachment),
 * always download PDF, then open WhatsApp with caption + optional view link.
 */
export async function sharePosReceiptWhatsAppWithPdf(opts: {
  share: PosReceiptShareData;
  printData: PosReceiptPrintData;
  /** Hint shown in toast when PDF was downloaded for manual attach */
  attachHintAr?: string;
  attachHintEn?: string;
  locale?: "ar" | "en";
}): Promise<{ sharedNative: boolean; downloaded: boolean; openedWa: boolean }> {
  const { blob, filename } = await buildPosReceiptPdfBlob(opts.printData);
  const file = new File([blob], filename, { type: "application/pdf" });

  let sharedNative = false;
  try {
    const nav = navigator as Navigator & {
      canShare?: (data: ShareData) => boolean;
      share?: (data: ShareData) => Promise<void>;
    };
    const data: ShareData = {
      files: [file],
      title: opts.share.number || "Receipt",
      text: buildPosReceiptPlainText(opts.share),
    };
    if (nav.share && (!nav.canShare || nav.canShare(data))) {
      await nav.share(data);
      sharedNative = true;
    }
  } catch {
    /* user cancelled or unsupported */
  }

  downloadBlob(blob, filename);

  let openedWa = false;
  if (!sharedNative) {
    const hint =
      opts.locale === "en"
        ? opts.attachHintEn ||
          "PDF downloaded — attach the file in WhatsApp."
        : opts.attachHintAr ||
          "تم تنزيل ملف PDF — أرفقه في واتساب.";
    const text = `${buildPosReceiptPlainText(opts.share)}\n\n${hint}`;
    const url = opts.share.customerPhone
      ? buildContactWhatsAppLink(opts.share.customerPhone, "", text)
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    openedWa = openExternalUrl(url);
  }

  return { sharedNative, downloaded: true, openedWa: sharedNative ? true : openedWa };
}

export function openPosReceiptEmail(receipt: PosReceiptShareData): void {
  const text = buildPosReceiptPlainText(receipt);
  const subject = encodeURIComponent(
    `Receipt ${receipt.number || ""}`.trim() || "POS Receipt",
  );
  const body = encodeURIComponent(text);
  openExternalUrl(`mailto:?subject=${subject}&body=${body}`);
}

export function buildPosShiftReportPlainText(report: PosShiftReportShareData): string {
  const currency = report.currency || "OMR";
  const title = report.kind === "X" ? "X-Report" : "Z-Report";
  const money = (n?: number | null) =>
    n == null || Number.isNaN(Number(n)) ? "—" : formatMoney(Number(n), currency);
  const lines = [
    `${title} · ${report.companyName || "Hisaby POS"}`,
    new Date().toLocaleString(),
    "",
    `Opening: ${money(report.openingCash)}`,
    `Sales: ${money(report.salesTotal)} (${report.salesCount ?? 0})`,
    `Cash sales: ${money(report.cashSales)}`,
    `Card sales: ${money(report.cardSales)}`,
    `Cash in: ${money(report.cashIn)}`,
    `Cash out: ${money(report.cashOut)}`,
    `Refunds: ${money(report.refundTotal)}`,
    `Voids: ${money(report.voidedTotal)}`,
    `Tips: ${money(report.tipsTotal)}`,
    `Expected cash: ${money(report.expectedCash)}`,
  ];
  if (report.kind === "Z") {
    lines.push(`Closing cash: ${money(report.closingCash)}`);
    lines.push(`Variance: ${money(report.variance)}`);
    if (report.varianceStatus) {
      lines.push(`Variance status: ${report.varianceStatus}`);
    }
  }
  return lines.join("\n");
}

export function openPosShiftReportWhatsApp(report: PosShiftReportShareData): boolean {
  const text = buildPosShiftReportPlainText(report);
  return openExternalUrl(`https://wa.me/?text=${encodeURIComponent(text)}`);
}

export function openPosShiftReportEmail(report: PosShiftReportShareData): void {
  const text = buildPosShiftReportPlainText(report);
  const title = report.kind === "X" ? "X-Report" : "Z-Report";
  const subject = encodeURIComponent(`${title} · ${report.companyName || "Hisaby POS"}`);
  openExternalUrl(`mailto:?subject=${subject}&body=${encodeURIComponent(text)}`);
}
