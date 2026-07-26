"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  Link2,
  Loader2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { formatMoney, apiErrorMessage } from "@/lib/utils";
import { DecimalInput } from "@/components/ui/decimal-input";

export default function PosBooksPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const queryClient = useQueryClient();
  const [expenseAmt, setExpenseAmt] = useState(0);
  const [expenseReason, setExpenseReason] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["pos-books-summary"],
    queryFn: async () => {
      const res = await api.getPosBooksSummary();
      return res.data;
    },
  });

  const expenseMutation = useMutation({
    mutationFn: () =>
      api.createPosCashMovement({
        type: "OUT",
        amount: Number(expenseAmt),
        reason: expenseReason.trim() || t.expenseDefaultReason,
      }),
    onSuccess: () => {
      toast.success(t.expenseSaved);
      setExpenseAmt(0);
      setExpenseReason("");
      void queryClient.invalidateQueries({ queryKey: ["pos-books-summary"] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(apiErrorMessage(err, t.expenseFail));
    },
  });

  const onExpense = (e: FormEvent) => {
    e.preventDefault();
    if (expenseAmt <= 0) {
      toast.error(t.expenseNeedAmount);
      return;
    }
    expenseMutation.mutate();
  };

  const currency = data?.currency || "OMR";

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold flex items-center gap-2">
            <Wallet className="w-5 h-5 text-sky-400" />
            {t.posBooksTitle}
          </h1>
          <p className="text-sm text-slate-400 mt-1">{t.posBooksSub}</p>
        </div>
        <Link
          href="/pos"
          className="h-10 px-3 rounded-xl border border-white/10 text-sm text-slate-300 hover:bg-white/5 inline-flex items-center"
        >
          {t.openPos}
        </Link>
      </div>

      {data && !data.linked && (
        <div className="rounded-2xl border border-violet-500/30 bg-violet-500/10 p-4 space-y-2">
          <p className="font-bold text-violet-100 flex items-center gap-2">
            <Calculator className="w-4 h-4" />
            {t.posBooksUpsellTitle}
          </p>
          <p className="text-sm text-violet-100/80 leading-relaxed">{t.posBooksUpsellBody}</p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/pos/settings"
              className="h-9 px-3 rounded-lg bg-violet-500 text-white text-sm font-bold inline-flex items-center gap-1.5 hover:bg-violet-400"
            >
              <Link2 className="w-3.5 h-3.5" />
              {t.activateLink}
            </Link>
            <Link
              href="/dashboard"
              className="h-9 px-3 rounded-lg border border-violet-400/40 text-violet-100 text-sm font-semibold inline-flex items-center hover:bg-violet-500/20"
            >
              {t.previewFullAccounting}
            </Link>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="py-16 flex justify-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : isError || !data ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-slate-400">
            {locale === "en" ? "Could not load books summary" : "تعذر تحميل ملخص الحسابات"}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            {locale === "en" ? "Retry" : "إعادة المحاولة"}
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-200/80 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                {t.booksRevenue}
              </p>
              <p className="mt-2 text-lg font-extrabold text-white tabular-nums">
                {formatMoney(data.revenue, currency)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {data.salesCount} {t.booksSales}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4">
              <p className="text-xs text-rose-200/80 flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                {t.booksExpenses}
              </p>
              <p className="mt-2 text-lg font-extrabold text-white tabular-nums">
                {formatMoney(data.expenses, currency)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {data.expenseCount} {t.booksEntries}
              </p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs text-amber-200/80">{t.booksRefunds}</p>
              <p className="mt-2 text-lg font-extrabold text-white tabular-nums">
                {formatMoney(data.refunds, currency)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {data.refundCount} · {t.booksVoids}: {data.voidCount}
              </p>
            </div>
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-4">
              <p className="text-xs text-sky-200/80">{t.booksNet}</p>
              <p className="mt-2 text-lg font-extrabold text-white tabular-nums">
                {formatMoney(data.net, currency)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {t.todaySales}: {formatMoney(data.today.salesTotal, currency)}
              </p>
            </div>
          </div>

          <form
            onSubmit={onExpense}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 space-y-3"
          >
            <h2 className="font-bold text-sm">{t.recordExpense}</h2>
            <p className="text-xs text-slate-500">{t.recordExpenseHint}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.amount}</label>
                <DecimalInput
                  value={expenseAmt}
                  min={0}
                  decimals={3}
                  onChange={setExpenseAmt}
                  className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">{t.expenseReason}</label>
                <input
                  value={expenseReason}
                  onChange={(e) => setExpenseReason(e.target.value)}
                  placeholder={t.expenseReasonPh}
                  className="w-full h-10 rounded-lg bg-black/30 border border-white/10 px-3 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={expenseMutation.isPending}
              className="h-10 px-4 rounded-xl bg-rose-500/90 text-white text-sm font-bold hover:bg-rose-500 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {expenseMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {t.saveExpense}
            </button>
          </form>

          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 text-sm font-bold">{t.recentRevenue}</div>
              <ul className="divide-y divide-white/5 max-h-72 overflow-auto">
                {data.recentSales.length === 0 ? (
                  <li className="p-4 text-sm text-slate-500">{t.noRecentSales}</li>
                ) : (
                  data.recentSales.map((s) => (
                    <li key={s.id} className="px-4 py-2.5 flex justify-between gap-2 text-sm">
                      <span className="font-mono text-slate-300">{s.number}</span>
                      <span className="tabular-nums text-emerald-300">
                        {formatMoney(s.total, currency)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 text-sm font-bold flex justify-between">
                <span>{t.recentExpenses}</span>
                <button
                  type="button"
                  onClick={() => void refetch()}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  {t.refresh}
                </button>
              </div>
              <ul className="divide-y divide-white/5 max-h-72 overflow-auto">
                {data.recentExpenses.length === 0 ? (
                  <li className="p-4 text-sm text-slate-500">{t.noExpenses}</li>
                ) : (
                  data.recentExpenses.map((m) => (
                    <li key={m.id} className="px-4 py-2.5 text-sm space-y-0.5">
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-300 truncate">{m.reason || "—"}</span>
                        <span className="tabular-nums text-rose-300 shrink-0">
                          {formatMoney(m.amount, currency)}
                        </span>
                      </div>
                      {m.createdBy ? (
                        <p className="text-[11px] text-slate-500">{m.createdBy}</p>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
