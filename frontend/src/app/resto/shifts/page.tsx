"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Wallet } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { PosShiftsView } from "@/components/pos/pos-shifts-view";

export default function RestoShiftsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [warehouseLabel, setWarehouseLabel] = useState("");
  const [loading, setLoading] = useState(true);
  const [missingWh, setMissingWh] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [homeMismatch, setHomeMismatch] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    setHomeMismatch(false);
    try {
      const [restoRes, ctxRes] = await Promise.all([
        api.getRestoLinkStatus(),
        api.getPosWarehouseContext().catch(() => null),
      ]);
      const restoId = restoRes.data.warehouseId || null;
      const restoWh = restoRes.data.warehouse as
        | { id?: string; code?: string; name?: string }
        | null
        | undefined;
      const ctx = ctxRes?.data;
      const canSwitch = !!ctx?.canSwitchFreely;
      const homeId = ctx?.homeWarehouseId || null;
      const homeWh = ctx?.homeWarehouse;

      // Managers keep restaurant warehouse; cashiers open on home warehouse
      // so API home-warehouse lock (Wave BD) does not reject the shift.
      const effectiveId = canSwitch ? restoId : homeId || restoId;
      const labelWh = canSwitch
        ? restoWh
        : homeWh ||
          (homeId && ctx?.warehouses?.find((w) => w.id === homeId)) ||
          restoWh;

      setWarehouseId(effectiveId);
      setWarehouseLabel(
        labelWh
          ? `${labelWh.code || ""}${labelWh.name ? ` — ${labelWh.name}` : ""}`.trim()
          : "",
      );
      setMissingWh(!effectiveId);
      setHomeMismatch(
        !canSwitch && !!homeId && !!restoId && homeId !== restoId,
      );
    } catch {
      setWarehouseId(null);
      setMissingWh(false);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-stone-400">
        <Loader2 className="w-7 h-7 animate-spin" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-4 text-center">
        <p className="text-sm text-rose-300">{t.loadFailed}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#14110f]"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  if (missingWh || !warehouseId) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Wallet className="w-6 h-6 text-amber-400" />
          <div>
            <h1 className="text-xl font-extrabold">{t.shiftsTitle}</h1>
            <p className="text-sm text-stone-400 mt-1">{t.shiftsSub}</p>
          </div>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-3">
          <p className="text-sm text-amber-100">{t.shiftsNeedWarehouse}</p>
          <Link
            href="/resto/settings"
            className="inline-flex rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-[#14110f]"
          >
            {t.settings}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {warehouseLabel ? (
        <p className="px-4 sm:px-6 pt-4 text-xs text-stone-500">
          {t.shiftsWarehouse}:{" "}
          <span className="text-stone-300 font-semibold">{warehouseLabel}</span>
        </p>
      ) : null}
      {homeMismatch ? (
        <p className="px-4 sm:px-6 text-xs text-amber-300/90">
          {t.shiftsHomeMismatch}
        </p>
      ) : null}
      <PosShiftsView
        forcedWarehouseId={warehouseId}
        forcedWarehouseLabel={warehouseLabel || undefined}
        hideWarehousePicker
        titleOverride={t.shiftsTitle}
      />
    </div>
  );
}
