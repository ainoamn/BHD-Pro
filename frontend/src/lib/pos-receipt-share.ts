import { openExternalUrl } from "@/lib/open-external-url";
import { formatMoney } from "@/lib/utils";

export type PosReceiptShareData = {
  companyName?: string;
  number?: string;
  warehouseLabel?: string;
  paymentMethod?: string;
  total?: number;
  currency?: string;
  lines?: { name: string; qty: number; lineTotal: number }[];
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
};

export function buildPosReceiptPlainText(receipt: PosReceiptShareData): string {
  const currency = receipt.currency || "OMR";
  const lines = [
    receipt.companyName || "Hisaby POS",
    receipt.number ? `# ${receipt.number}` : "",
    receipt.warehouseLabel ? `Warehouse: ${receipt.warehouseLabel}` : "",
    receipt.paymentMethod ? `Payment: ${receipt.paymentMethod}` : "",
    "",
    ...(receipt.lines || []).map(
      (l) => `${l.name} × ${l.qty} = ${formatMoney(l.lineTotal, currency)}`,
    ),
    "",
    `Total: ${formatMoney(receipt.total || 0, currency)}`,
  ].filter((line, i, arr) => !(line === "" && arr[i - 1] === ""));
  return lines.join("\n");
}

export function openPosReceiptWhatsApp(receipt: PosReceiptShareData): boolean {
  const text = buildPosReceiptPlainText(receipt);
  const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
  return openExternalUrl(url);
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
