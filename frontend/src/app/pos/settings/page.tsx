"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { PosLinkSettings } from "@/components/pos/pos-link-settings";
import { DualControlSettings } from "@/components/security/dual-control-settings";
import { IncentivesSettings } from "@/components/pos/incentives-settings";
import {
  getPreferCashDrawer,
  getPreferThermalPrinter,
  setPreferCashDrawer,
  setPreferThermalPrinter,
} from "@/lib/pos-escpos";
import { getPosBeepMuted, setPosBeepMuted } from "@/lib/pos-beep";

export default function PosSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [preferThermal, setPreferThermal] = useState(true);
  const [preferDrawer, setPreferDrawer] = useState(true);
  const [muteBeep, setMuteBeep] = useState(false);

  useEffect(() => {
    setPreferThermal(getPreferThermalPrinter());
    setPreferDrawer(getPreferCashDrawer());
    setMuteBeep(getPosBeepMuted());
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{t.settings}</h1>
        <p className="text-sm text-slate-400 mt-1">{t.posLinkDesc}</p>
      </div>

      <PosLinkSettings variant="pos" />

      <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
        <span>{t.preferThermal}</span>
        <input
          type="checkbox"
          checked={preferThermal}
          onChange={(e) => {
            const next = e.target.checked;
            setPreferThermal(next);
            setPreferThermalPrinter(next);
          }}
        />
      </label>

      <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
        <span>{t.preferCashDrawer}</span>
        <input
          type="checkbox"
          checked={preferDrawer}
          onChange={(e) => {
            const next = e.target.checked;
            setPreferDrawer(next);
            setPreferCashDrawer(next);
          }}
        />
      </label>

      <label className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200">
        <span>{t.muteScanBeep}</span>
        <input
          type="checkbox"
          checked={muteBeep}
          onChange={(e) => {
            const next = e.target.checked;
            setMuteBeep(next);
            setPosBeepMuted(next);
          }}
        />
      </label>

      <DualControlSettings />

      <IncentivesSettings />

      <div className="flex flex-col sm:flex-row gap-2 sm:justify-between text-sm">
        <Link href="/pos" className="text-center text-sky-300 hover:underline">
          ← {t.openPos}
        </Link>
        <Link href="/inventory" className="text-center text-emerald-300 hover:underline">
          {t.goInventory} →
        </Link>
      </div>
    </div>
  );
}
