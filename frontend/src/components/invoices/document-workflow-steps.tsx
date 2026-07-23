"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { documentWorkflowActiveStep } from "@/lib/document-workflow";

type DocKind = "QUOTATION" | "SALES" | "CREDIT_NOTE" | "PURCHASE" | "DEBIT_NOTE";

interface DocumentWorkflowStepsProps {
  docType: string;
  status: string;
  paymentStatus?: string;
  className?: string;
  /** document = printable white paper colors; screen = dark toolbar */
  appearance?: "screen" | "document";
}

export function DocumentWorkflowSteps({
  docType,
  status,
  paymentStatus,
  className,
  appearance = "screen",
}: DocumentWorkflowStepsProps) {
  const t = useTranslations("invoices");
  const kind = docType as DocKind;
  const current = documentWorkflowActiveStep(docType, status, paymentStatus);
  const onPaper = appearance === "document";

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
            {idx > 0 && (
              <span className={onPaper ? "text-slate-400" : "text-slate-600"}>←</span>
            )}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium",
                onPaper &&
                  done &&
                  "border-emerald-400 bg-emerald-50 text-emerald-700",
                onPaper &&
                  active &&
                  "border-blue-400 bg-blue-50 text-blue-700",
                onPaper &&
                  !done &&
                  !active &&
                  "border-slate-200 bg-slate-50 text-slate-400",
                !onPaper &&
                  done &&
                  "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
                !onPaper &&
                  active &&
                  "border-blue-500/50 bg-blue-500/10 text-blue-300",
                !onPaper &&
                  !done &&
                  !active &&
                  "border-slate-700 text-slate-500"
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
