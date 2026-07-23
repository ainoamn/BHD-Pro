import { InvoiceDocumentData } from "@/components/invoices/invoice-document";
import { formatDate, formatMoney } from "@/lib/utils";
import { formatContactAddressLines, formatCompanyAddressCompact } from "@/lib/contact-address";
import {
  documentColorDark,
  documentColorSoft,
  normalizeDocumentColor,
} from "@/lib/document-theme";
import { buildWorkflowStepsHtml } from "@/lib/document-workflow";

interface CompanyInfo {
  name?: string;
  address?: string;
  city?: string;
  phone?: string;
  vatNumber?: string;
  crNumber?: string;
  logo?: string | null;
  signatureMode?: "ELECTRONIC" | "MANUAL";
  documentColor?: string | null;
}

interface PrintOptions {
  variant?: "invoice" | "receipt";
  baseCurrency?: string;
  headerNote?: string | null;
  footerNote?: string | null;
  signatureMode?: "ELECTRONIC" | "MANUAL";
  qrDataUrl?: string | null;
  documentColor?: string | null;
  labels?: {
    docTitle: string;
    number: string;
    date: string;
    dueDate: string;
    customer: string;
    supplier: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discount: string;
    tax: string;
    lineTotal: string;
    subtotal: string;
    grandTotal: string;
    notes: string;
    amountPaid?: string;
    receiptDoc?: string;
    receiptPaidNote?: string;
    paid?: string;
    currency?: string;
    exchangeRate?: string;
    baseEquivalent?: string;
    vatNumber?: string;
    taxId?: string;
    crNumber?: string;
    printFooter?: string;
    receiptFooter?: string;
    electronicSignatureNote?: string;
    signatureAuthorized?: string;
    signatureStamp?: string;
    signatureCustomer?: string;
    verifyQrTitle?: string;
    verifyQrHint?: string;
    workflowDraft?: string;
    workflowIssued?: string;
    workflowClaim?: string;
    workflowReceipt?: string;
    workflowQuoteDraft?: string;
    workflowQuoteSent?: string;
    workflowQuoteInvoice?: string;
  };
}

function resolveDocColor(
  options: PrintOptions,
  company: CompanyInfo | null | undefined
): string {
  return normalizeDocumentColor(options.documentColor || company?.documentColor);
}

function buildSignatureAndQrHtml(
  options: PrintOptions,
  isCustomerDoc: boolean,
  _docColor: string
): string {
  const L = options.labels!;
  const mode = options.signatureMode === "ELECTRONIC" ? "ELECTRONIC" : "MANUAL";

  const signatureHtml =
    mode === "ELECTRONIC"
      ? `<div style="border:2px solid #dc2626;background:#fef2f2;border-radius:8px;padding:12px 16px;">
          <p style="margin:0;font-size:14px;font-weight:700;color:#b91c1c;line-height:1.45;">${L.electronicSignatureNote || ""}</p>
        </div>`
      : `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:11px;color:#64748b;">
          <div style="padding-top:40px;border-bottom:1px solid #94a3b8;text-align:center;padding-bottom:4px;">${L.signatureAuthorized || ""}</div>
          <div style="padding-top:40px;border-bottom:1px solid #94a3b8;text-align:center;padding-bottom:4px;">${L.signatureStamp || ""}</div>
          ${
            isCustomerDoc
              ? `<div style="grid-column:1 / -1;padding-top:40px;border-bottom:1px solid #94a3b8;text-align:center;padding-bottom:4px;">${L.signatureCustomer || ""}</div>`
              : ""
          }
        </div>`;

  const qrHtml = options.qrDataUrl
    ? `<div style="text-align:center;">
        <img src="${options.qrDataUrl}" alt="" style="width:200px;height:200px;border:1px solid #e2e8f0;border-radius:4px;padding:6px;background:#fff;" />
        <p style="font-size:12px;font-weight:700;color:#1e293b;margin-top:6px;">${L.verifyQrTitle || ""}</p>
        <p style="font-size:10px;color:#475569;max-width:200px;margin:4px auto 0;line-height:1.35;">${L.verifyQrHint || ""}</p>
      </div>`
    : "";

  return `
    <div style="margin-top:32px;display:grid;grid-template-columns:1fr auto;gap:24px;align-items:end;border-top:1px solid #e2e8f0;padding-top:24px;">
      <div>${signatureHtml}</div>
      ${qrHtml}
    </div>
  `;
}

