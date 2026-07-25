"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Circle, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OnboardingState {
  hasLogo: boolean;
  hasVat: boolean;
  hasCr: boolean;
  hasAddress: boolean;
  hasPhone: boolean;
  hasCustomers: boolean;
  hasProducts: boolean;
  hasInvoices: boolean;
}

const STEPS: {
  key: keyof OnboardingState;
  href: string;
}[] = [
  { key: "hasLogo", href: "/settings" },
  { key: "hasVat", href: "/settings" },
  { key: "hasCr", href: "/settings" },
  { key: "hasAddress", href: "/settings" },
  { key: "hasPhone", href: "/settings" },
  { key: "hasCustomers", href: "/contacts?action=new&type=CUSTOMER" },
  { key: "hasProducts", href: "/inventory" },
  { key: "hasInvoices", href: "/accounting?tab=sales&action=new&type=SALES" },
];

interface OnboardingChecklistProps {
  data: OnboardingState;
}

export function OnboardingChecklist({ data }: OnboardingChecklistProps) {
  const t = useTranslations("onboarding");
  const [hidden, setHidden] = useState(false);

  const { done, total, percent, incomplete } = useMemo(() => {
    const totalSteps = STEPS.length;
    const doneSteps = STEPS.filter((s) => data[s.key]).length;
    return {
      done: doneSteps,
      total: totalSteps,
      percent: Math.round((doneSteps / totalSteps) * 100),
      incomplete: STEPS.filter((s) => !data[s.key]),
    };
  }, [data]);

  if (hidden || percent >= 100) return null;

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-gradient-to-l from-emerald-500/5 to-slate-900/60 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-white">{t("title")}</h2>
            <p className="text-sm text-slate-400 mt-0.5">{t("subtitle")}</p>
            <div className="mt-3 h-2 rounded-full bg-slate-800 overflow-hidden max-w-xs">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-slate-500">
              {t("progress", { done, total, percent })}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setHidden(true)}
          className="p-1.5 text-slate-500 hover:text-white"
          aria-label="close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {STEPS.map((step) => {
          const ok = data[step.key];
          return (
            <li key={step.key}>
              <Link
                href={step.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors",
                  ok
                    ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-200"
                    : "border-slate-700/60 bg-slate-900/40 text-slate-300 hover:border-slate-600"
                )}
              >
                {ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <Circle className="w-4 h-4 text-slate-500 shrink-0" />
                )}
                <span className="truncate">{t(`step.${step.key}`)}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {incomplete[0] && (
        <Link
          href={incomplete[0].href}
          className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          {t("continue")}
        </Link>
      )}
    </div>
  );
}
