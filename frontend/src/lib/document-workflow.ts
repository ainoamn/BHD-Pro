/** Shared invoice/quotation workflow step index for UI + print. */
export function documentWorkflowActiveStep(
  docType: string,
  status: string,
  paymentStatus?: string
): number {
  if (docType === "QUOTATION") {
    if (status === "CANCELLED") return -1;
    if (status === "DRAFT") return 0;
    if (["SENT", "VIEWED", "OVERDUE"].includes(status)) return 1;
    return 2;
  }
  if (docType !== "SALES") return -1;
  if (paymentStatus === "PAID" || status === "PAID") return 3;
  if (["SENT", "VIEWED", "OVERDUE"].includes(status)) return 2;
  if (status === "DRAFT") return 1;
  return 0;
}

export function salesWorkflowLabels(labels: {
  draft: string;
  issued: string;
  claim: string;
  receipt: string;
}): string[] {
  return [labels.draft, labels.issued, labels.claim, labels.receipt];
}

export function quotationWorkflowLabels(labels: {
  draft: string;
  sent: string;
  invoice: string;
}): string[] {
  return [labels.draft, labels.sent, labels.invoice];
}

/** Compact progress-track HTML under company name for print/PDF */
export function buildWorkflowStepsHtml(
  docType: string,
  status: string,
  paymentStatus: string | undefined,
  stepLabels: string[],
  accentColor = "#059669"
): string {
  const current = documentWorkflowActiveStep(docType, status, paymentStatus);
  if (current < 0 || stepLabels.length === 0) return "";

  const nodes = stepLabels
    .map((label, idx) => {
      const done = idx < current;
      const active = idx === current;
      const circleBg = done || active ? accentColor : "#e2e8f0";
      const circleFg = done || active ? "#fff" : "#94a3b8";
      const textColor = active ? "#0f172a" : done ? "#047857" : "#94a3b8";
      const weight = active || done ? "700" : "500";
      const mark = done ? "✓" : String(idx + 1);
      const connector =
        idx < stepLabels.length - 1
          ? `<div style="flex:1;height:2px;margin:0 4px 18px;background:${
              idx < current ? accentColor : "#e2e8f0"
            };"></div>`
          : "";
      return `<div style="display:flex;align-items:flex-start;flex:1;min-width:0;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;min-width:0;flex:1;">
          <div style="width:22px;height:22px;border-radius:999px;background:${circleBg};color:${circleFg};font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;line-height:1;">${mark}</div>
          <span style="font-size:10px;font-weight:${weight};color:${textColor};text-align:center;line-height:1.25;">${label}</span>
        </div>
        ${connector}
      </div>`;
    })
    .join("");

  return `<div style="margin-top:10px;max-width:360px;"><div style="display:flex;align-items:flex-start;width:100%;">${nodes}</div></div>`;
}