function buildBodyHtml(
  invoice: InvoiceDocumentData,
  company: CompanyInfo | null | undefined,
  options: PrintOptions
): string {
  const {
    variant = "invoice",
    baseCurrency = "OMR",
    headerNote,
    footerNote,
    labels,
  } = options;
  const L = labels!;
  const isReceipt = variant === "receipt";
  const isSales = ["SALES", "QUOTATION", "CREDIT_NOTE"].includes(invoice.type);
  const docCurrency = (invoice.currency || baseCurrency).toUpperCase();
  const rate = Number(invoice.exchangeRate || 1) || 1;
  const isFx =
    !!invoice.foreignTotal &&
    docCurrency !== baseCurrency.toUpperCase() &&
    rate !== 1;
  const displayCurrency = isFx ? docCurrency : baseCurrency;
  const displaySubtotal = isFx
    ? invoice.items.reduce(
        (s, i) => s + Number(i.quantity) * Number(i.unitPrice) - Number(i.discount),
        0
      )
    : Number(invoice.subtotal);
  const displayTax = isFx
    ? invoice.items.reduce((s, i) => s + Number(i.taxAmount), 0)
    : Number(invoice.taxAmount);
  const displayDiscount = isFx
    ? Number((Number(invoice.discount) / rate).toFixed(3))
    : Number(invoice.discount);
  const displayTotal = isFx ? Number(invoice.foreignTotal) : Number(invoice.total);

  const itemsHtml = invoice.items
    .map(
      (item) => `
      <tr>
        <td>${item.description}</td>
        <td>${Number(item.quantity)}</td>
        <td>${formatMoney(Number(item.unitPrice), displayCurrency)}</td>
        <td>${formatMoney(Number(item.discount), displayCurrency)}</td>
        <td>${formatMoney(Number(item.taxAmount), displayCurrency)}</td>
        <td>${formatMoney(Number(item.total), displayCurrency)}</td>
      </tr>`
    )
    .join("");

  const signatureMode =
    options.signatureMode ||
    (company?.signatureMode === "ELECTRONIC" ? "ELECTRONIC" : "MANUAL");
  const docColor = resolveDocColor(options, company);
  const docDark = documentColorDark(docColor);
  const docSoft = documentColorSoft(docColor);

  const companyLine = formatCompanyAddressCompact(company);
  const contactParts = [
    ...formatContactAddressLines(invoice.contact),
    invoice.contact.taxId ? `${L.taxId}: ${invoice.contact.taxId}` : null,
    invoice.contact.crNumber ? `${L.crNumber || "CR"}: ${invoice.contact.crNumber}` : null,
  ].filter(Boolean);

  const workflowHtml =
    isReceipt
      ? ""
      : invoice.type === "SALES"
        ? buildWorkflowStepsHtml(
            invoice.type,
            invoice.status,
            invoice.paymentStatus,
            [
              L.workflowDraft || "فاتورة مبدئية",
              L.workflowIssued || "إصدار",
              L.workflowClaim || "مطالبة",
              L.workflowReceipt || "إيصال سداد",
            ],
            docColor
          )
        : invoice.type === "QUOTATION"
          ? buildWorkflowStepsHtml(
              invoice.type,
              invoice.status,
              invoice.paymentStatus,
              [
                L.workflowQuoteDraft || "مسودة",
                L.workflowQuoteSent || "مرسل",
                L.workflowQuoteInvoice || "فاتورة",
              ],
              docColor
            )
          : "";

  return `
    ${isReceipt ? `<div style="margin-bottom:12px;padding:8px 12px;border:1px solid ${docColor};background:${docSoft};border-radius:6px;">
      <p style="font-size:13px;font-weight:bold;color:${docDark};">${L.receiptDoc}</p>
      <p style="font-size:11px;color:${docColor};">${L.receiptPaidNote}</p>
    </div>` : ""}
    <div class="header" style="border-bottom-color:${docColor};">
      <div style="display:flex;align-items:flex-start;gap:12px;min-width:0;flex:1;">
        ${company?.logo ? `<img src="${company.logo}" alt="" style="max-height:52px;max-width:140px;object-fit:contain;" />` : ""}
        <div style="min-width:0;">
          <div class="company" style="color:${docDark};font-size:16px;">${company?.name || "BHD Pro"}</div>
          ${workflowHtml}
          ${companyLine ? `<p style="font-size:12px;color:#334155;margin-top:6px;line-height:1.45;font-weight:500;">${companyLine}</p>` : ""}
          ${company?.vatNumber ? `<p style="font-size:11px;color:#475569;margin-top:3px;font-weight:500;">${L.vatNumber}: ${company.vatNumber}</p>` : ""}
          ${company?.crNumber ? `<p style="font-size:11px;color:#475569;font-weight:500;">${L.crNumber || "CR"}: ${company.crNumber}</p>` : ""}
        </div>
      </div>
      <div class="meta" style="font-size:12px;color:#334155;">
        <p style="font-size:15px;font-weight:bold;color:#0f172a;margin-bottom:6px;">${L.docTitle}</p>
        <p><strong>${L.number}:</strong> ${invoice.number}</p>
        <p><strong>${L.date}:</strong> ${formatDate(invoice.date)}</p>
        ${!isReceipt ? `<p><strong>${L.dueDate}:</strong> ${formatDate(invoice.dueDate)}</p>` : ""}
        ${isReceipt ? `<p><strong>${L.amountPaid}:</strong> ${formatMoney(displayTotal, displayCurrency)}</p>` : ""}
        <p><strong>${L.currency}:</strong> ${displayCurrency}</p>
        ${isFx ? `<p><strong>${L.exchangeRate}:</strong> ${rate}</p>` : ""}
      </div>
    </div>
    ${headerNote ? `<div style="margin-bottom:10px;font-size:10px;color:#64748b;white-space:pre-wrap;line-height:1.35;">${headerNote}</div>` : ""}
    <div class="parties">
      <div class="box">
        <span style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.04em;">${isSales ? L.customer : L.supplier}</span>
        <span style="font-weight:600;font-size:12px;color:#0f172a;margin-right:6px;">${invoice.contact.name}</span>
        ${contactParts.length ? `<p style="font-size:10px;color:#64748b;margin-top:4px;line-height:1.4;">${contactParts.join(" · ")}</p>` : ""}
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th style="background:${docColor};">${L.description}</th>
          <th style="background:${docColor};">${L.quantity}</th>
          <th style="background:${docColor};">${L.unitPrice}</th>
          <th style="background:${docColor};">${L.discount}</th>
          <th style="background:${docColor};">${L.tax}</th>
          <th style="background:${docColor};">${L.lineTotal}</th>
        </tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>
    <div class="totals">
      <div><span>${L.subtotal}</span><span>${formatMoney(displaySubtotal, displayCurrency)}</span></div>
      <div><span>${L.tax}</span><span>${formatMoney(displayTax, displayCurrency)}</span></div>
      <div><span>${L.discount}</span><span>${formatMoney(displayDiscount, displayCurrency)}</span></div>
      <div class="grand" style="border-top-color:${docColor};color:${docDark};"><span>${L.grandTotal}</span><span>${formatMoney(displayTotal, displayCurrency)}</span></div>
      ${isFx ? `<div style="color:#64748b;padding-top:4px;"><span>${L.baseEquivalent} (${baseCurrency})</span><span>${formatMoney(Number(invoice.total), baseCurrency)}</span></div>` : ""}
    </div>
    ${invoice.notes ? `<div style="margin-top:24px;padding:12px;background:#f8fafc;border-radius:8px;font-size:13px;"><strong>${L.notes}:</strong> ${invoice.notes}</div>` : ""}
    ${buildSignatureAndQrHtml({ ...options, signatureMode }, isSales, docColor)}
    <div class="footer">${footerNote || (isReceipt ? L.receiptFooter : L.printFooter)}</div>
  `;
}

