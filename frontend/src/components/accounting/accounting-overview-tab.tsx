"use client";

import { useTranslations } from "next-intl";
import {
  FileText,
  Receipt,
  TrendingUp,
  TrendingDown,
  Files,
  Clock,
} from "lucide-react";
import { formatMoney } from "@/lib/utils";

interface AccountingOverviewTabProps {
  currency?: string;
  todayReceived?: number;
  todayExpenses?: number;
  pendingCollection?: number;
  pendingAmount?: number;
  onNewSalesInvoice: () => void;
  onNewPurchaseInvoice: () => void;
  onNewQuotation: () => void;
  onNewCreditNote: () => void;
  onCollect: () => void;
  onViewDocuments: () => void;
  onViewSales: () => void;
  onViewPurchases: () => void;
}

function ModuleCard({
  icon: Icon,
  title,
  hint,
  onClick,
  variant = "default",
  badge,
}: {
  icon: typeof FileText;
  title: string;
  hint: string;
  onClick?: () => void;
  variant?: "sales" | "purchase" | "default" | "muted";
  badge?: string;
}) {
  const styles = {
    sales: "border-emerald-800/50 hover:border-emerald-600 bg-emerald-950/20 hover:bg-emerald-950/40",
    purchase: "border-rose-800/50 hover:border-rose-600 bg-rose-950/20 hover:bg-rose-950/40",
    default: "border-slate-700 hover:border-slate-500 bg-slate-800/30 hover:bg-slate-800/60",
    muted: "border-slate-800 bg-slate-900/40 opacity-60 cursor-not-allowed",
  };
  const iconStyles = {
    sales: "bg-emerald-500/10 text-emerald-400",
    purchase: "bg-rose-500/10 text-rose-400",
    default: "bg-slate-700/50 text-slate-300",
    muted: "bg-slate-800 text-slate-500",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={variant === "muted" || !onClick}
      className={`relative flex flex-col items-start gap-3 p-5 rounded-xl border text-right transition-all w-full ${styles[variant]}`}
    >
      {badge && (
        <span className="absolute top-3 left-3 text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">
          {badge}
        </span>
      )}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconStyles[variant]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="font-semibold text-white text-sm">{title}</p>
        <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
      </div>
    </button>
  );
}

export function AccountingOverviewTab({
  currency = "OMR",
  todayReceived = 0,
  todayExpenses = 0,
  pendingCollection = 0,
  pendingAmount = 0,
  onNewSalesInvoice,
  onNewPurchaseInvoice,
  onNewQuotation,
  onNewCreditNote,
  onCollect,
  onViewDocuments,
  onViewSales,
  onViewPurchases,
}: AccountingOverviewTabProps) {
  const t = useTranslations("accounting");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: t("todayReceived"), value: formatMoney(todayReceived, currency), color: "text-emerald-400" },
          { label: t("todayExpenses"), value: formatMoney(todayExpenses, currency), color: "text-rose-400" },
          {
            label: t("pendingCollection"),
            value: String(pendingCollection),
            color: pendingCollection > 0 ? "text-amber-400" : "text-white",
          },
          { label: t("outstanding"), value: formatMoney(pendingAmount, currency), color: "text-slate-200" },
        ].map((s) => (
          <div key={s.label} className="glass rounded-xl p-4">
            <p className="text-xs text-slate-500">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-emerald-950/20">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            {t("salesSection")}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{t("salesSectionHint")}</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ModuleCard
            icon={FileText}
            title={t("salesInvoice")}
            hint={t("salesInvoiceHint")}
            variant="sales"
            onClick={onNewSalesInvoice}
          />
          <ModuleCard
            icon={Receipt}
            title={t("collectReceipt")}
            hint={t("collectReceiptHint")}
            variant="sales"
            onClick={onCollect}
            badge={pendingCollection > 0 ? `${pendingCollection}` : undefined}
          />
          <ModuleCard
            icon={Files}
            title={t("viewSalesInvoices")}
            hint={t("viewSalesInvoicesHint")}
            variant="default"
            onClick={onViewSales}
          />
          <ModuleCard
            icon={FileText}
            title={t("quote")}
            hint={t("quoteHint")}
            variant="sales"
            onClick={onNewQuotation}
          />
        </div>
      </div>

      <div className="glass rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 bg-rose-950/20">
          <h3 className="font-semibold text-white flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-rose-400" />
            {t("purchasesSection")}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{t("purchasesSectionHint")}</p>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <ModuleCard
            icon={FileText}
            title={t("purchaseInvoice")}
            hint={t("purchaseInvoiceHint")}
            variant="purchase"
            onClick={onNewPurchaseInvoice}
          />
          <ModuleCard
            icon={Receipt}
            title={t("supplierPayment")}
            hint={t("supplierPaymentHint")}
            variant="purchase"
            onClick={onNewPurchaseInvoice}
          />
          <ModuleCard
            icon={Files}
            title={t("viewPurchaseInvoices")}
            hint={t("viewPurchaseInvoicesHint")}
            variant="default"
            onClick={onViewPurchases}
          />
          <ModuleCard
            icon={Clock}
            title={t("creditNote")}
            hint={t("creditNoteHint")}
            variant="sales"
            onClick={onNewCreditNote}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onViewDocuments}
        className="w-full py-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800/50 text-sm font-medium flex items-center justify-center gap-2"
      >
        <Files className="w-4 h-4" />
        {t("allDocuments")}
      </button>
    </div>
  );
}
