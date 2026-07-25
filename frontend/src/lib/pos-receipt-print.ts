/** POS sale receipt: browser print + PDF (company header + product barcodes for returns). */

import { formatMoney } from "@/lib/utils";
import {
  formatCompanyAddressCompact,
  formatCountryLabel,
} from "@/lib/contact-address";
import { renderCode128ToCanvas } from "@/lib/product-label";

export type PosReceiptLine = {
  name: string;
  qty: number;
  lineTotal: number;
  barcode?: string | null;
  sku?: string | null;
};

export type PosReceiptCompany = {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  phone?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  crNumber?: string | null;
  logo?: string | null;
};

export type PosReceiptPrintData = {
  brand: string;
  company: PosReceiptCompany;
  number?: string;
  paymentMethod?: string;
  warehouseLabel?: string;
  total: number;
  currency: string;
  lines: PosReceiptLine[];
  locale?: "ar" | "en";
  labels: {
    vat: string;
    cr: string;
    phone: string;
    email: string;
    warehouse: string;
    payment: string;
    total: string;
    barcode: string;
    printBtn: string;
  };
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toAbsoluteUrl(url: string | null | undefined): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (/^(data:|blob:|https?:)/i.test(raw)) return raw;
  try {
    return new URL(raw, window.location.origin).href;
  } catch {
    return raw;
  }
}

function barcodeDataUrl(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  const canvas = document.createElement("canvas");
  renderCode128ToCanvas(canvas, clean, { height: 36, moduleWidth: 1.5 });
  return canvas.toDataURL("image/png");
}

