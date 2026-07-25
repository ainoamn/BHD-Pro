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