export function openInvoicePrintDialog(
  invoice: InvoiceDocumentData,
  company: CompanyInfo | null | undefined,
  options: PrintOptions
) {
  const { variant = "invoice", labels } = options;
  const docTitle = labels?.docTitle || invoice.number;
  const printTitle =
    variant === "receipt"
      ? `${labels?.receiptDoc || "Receipt"} ${invoice.number}`
      : `${docTitle} ${invoice.number}`;
  const bodyHtml = buildBodyHtml(invoice, company, options);

  const win = window.open("", "_blank", "width=800,height=900");
  if (!win) return;

  win.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="utf-8" />
      <title>${printTitle}</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; padding: 24px; color: #111; direction: rtl; }
        .header { display: flex; justify-content: space-between; gap: 16px; margin-bottom: 14px; border-bottom: 1px solid #059669; padding-bottom: 10px; }
        .company { font-size: 13px; font-weight: bold; }
        .meta { text-align: left; font-size: 10px; color: #475569; line-height: 1.45; flex-shrink: 0; }
        .parties { margin-bottom: 12px; }
        .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 10px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
        th { color: white; padding: 8px; text-align: right; }
        td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
        .totals { margin-right: auto; width: 240px; font-size: 12px; }
        .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
        .grand { font-weight: bold; font-size: 14px; border-top: 2px solid #059669; padding-top: 6px !important; }
        .footer { margin-top: 20px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; white-space: pre-wrap; }
        @media print { body { padding: 12px; } }
      </style>
    </head>
    <body>${bodyHtml}</body>
    </html>
  `);
  win.document.close();
  win.focus();

  const triggerPrint = () => {
    try {
      win.focus();
      win.print();
    } catch {
      /* ignore */
    }
  };

  // Do not close immediately after print() — that aborts save/download on many browsers.
  const onAfterPrint = () => {
    try {
      win.removeEventListener("afterprint", onAfterPrint);
      win.close();
    } catch {
      /* ignore */
    }
  };
  win.addEventListener("afterprint", onAfterPrint);

  if (win.document.readyState === "complete") {
    setTimeout(triggerPrint, 350);
  } else {
    win.onload = () => setTimeout(triggerPrint, 350);
  }
}
