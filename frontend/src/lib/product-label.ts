/** Product shelf label: CODE128 barcode (hardware scanners + phone camera) + company brand. */

export type ProductLabelData = {
  name: string;
  sku: string;
  barcode: string;
  salePrice?: number;
  currency?: string;
  companyName?: string;
  vatNumber?: string;
  phone?: string;
  logoUrl?: string | null;
};

/** EAN-13 check digit for 12-digit body. */
export function ean13CheckDigit(digits12: string): string {
  const d = digits12.replace(/\D/g, "").padStart(12, "0").slice(0, 12);
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += Number(d[i]) * (i % 2 === 0 ? 1 : 3);
  }
  return String((10 - (sum % 10)) % 10);
}

export function buildEan13(digits12: string): string {
  const body = digits12.replace(/\D/g, "").padStart(12, "0").slice(0, 12);
  return body + ean13CheckDigit(body);
}

/**
 * Minimal CODE128-B encoder → array of bar widths (module units).
 * Compatible with retail scanners and phone BarcodeDetector / ZXing.
 */
function code128Patterns(text: string): number[] {
  const START_B = 104;
  const STOP = 106;
  const codes: number[] = [START_B];
  let checksum = START_B;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 32 || c > 127) continue;
    const val = c - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(STOP);

  // Code 128 patterns (bar/space widths) indexed 0–106
  const PAT: string[] = [
    "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
    "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
    "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
    "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
    "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
    "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
    "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
    "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
    "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
    "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
    "114131","311141","411131","211412","211214","211232","2331112",
  ];

  const widths: number[] = [];
  for (const code of codes) {
    const pat = PAT[code] || PAT[0];
    for (const ch of pat) widths.push(Number(ch));
  }
  return widths;
}

export function renderCode128ToCanvas(
  canvas: HTMLCanvasElement,
  value: string,
  opts?: { height?: number; moduleWidth?: number },
): void {
  const clean = String(value || "").trim();
  if (!clean) return;
  const moduleWidth = opts?.moduleWidth ?? 2;
  const height = opts?.height ?? 56;
  const widths = code128Patterns(clean);
  const totalModules = widths.reduce((a, b) => a + b, 0);
  const w = totalModules * moduleWidth;
  canvas.width = w;
  canvas.height = height + 18;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#000000";
  let x = 0;
  let bar = true;
  for (const mw of widths) {
    const px = mw * moduleWidth;
    if (bar) ctx.fillRect(x, 0, px, height);
    x += px;
    bar = !bar;
  }
  ctx.font = "12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(clean, w / 2, height + 14);
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

export function printProductLabel(data: ProductLabelData): void {
  const barcode = (data.barcode || data.sku || "").trim();
  if (!barcode) return;

  const canvas = document.createElement("canvas");
  renderCode128ToCanvas(canvas, barcode, { height: 52, moduleWidth: 2 });
  const barcodeDataUrl = canvas.toDataURL("image/png");

  const price =
    data.salePrice != null && Number.isFinite(data.salePrice)
      ? `${Number(data.salePrice).toFixed(3)} ${data.currency || "OMR"}`
      : "";

  const logoSrc = toAbsoluteUrl(data.logoUrl);
  const logo = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="" style="height:36px;max-width:120px;object-fit:contain" />`
    : "";

  const companyBits = [data.companyName, data.vatNumber ? `VAT ${data.vatNumber}` : "", data.phone]
    .filter(Boolean)
    .map((s) => escapeHtml(String(s)))
    .join(" · ");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8"/>
<title>${escapeHtml(data.name)} — label</title>
<style>
  @page { size: 60mm 40mm; margin: 2mm; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #fff; font-family: Tahoma, Arial, sans-serif; color: #111; }
  .label {
    width: 56mm; min-height: 36mm; padding: 2mm;
    border: 0.3mm solid #ddd; display: flex; flex-direction: column; gap: 1.5mm;
  }
  .brand { display: flex; align-items: center; gap: 2mm; }
  .brand-meta { font-size: 8px; line-height: 1.25; color: #333; }
  .name { font-size: 11px; font-weight: 700; line-height: 1.2; }
  .meta { font-size: 9px; color: #222; font-family: monospace; }
  .price { font-size: 12px; font-weight: 700; }
  .bc { text-align: center; }
  .bc img { max-width: 100%; height: auto; }
  @media print {
    body { background: #fff; }
    .label { border: none; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="no-print" style="padding:12px;font-family:sans-serif">
    <button type="button" onclick="window.print()" style="padding:8px 16px;font-weight:700;cursor:pointer">طباعة الملصق / Print</button>
  </div>
  <div class="label">
    <div class="brand">
      ${logo}
      <div class="brand-meta">${companyBits}</div>
    </div>
    <div class="name">${escapeHtml(data.name)}</div>
    <div class="meta">SKU: ${escapeHtml(data.sku)}</div>
    ${price ? `<div class="price">${escapeHtml(price)}</div>` : ""}
    <div class="bc"><img src="${barcodeDataUrl}" alt="${escapeHtml(barcode)}" /></div>
  </div>
  <script>
    window.addEventListener("load", function () {
      setTimeout(function () { window.print(); }, 200);
    });
  </script>
</body>
</html>`;

  // Blob URL avoids Chrome's noopener quirk: window.open(..., "noopener") returns null
  // and leaves a blank about:blank tab that we cannot write into.
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "width=480,height=640");
  if (!w) {
    URL.revokeObjectURL(url);
    // Fallback: same-tab print iframe if popups are blocked
    printViaHiddenIframe(html);
    return;
  }
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function printViaHiddenIframe(html: string): void {
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
  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1500);
  };
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      cleanup();
    }
  };
  window.setTimeout(cleanup, 8000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
