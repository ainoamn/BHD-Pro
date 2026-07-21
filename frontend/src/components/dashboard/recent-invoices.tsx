"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { cn, formatMoney, formatDate } from "@/lib/utils";
import Link from "next/link";

export interface RecentInvoiceItem {
  id: string;
  number: string;
  customer?: string;
  date: string;
  amount: number;
  status: string;
}

interface RecentInvoicesProps {
  invoices: RecentInvoiceItem[];
  currency?: string;
}

const statusIcons = {
  PAID: CheckCircle,
  PENDING: Clock,
  SENT: Clock,
  OVERDUE: AlertCircle,
  DRAFT: Clock,
};

const statusColors = {
  PAID: { color: "text-emerald-400", bg: "bg-emerald-500/10" },
  PENDING: { color: "text-amber-400", bg: "bg-amber-500/10" },
  SENT: { color: "text-amber-400", bg: "bg-amber-500/10" },
  OVERDUE: { color: "text-rose-400", bg: "bg-rose-500/10" },
  DRAFT: { color: "text-slate-400", bg: "bg-slate-500/10" },
};

export function RecentInvoices({ invoices, currency = "OMR" }: RecentInvoicesProps) {
  const t = useTranslations("dashboard");
  const tStatus = useTranslations("status");

  const statusLabel = (status: string) => {
    const map: Record<string, string> = {
      PAID: tStatus("paid"),
      SENT: tStatus("sent"),
      OVERDUE: tStatus("overdue"),
      DRAFT: tStatus("draft"),
      CANCELLED: tStatus("cancelled"),
    };
    return map[status] || tStatus("pending");
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5 }}
      className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">{t("recentInvoices")}</h3>
        <Link
          href="/accounting"
          className="text-sm text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
        >
          {t("viewAll")}
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </div>

      {invoices.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-8">{t("noInvoices")}</p>
      ) : (
        <div className="space-y-3">
          {invoices.map((invoice) => {
            const config = statusColors[invoice.status as keyof typeof statusColors] || statusColors.PENDING;
            const StatusIcon = statusIcons[invoice.status as keyof typeof statusIcons] || Clock;

            return (
              <div
                key={invoice.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 hover:bg-slate-800/50 transition-colors"
              >
                <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", config.bg)}>
                  <StatusIcon className={cn("w-5 h-5", config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{invoice.number}</p>
                  <p className="text-xs text-slate-400 truncate">{invoice.customer || "—"}</p>
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-white">
                    {formatMoney(invoice.amount, currency)}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(invoice.date)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
