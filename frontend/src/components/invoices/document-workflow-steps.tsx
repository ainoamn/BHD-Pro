"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type DocKind = "QUOTATION" | "SALES" | "CREDIT_NOTE" | "PURCHASE" | "DEBIT_NOTE";

interface DocumentWorkflowStepsProps {
  docType: string;
  status: string;
  paymentStatus?: string;
  className?: string;
}

function activeStep(docType: string, status: string, paymentStatus?: string): number {
  if (docType === "QUOTATION") {
    if (status === "CANCELLED") return -1;
    if (status === "DRAFT") return 0;
    if (["SENT", "VIEWED", "OVERDUE"].includes(status)) return 1;
    return 2;
  }
  if (paymentStatus === "PAID" || status === "PAID") return 3;
  if (["SENT", "VIEWED", "OVERDUE"].includes(status)) return 2;
  if (status === "DRAFT") return 1;
  return 0;
}

export function DocumentWorkflowSteps({
  docType,
  status,
  paymentStatus,
  className,
}: DocumentWorkflowStepsProps) {
  const t = useTranslations("invoices");
  const kind = docType as DocKind;
  const current = activeStep(docType, status, paymentStatus);

  const steps =
    kind === "QUOTATION"
      ? [
          { key: "draft", label: t("workflowQuoteDraft") },
          { key: "sent", label: t("workflowQuoteSent") },
          { key: "invoice", label: t("workflowQuoteInvoice") },
        ]
      : kind === "SALES"
        ? [
            { key: "draft", label: t("workflowDraft") },
            { key: "issued", label: t("workflowIssued") },
            { key: "claim", label: t("workflowClaim") },
            { key: "receipt", label: t("workflowReceipt") },
          ]
        : null;

  if (!steps || current < 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-2 text-xs", className)}>
      {steps.map((step, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <div key={step.key} className="flex items-center gap-2">
            {idx > 0 && <span className="text-slate-600">←</span>}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border",
                done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                active && "border-blue-500/50 bg-blue-500/10 text-blue-300",
                !done && !active && "border-slate-700 text-slate-500"
              )}
            >
              {done ? <Check className="w-3 h-3" /> : null}
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
