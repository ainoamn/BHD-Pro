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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPosIncentivesConfig();
        if (cancelled) return;
        setCashierEnabled(!!res.data.cashierEnabled);
        setCashierPercent(String(res.data.cashierPercent ?? 0));
        setCustomerEnabled(!!res.data.customerEnabled);
        setPointsPerUnit(String(res.data.customerPointsPerUnit ?? 0));
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
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
          step="0.01"
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
          step="0.01"
          disabled={!isAdmin || !customerEnabled}
          value={pointsPerUnit}
          onChange={(e) => setPointsPerUnit(e.target.value)}
          className="w-24 h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-end text-sm text-white disabled:opacity-50"
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
