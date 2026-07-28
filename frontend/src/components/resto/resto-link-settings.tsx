"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Link2, UtensilsCrossed } from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { cn } from "@/lib/utils";

type Variant = "resto" | "accounting";

type Warehouse = {
  id: string;
  code: string;
  name: string;
  nameEn?: string | null;
  sector?: string;
};

function errMessage(err: unknown, fallback: string) {
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (typeof msg === "string") return msg;
  if (Array.isArray(msg) && msg[0]) return String(msg[0]);
  return fallback;
}

export function RestoLinkSettings({
  variant = "resto",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "RESTO_MANAGER";
  const [companyName, setCompanyName] = useState("");
  const [busy, setBusy] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [bootLoading, setBootLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const refresh = async () => {
    const [linkRes, whRes] = await Promise.all([
      api.getRestoLinkStatus(),
      api.getWarehouses(),
    ]);
    setCompanyName(linkRes.data.companyName);
    const list = (Array.isArray(whRes.data) ? whRes.data : []) as Warehouse[];
    setWarehouses(list);
    setWarehouseId(linkRes.data.warehouseId || "");
  };

  useEffect(() => {
    setBootLoading(true);
    setLoadError(false);
    refresh()
      .catch(() => setLoadError(true))
      .finally(() => setBootLoading(false));
  }, []);

  const saveWarehouse = async () => {
    if (!warehouseId) {
      toast.error(t.warehouseRequired || "Warehouse required");
      return;
    }
    setBusy(true);
    try {
      await api.setRestoWarehouse(warehouseId);
      toast.success(t.warehouseSaved || "Saved");
      await refresh();
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      toast.error(status === 403 ? t.forbidden : errMessage(err, t.linkFail || "Failed"));
    } finally {
      setBusy(false);
    }
  };

  const isAccounting = variant === "accounting";
  const panel = isAccounting
    ? "rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3"
    : "rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3";
  const inputCls = isAccounting
    ? "w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-3 text-sm text-white"
    : "w-full h-11 rounded-xl bg-[#1c1814] border border-white/10 px-3 text-sm";
  const btnPrimary = isAccounting
    ? "w-full h-10 rounded-lg bg-emerald-600 font-semibold text-white disabled:opacity-50"
    : "w-full h-11 rounded-xl bg-amber-500 font-bold text-[#1a1208] disabled:opacity-50";

  return (
    <div className={cn("space-y-4", className)}>
      {bootLoading ? (
        <p className="text-sm text-stone-400 py-4">…</p>
      ) : loadError ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-center space-y-2">
          <p className="text-sm text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => {
              setBootLoading(true);
              setLoadError(false);
              refresh()
                .catch(() => setLoadError(true))
                .finally(() => setBootLoading(false));
            }}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950"
          >
            {t.retry}
          </button>
        </div>
      ) : (
        <>
          {isAccounting ? (
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-start gap-3 min-w-0">
                <UtensilsCrossed className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-white">{t.restoLinkTitle || t.brand}</h2>
                  <p className="text-sm text-slate-400 mt-1">
                    {locale === "en"
                      ? "Restaurants stay part of this company — shared menu products, contacts, and users."
                      : "المطاعم جزء دائم من نفس الشركة — أصناف وجهات اتصال ومستخدمون مشتركون."}
                  </p>
                  {companyName ? (
                    <p className="text-xs text-slate-500 mt-1 truncate">{companyName}</p>
                  ) : null}
                </div>
              </div>
              <Link
                href="/resto"
                className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-amber-300 hover:bg-slate-700 shrink-0"
              >
                {t.openResto || t.openRestoShort}
              </Link>
            </div>
          ) : null}

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="font-bold flex items-center gap-2 text-sm sm:text-base text-emerald-200">
              <Link2 className="w-4 h-4" />
              {locale === "en" ? "Always linked to Accounting" : "مربوط دائماً بالمحاسبة"}
            </p>
          </div>

          <div className={panel}>
            <label className="block space-y-1 mb-3">
              <span className="text-xs opacity-60">{t.warehouseLabel || "Warehouse"}</span>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className={inputCls}
                disabled={!canManage}
              >
                <option value="">{locale === "en" ? "Select warehouse…" : "اختر مخزناً…"}</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {locale === "en" && w.nameEn ? w.nameEn : w.name}
                  </option>
                ))}
              </select>
            </label>
            {canManage ? (
              <button
                type="button"
                disabled={busy || !warehouseId}
                onClick={() => void saveWarehouse()}
                className={btnPrimary}
              >
                {t.warehouseSave || "Save"}
              </button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
