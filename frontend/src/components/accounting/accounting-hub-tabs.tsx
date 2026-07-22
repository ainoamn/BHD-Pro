"use client";

import { useTranslations } from "next-intl";
import {
  LayoutGrid,
  TrendingUp,
  TrendingDown,
  Files,
  Receipt,
  ClipboardList,
  FileMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AccountingHubTab =
  | "overview"
  | "quotations"
  | "sales"
  | "creditNotes"
  | "purchases"
  | "documents";

export const ACCOUNTING_HUB_TABS: AccountingHubTab[] = [
  "overview",
  "quotations",
  "sales",
  "creditNotes",
  "purchases",
  "documents",
];

interface AccountingHubTabsProps {
  active: AccountingHubTab;
  onChange: (tab: AccountingHubTab) => void;
  pendingCount?: number;
}

const tabs: { id: AccountingHubTab; icon: typeof LayoutGrid; labelKey: string }[] = [
  { id: "overview", icon: LayoutGrid, labelKey: "tabOverview" },
  { id: "quotations", icon: ClipboardList, labelKey: "tabQuotations" },
  { id: "sales", icon: TrendingUp, labelKey: "tabSalesInvoices" },
  { id: "creditNotes", icon: FileMinus, labelKey: "tabCreditNotes" },
  { id: "purchases", icon: TrendingDown, labelKey: "tabPurchases" },
  { id: "documents", icon: Files, labelKey: "tabDocuments" },
];

export function AccountingHubTabs({ active, onChange, pendingCount = 0 }: AccountingHubTabsProps) {
  const t = useTranslations("accounting");

  return (
    <div className="flex flex-wrap gap-2 p-1 bg-slate-900/80 border border-slate-800 rounded-xl">
      {tabs.map(({ id, icon: Icon, labelKey }) => (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          className={cn(
            "relative flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
            active === id
              ? id === "sales" || id === "quotations" || id === "creditNotes"
                ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/30"
                : id === "purchases"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-900/30"
                  : "bg-slate-700 text-white"
              : "text-slate-400 hover:text-white hover:bg-slate-800/60"
          )}
        >
          <Icon className="w-4 h-4 shrink-0" />
          {t(labelKey)}
          {id === "sales" && pendingCount > 0 && (
            <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-[10px] font-bold text-slate-900 flex items-center justify-center">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export { Receipt };
