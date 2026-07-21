"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  TrendingUp,
  TrendingDown,
  UserPlus,
  BookUser,
  FileText,
  Receipt,
} from "lucide-react";
import { motion } from "framer-motion";
import { formatMoney } from "@/lib/utils";

interface QuickActionsProps {
  todayReceived?: number;
  todayExpenses?: number;
  pendingCollection?: number;
  currency?: string;
  onCollect?: () => void;
}

const staticActions = [
  {
    key: "newRevenue",
    href: "/accounting?tab=sales&action=new&type=SALES",
    icon: TrendingUp,
    iconBg: "bg-emerald-500/10 text-emerald-400",
  },
  {
    key: "newExpense",
    href: "/accounting?tab=purchases&action=new&type=PURCHASE",
    icon: TrendingDown,
    iconBg: "bg-rose-500/10 text-rose-400",
  },
  {
    key: "newCustomer",
    href: "/contacts?action=new&type=CUSTOMER",
    icon: UserPlus,
    iconBg: "bg-blue-500/10 text-blue-400",
  },
  {
    key: "addressBook",
    href: "/contacts",
    icon: BookUser,
    iconBg: "bg-amber-500/10 text-amber-400",
  },
  {
    key: "allInvoices",
    href: "/accounting?tab=documents",
    icon: FileText,
    iconBg: "bg-slate-500/10 text-slate-400",
  },
] as const;

export function QuickActions({
  todayReceived = 0,
  todayExpenses = 0,
  pendingCollection = 0,
  currency = "OMR",
  onCollect,
}: QuickActionsProps) {
  const t = useTranslations("dashboard");

  return (
    <div className="bg-slate-900/60 border border-slate-800/50 rounded-xl p-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white mb-1">{t("quickActions")}</h2>
          <p className="text-sm text-slate-400">{t("quickActionsHint")}</p>
        </div>
        <div className="flex gap-4 text-sm shrink-0">
          <div>
            <p className="text-slate-500 text-xs">{t("todayReceived")}</p>
            <p className="text-emerald-400 font-bold">{formatMoney(todayReceived, currency)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-xs">{t("todayExpenses")}</p>
            <p className="text-rose-400 font-bold">{formatMoney(todayExpenses, currency)}</p>
          </div>
          {pendingCollection > 0 && (
            <div>
              <p className="text-slate-500 text-xs">{t("pendingCollection")}</p>
              <p className="text-amber-400 font-bold">{pendingCollection}</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
        {staticActions.map((action, index) => {
          const Icon = action.icon;
          return (
            <motion.div
              key={action.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={action.href}
                className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-slate-800 hover:border-slate-600 bg-slate-800/30 hover:bg-slate-800/60 transition-all text-center h-full"
              >
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${action.iconBg}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                    {t(action.key)}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                    {t(`${action.key}Desc`)}
                  </p>
                </div>
              </Link>
            </motion.div>
          );
        })}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: staticActions.length * 0.05 }}
        >
          {onCollect ? (
            <button
              type="button"
              onClick={onCollect}
              className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-emerald-800/50 hover:border-emerald-600 bg-emerald-900/20 hover:bg-emerald-900/40 transition-all text-center h-full w-full"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                  {t("recordReceipt")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  {t("recordReceiptDesc")}
                </p>
              </div>
            </button>
          ) : (
            <Link
              href="/accounting?tab=sales&action=collect&type=SALES"
              className="group flex flex-col items-center gap-3 p-4 rounded-xl border border-emerald-800/50 hover:border-emerald-600 bg-emerald-900/20 hover:bg-emerald-900/40 transition-all text-center h-full"
            >
              <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-400">
                <Receipt className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-white group-hover:text-emerald-300 transition-colors">
                  {t("recordReceipt")}
                </p>
                <p className="text-xs text-slate-500 mt-0.5 hidden sm:block">
                  {t("recordReceiptDesc")}
                </p>
              </div>
            </Link>
          )}
        </motion.div>
      </div>
    </div>
  );
}
