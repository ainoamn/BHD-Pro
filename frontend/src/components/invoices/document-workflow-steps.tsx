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
  accentColor?: string;
}

export function DocumentWorkflowSteps({
  docType,
  status,
  paymentStatus,
  className,
  appearance = "screen",
  accentColor = "#059669",
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

  if (onPaper) {
    return (
      <div className={cn("mt-2.5 w-full max-w-sm", className)}>
        <div className="flex items-start w-full">
          {steps.map((step, idx) => {
            const done = idx < current;
            const active = idx === current;
            return (
              <div key={step.key} className="flex items-start flex-1 min-w-0">
                <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                  <div
                    className="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{
                      backgroundColor: done || active ? accentColor : "#e2e8f0",
                      color: done || active ? "#fff" : "#94a3b8",
                    }}
                  >
                    {done ? <Check className="w-3 h-3" strokeWidth={3} /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "text-[9px] sm:text-[10px] text-center leading-tight px-0.5",
                      active && "font-bold text-slate-900",
                      done && !active && "font-semibold text-emerald-700",
                      !done && !active && "font-medium text-slate-400"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className="h-0.5 flex-1 mt-2.5 sm:mt-3 mx-0.5 shrink min-w-[8px]"
                    style={{
                      backgroundColor: idx < current ? accentColor : "#e2e8f0",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

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
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-medium",
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
