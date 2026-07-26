"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";

type Summary = {
  earned: number;
  paid: number;
  remaining: number;
  todaySales: number;
  todayCommission: number;
  nextTier?: {
    minSales: number;
    bonusAmount: number;
    progress: number;
  } | null;
  config: { cashierEnabled?: boolean };
};

type LedgerRow = {
  id: string;
  type: string;
  amount: number | string;
  note?: string | null;
  createdAt: string;
};

function fmt(n: number) {
  return Number(n || 0).toFixed(3);
}

export function PosCommissionChip() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN" || user?.role === "MANAGER";
  const [summary, setSummary] = useState<Summary | null>(null);
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [open, setOpen] = useState(false);
  const [payoutAmt, setPayoutAmt] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api.getMyPosIncentives();
      setSummary(res.data);
      if (!res.data.config?.cashierEnabled) return;
      if (open) {
        const led = await api.getMyPosIncentivesLedger(5);
        setLedger(Array.isArray(led.data) ? led.data : []);
      }
    } catch {
      setSummary(null);
    }
  }, [open]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!summary?.config?.cashierEnabled) return null;

  const chipLabel =
    locale === "en"
      ? `${t.commission}: ${t.commissionRemaining} ${fmt(summary.remaining)} · ${t.commissionPaid} ${fmt(summary.paid)}`
      : `${t.commission}: ${t.commissionRemaining} ${fmt(summary.remaining)} · ${t.commissionPaid} ${fmt(summary.paid)}`;

  const doPayout = async () => {
    if (!user?.id) return;
    const amount = Number(payoutAmt);
    if (!(amount > 0)) return;
    setBusy(true);
    try {
      let warehouseId: string | undefined;
      try {
        warehouseId = localStorage.getItem("hisaby-pos-warehouse-id") || undefined;
      } catch {
        warehouseId = undefined;
      }
      await api.payoutPosCommission({
        userId: user.id,
        amount,
        warehouseId: warehouseId || undefined,
      });
      toast.success(t.payoutOk);
      setPayoutAmt("");
      await refresh();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t.payoutFail;
      toast.error(typeof msg === "string" ? msg : t.payoutFail);
    } finally {
      setBusy(false);
    }
  };

  const doReversePayout = async (ledgerId: string) => {
    if (!window.confirm(t.reversePayoutConfirm)) return;
    setBusy(true);
    try {
      await api.reversePosCommissionPayout(ledgerId);
      toast.success(t.reversePayoutOk);
      await refresh();
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t.reversePayoutFail;
      toast.error(typeof msg === "string" ? msg : t.reversePayoutFail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="inline-flex h-7 max-w-[11rem] sm:max-w-[14rem] items-center truncate rounded-md bg-amber-500/10 px-2 text-[11px] font-semibold tabular-nums text-amber-100/90 hover:bg-amber-500/20"
        title={chipLabel}
      >
        {chipLabel}
      </button>
      {open ? (
        <div className="absolute top-full z-50 mt-1 w-64 rounded-lg border border-white/10 bg-[#111827] p-2.5 text-xs shadow-xl end-0">
          <div className="space-y-1 text-slate-300">
            <p>
              {t.commissionToday}:{" "}
              <span className="font-bold text-white tabular-nums">
                {fmt(summary.todayCommission)}
              </span>
            </p>
            <p>
              {t.commissionEarned}:{" "}
              <span className="font-bold text-white tabular-nums">
                {fmt(summary.earned)}
              </span>
            </p>
            <p>
              {t.commissionPaid}:{" "}
              <span className="tabular-nums">{fmt(summary.paid)}</span>
            </p>
            <p>
              {t.commissionRemaining}:{" "}
              <span className="font-bold text-emerald-300 tabular-nums">
                {fmt(summary.remaining)}
              </span>
            </p>
            {summary.nextTier ? (
              <p className="text-[10px] text-slate-500">
                {t.nextBonusTier}: {fmt(summary.todaySales)} /{" "}
                {fmt(summary.nextTier.minSales)} (+
                {fmt(summary.nextTier.bonusAmount)})
              </p>
            ) : null}
          </div>
          <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto border-t border-white/10 pt-2">
            {!ledger.length ? (
              <li className="text-[10px] text-slate-500">{t.ledgerEmpty}</li>
            ) : (
              ledger.map((row) => (
                <li
                  key={row.id}
                  className="flex justify-between gap-2 text-[10px] text-slate-400"
                >
                  <span className="truncate">
                    {row.type}
                    {row.note ? ` · ${row.note}` : ""}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="tabular-nums text-slate-200">
                      {fmt(Number(row.amount))}
                    </span>
                    {isAdmin && row.type === "PAYOUT" ? (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void doReversePayout(row.id)}
                        className="rounded px-1 text-[9px] font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {t.reversePayout}
                      </button>
                    ) : null}
                  </span>
                </li>
              ))
            )}
          </ul>
          {isAdmin ? (
            <div className="mt-2 flex gap-1 border-t border-white/10 pt-2">
              <input
                type="number"
                min={0}
                step="0.001"
                value={payoutAmt}
                onChange={(e) => setPayoutAmt(e.target.value)}
                placeholder={t.payoutAmount}
                className="h-7 min-w-0 flex-1 rounded border border-white/10 bg-black/30 px-2 text-[11px] text-white"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void doPayout()}
                className="h-7 shrink-0 rounded bg-amber-500/20 px-2 text-[11px] font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-50"
              >
                {t.payout}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
