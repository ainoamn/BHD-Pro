"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";

export function IncentivesSettings() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === "ADMIN";
  const [cashierEnabled, setCashierEnabled] = useState(false);
  const [cashierPercent, setCashierPercent] = useState("0");
  const [customerEnabled, setCustomerEnabled] = useState(false);
  const [pointsPerUnit, setPointsPerUnit] = useState("0");
  const [redeemEnabled, setRedeemEnabled] = useState(false);
  const [redeemRate, setRedeemRate] = useState("0");
  const [receiptFooter, setReceiptFooter] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.getPosIncentivesConfig();
      setCashierEnabled(!!res.data.cashierEnabled);
      setCashierPercent(String(res.data.cashierPercent ?? 0));
      setCustomerEnabled(!!res.data.customerEnabled);
      setPointsPerUnit(String(res.data.customerPointsPerUnit ?? 0));
      setRedeemEnabled(!!res.data.redeemEnabled);
      setRedeemRate(String(res.data.redeemPointsPerUnit ?? 0));
      setReceiptFooter(String(res.data.receiptFooter ?? ""));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const save = async () => {
    if (!isAdmin) return;
    setSaving(true);
    try {
      await api.updatePosIncentivesConfig({
        cashierEnabled,
        cashierPercent: Number(cashierPercent) || 0,
        customerEnabled,
        customerPointsPerUnit: Number(pointsPerUnit) || 0,
        redeemEnabled,
        redeemPointsPerUnit: Number(redeemRate) || 0,
        receiptFooter: receiptFooter.trim(),
      });
      toast.success(t.incentivesSaved);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t.forbidden;
      toast.error(typeof msg === "string" ? msg : t.forbidden);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400">
        …
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-4 text-center space-y-2">
        <p className="text-sm text-rose-300">{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-100">{t.incentivesTitle}</h2>
        <p className="text-[11px] text-slate-500 mt-0.5">{t.incentivesDesc}</p>
      </div>

      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span>{t.cashierCommissionEnabled}</span>
        <input
          type="checkbox"
          checked={cashierEnabled}
          disabled={!isAdmin}
          onChange={(e) => setCashierEnabled(e.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span>{t.cashierPercent}</span>
        <input
          type="number"
          min={0}
          step={0.01}
          disabled={!isAdmin || !cashierEnabled}
          value={cashierPercent}
          onChange={(e) => setCashierPercent(e.target.value)}
          className="w-24 h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-end text-sm text-white disabled:opacity-50"
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span>{t.customerLoyaltyEnabled}</span>
        <input
          type="checkbox"
          checked={customerEnabled}
          disabled={!isAdmin}
          onChange={(e) => setCustomerEnabled(e.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span>{t.pointsPerUnit}</span>
        <input
          type="number"
          min={0}
          step={0.001}
          disabled={!isAdmin || !customerEnabled}
          value={pointsPerUnit}
          onChange={(e) => setPointsPerUnit(e.target.value)}
          className="w-24 h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-end text-sm text-white disabled:opacity-50"
        />
      </label>

      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span>{t.redeemEnabled}</span>
        <input
          type="checkbox"
          checked={redeemEnabled}
          disabled={!isAdmin || !customerEnabled}
          onChange={(e) => setRedeemEnabled(e.target.checked)}
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm text-slate-200">
        <span>{t.redeemRate}</span>
        <input
          type="number"
          min={0}
          step={0.001}
          disabled={!isAdmin || !redeemEnabled}
          value={redeemRate}
          onChange={(e) => setRedeemRate(e.target.value)}
          className="w-24 h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-end text-sm text-white disabled:opacity-50"
        />
      </label>

      <label className="block space-y-1 text-sm text-slate-200">
        <span>{t.receiptFooter}</span>
        <input
          type="text"
          maxLength={200}
          disabled={!isAdmin}
          value={receiptFooter}
          onChange={(e) => setReceiptFooter(e.target.value)}
          placeholder={t.receiptFooterHint}
          className="w-full h-9 rounded-lg border border-white/10 bg-black/30 px-3 text-sm text-white disabled:opacity-50"
        />
      </label>

      {isAdmin ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="w-full h-9 rounded-lg bg-sky-500/20 text-sm font-bold text-sky-100 hover:bg-sky-500/30 disabled:opacity-50"
        >
          {t.save}
        </button>
      ) : (
        <p className="text-[11px] text-slate-500">{t.adminOnlyKeys}</p>
      )}
    </div>
  );
}