export function buildPosReceiptHtml(data: PosReceiptPrintData): string {
  const dir = data.locale === "en" ? "ltr" : "rtl";
  const c = data.company || {};
  const address = formatCompanyAddressCompact({
    address: c.address,
    city: c.city,
  });
  const country = formatCountryLabel(c.country);
  const logoSrc = toAbsoluteUrl(c.logo || "/brand/hisaby-mark.png");
  const L = data.labels;

  const metaRows: string[] = [];
  if (c.vatNumber) metaRows.push(`${L.vat}: ${escapeHtml(c.vatNumber)}`);
  if (c.crNumber) metaRows.push(`${L.cr}: ${escapeHtml(c.crNumber)}`);
  if (c.phone) metaRows.push(`${L.phone}: ${escapeHtml(c.phone)}`);
  if (c.email) metaRows.push(`${L.email}: ${escapeHtml(c.email)}`);
  if (address) metaRows.push(escapeHtml(address));
  if (country) metaRows.push(escapeHtml(country));

  const linesHtml = (data.lines || [])
    .map((l) => {
      const code = (l.barcode || l.sku || "").trim();
      const bcImg = code ? barcodeDataUrl(code) : "";
      const bcBlock = bcImg
        ? `<div class="bc"><img src="${bcImg}" alt="${escapeHtml(code)}" /><div class="bc-num">${escapeHtml(code)}</div></div>`
        : "";
      return `<tr>
        <td>
          <div class="item-name">${escapeHtml(l.name)}</div>
          ${bcBlock}
        </td>
        <td class="qty">${l.qty}</td>
        <td class="amt">${escapeHtml(formatMoney(l.lineTotal, data.currency))}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="${data.locale === "en" ? "en" : "ar"}" dir="${dir}">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(data.number || "Receipt")}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0; background: #fff; color: #111;
    font-family: Tahoma, Arial, sans-serif;
    font-size: 12px; line-height: 1.35;
  }
  .sheet { width: 74mm; max-width: 100%; margin: 0 auto; padding: 2mm; }
  .brand-row { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
  .brand-row img { height: 32px; max-width: 72px; object-fit: contain; }
  .company { font-size: 15px; font-weight: 800; margin: 0; }
  .meta { font-size: 10px; color: #333; margin: 2px 0; }
  .sub { font-size: 11px; margin: 3px 0; }
  h1 { font-size: 12px; margin: 0; font-weight: 600; color: #444; }
  hr { border: none; border-top: 1px dashed #999; margin: 8px 0; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td { padding: 5px 0; vertical-align: top; word-wrap: break-word; }
  td.qty { width: 2.2em; text-align: center; }
  td.amt { width: 5.8em; text-align: end; white-space: nowrap; font-size: 11px; }
  .item-name { font-weight: 700; font-size: 12px; }
  .bc { margin-top: 3px; text-align: center; }
  .bc img { max-width: 100%; height: auto; }
  .bc-num { font-size: 9px; font-family: ui-monospace, monospace; color: #222; }
  .total { font-size: 14px; font-weight: 800; }
  .footer { text-align: center; font-size: 10px; color: #555; margin-top: 6px; }
  .no-print { padding: 10px; }
  @media print {
    .no-print { display: none !important; }
    body { background: #fff; }
  }
</style>
</head>
<body>
  <div class="no-print">
    <button type="button" onclick="window.print()" style="padding:8px 16px;font-weight:700;cursor:pointer">${escapeHtml(L.printBtn)}</button>
  </div>
  <div class="sheet" id="receipt-root">
    <div class="brand-row">
      <img src="${escapeHtml(logoSrc)}" alt="" />
      <div>
        <h1>${escapeHtml(data.brand)}</h1>
        <p class="company">${escapeHtml(c.name || "")}</p>
      </div>
    </div>
    ${metaRows.map((r) => `<p class="meta">${r}</p>`).join("")}
    ${data.warehouseLabel ? `<p class="sub">${escapeHtml(L.warehouse)}: ${escapeHtml(data.warehouseLabel)}</p>` : ""}
    <hr/>
    <p class="sub"><strong>${escapeHtml(data.number || "")}</strong></p>
    ${data.paymentMethod ? `<p class="sub">${escapeHtml(L.payment)}: ${escapeHtml(data.paymentMethod)}</p>` : ""}
    <table><tbody>${linesHtml}</tbody></table>
    <hr/>
    <p class="total">${escapeHtml(L.total)}: ${escapeHtml(formatMoney(data.total || 0, data.currency))}</p>
    <hr/>
    <p class="footer">Hisaby POS · ${escapeHtml(L.barcode)}</p>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { try { window.print(); } catch (e) {} }, 250);
    });
  </script>
</body>
</html>`;
}

/** Open receipt in a new tab / print dialog (Blob URL — no blank about:blank). */
export function printPosReceiptBrowser(data: PosReceiptPrintData): void {
  const html = buildPosReceiptHtml(data);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=420,height=720");
  if (!w) {
    URL.revokeObjectURL(url);
    printPosReceiptIframe(html);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function printPosReceiptIframe(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  window.setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => iframe.remove(), 2000);
    }
  }, 400);
}

/** Build a PDF Blob of the receipt (for WhatsApp / download). */
export async function buildPosReceiptPdfBlob(
  data: PosReceiptPrintData,
): Promise<{ blob: Blob; filename: string }> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const html = buildPosReceiptHtml({
    ...data,
    // avoid auto-print script racing canvas capture
    labels: data.labels,
  }).replace(
    /<script>[\s\S]*?<\/script>/i,
    "",
  );

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-12000px;top:0;width:320px;height:900px;border:0;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const idoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!idoc) {
    iframe.remove();
    throw new Error("Unable to create PDF document");
  }

  idoc.open();
  idoc.write(html);
  idoc.close();

  await new Promise((r) => setTimeout(r, 200));
  const root = idoc.getElementById("receipt-root") || idoc.body;
  const canvas = await html2canvas(root as HTMLElement, {
    scale: 2,
    useCORS: true,
    allowTaint: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  // 80mm thermal-ish width in PDF
  const pageWidth = 80;
  const imgWidth = pageWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [pageWidth, Math.max(imgHeight + 4, 40)],
  });
  pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 2, imgWidth, imgHeight);

  const blob = pdf.output("blob");
  iframe.remove();
  const safe = (data.number || "receipt").replace(/[^\w.-]+/g, "_");
  return { blob, filename: `${safe}.pdf` };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
