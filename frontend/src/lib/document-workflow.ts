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

/** HTML strip for print/PDF invoice status trail */
export function buildWorkflowStepsHtml(
  docType: string,
  status: string,
  paymentStatus: string | undefined,
  stepLabels: string[]
): string {
  const current = documentWorkflowActiveStep(docType, status, paymentStatus);
  if (current < 0 || stepLabels.length === 0) return "";

  const parts = stepLabels
    .map((label, idx) => {
      const done = idx < current;
      const active = idx === current;
      const bg = done ? "#ecfdf5" : active ? "#eff6ff" : "#f8fafc";
      const border = done ? "#34d399" : active ? "#60a5fa" : "#e2e8f0";
      const color = done ? "#047857" : active ? "#1d4ed8" : "#94a3b8";
      const weight = active || done ? "700" : "500";
      const mark = done ? "✓ " : "";
      const arrow =
        idx > 0
          ? `<span style="color:#94a3b8;margin:0 6px;font-size:11px;">←</span>`
          : "";
      return `${arrow}<span style="display:inline-block;padding:4px 10px;border-radius:999px;border:1px solid ${border};background:${bg};color:${color};font-size:11px;font-weight:${weight};">${mark}${label}</span>`;
    })
    .join("");

  return `<div style="margin:0 0 14px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;display:flex;flex-wrap:wrap;align-items:center;gap:4px;">${parts}</div>`;
}
