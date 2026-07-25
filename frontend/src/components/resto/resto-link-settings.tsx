"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Copy, KeyRound, Link2, UtensilsCrossed } from "lucide-react";
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
  const isAdmin = user?.role === "ADMIN";
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "RESTO_MANAGER";
  const [linked, setLinked] = useState(false);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [pasteKey, setPasteKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");

  const refresh = async () => {
    const [linkRes, whRes] = await Promise.all([
      api.getRestoLinkStatus(),
      api.getWarehouses().catch(() => ({ data: [] as Warehouse[] })),
    ]);
    setLinked(!!linkRes.data.linked);
    setPrefix(linkRes.data.keyPrefix);
    setCompanyName(linkRes.data.companyName);
    const list = (Array.isArray(whRes.data) ? whRes.data : []) as Warehouse[];
    setWarehouses(list);
    setWarehouseId(linkRes.data.warehouseId || "");
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const toastApiError = (err: unknown) => {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status === 403) {
      toast.error(t.forbidden);
      return;
    }
    toast.error(errMessage(err, t.linkFail));
  };

  const activate = async () => {
    if (!warehouseId) {
      toast.error(t.warehouseRequired);
      return;
    }
    setBusy(true);
    try {
      await api.activateRestoLink(warehouseId);
      toast.success(t.linked);
      await refresh();
    } catch (err) {
      toastApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const saveWarehouse = async () => {
    if (!warehouseId) {
      toast.error(t.warehouseRequired);
      return;
    }
    setBusy(true);
    try {
      await api.setRestoWarehouse(warehouseId);
      toast.success(t.warehouseSaved);
      await refresh();
    } catch (err) {
      toastApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async () => {
    if (!window.confirm(t.unlinkConfirm)) return;
    setBusy(true);
    try {
      await api.deactivateRestoLink();
      setGeneratedKey(null);
      toast.success(t.unlinkOk);
      await refresh();
    } catch (err) {
      toast.error(errMessage(err, t.unlinkFail));
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.generateRestoLinkKey(warehouseId || undefined);
      setGeneratedKey(res.data.key);
      toast.success(t.keyHint);
      await refresh();
    } catch (err) {
      toastApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const confirmKey = async () => {
    setBusy(true);
    try {
      await api.confirmRestoLinkKey(pasteKey, warehouseId || undefined);
      toast.success(t.linked);
      setPasteKey("");
      await refresh();
    } catch (err) {
      toastApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const isAccounting = variant === "accounting";
  const panel = isAccounting
    ? "rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-3"
    : "rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3";
  const statusOk = isAccounting
    ? "border-emerald-500/40 bg-emerald-500/10"
    : "border-emerald-500/30 bg-emerald-500/10";
  const statusWarn = isAccounting
    ? "border-amber-500/40 bg-amber-500/10"
    : "border-amber-500/30 bg-amber-500/10";
  const btnPrimary = isAccounting
    ? "w-full h-10 rounded-lg bg-amber-600 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
    : "w-full h-11 rounded-xl bg-amber-500 font-bold text-white hover:bg-amber-400 disabled:opacity-50";
  const btnSky = isAccounting
    ? "w-full h-10 rounded-lg bg-sky-600 font-semibold text-white hover:bg-sky-500 disabled:opacity-50 inline-flex items-center justify-center gap-2"
    : "w-full h-11 rounded-xl bg-sky-500 font-bold text-white hover:bg-sky-400 disabled:opacity-50 inline-flex items-center justify-center gap-2";
  const inputCls = isAccounting
    ? "w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-3 font-mono text-sm text-white focus:outline-none focus:border-amber-500"
    : "w-full h-11 rounded-xl bg-[#1a1614] border border-white/10 px-3 font-mono text-sm";
  const secondaryBtn = isAccounting
    ? "w-full h-10 rounded-lg border border-slate-600 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
    : "w-full h-10 rounded-xl border border-white/15 font-semibold hover:bg-white/5 disabled:opacity-40";
  const selectCls = isAccounting
    ? "w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-3 text-sm text-white"
    : "w-full h-11 rounded-xl bg-[#1a1614] border border-white/10 px-3 text-sm";

  const sectorLabel = (s?: string) => {
    if (s === "RESTAURANT") return locale === "en" ? "Restaurant" : "مطاعم";
    if (s === "RETAIL") return locale === "en" ? "Retail" : "تجزئة";
    return locale === "en" ? "General" : "عام";
  };

  return (
    <div className={cn("space-y-4", className)}>
      {isAccounting && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <UtensilsCrossed className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">{t.linkTitle}</h2>
              <p className="text-sm text-slate-400 mt-1">{t.linkDesc}</p>
              {companyName ? (
                <p className="text-xs text-slate-500 mt-1 truncate">{companyName}</p>
              ) : null}
            </div>
          </div>
          <Link
            href="/resto"
            className="text-sm font-semibold text-amber-400 hover:underline shrink-0"
          >
            {t.openResto} →
          </Link>
        </div>
      )}

      {!isAccounting && (
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Link2 className="w-5 h-5 text-amber-400" />
            {t.linkTitle}
          </h2>
          <p className="text-sm text-stone-400 mt-1">{t.linkDesc}</p>
        </div>
      )}

      <div className={cn(panel, linked && warehouseId ? statusOk : statusWarn)}>
        <p className="text-sm font-semibold">
          {linked ? t.linked : t.notLinked}
          {prefix ? (
            <span className="ms-2 font-mono text-xs opacity-70">({prefix}…)</span>
          ) : null}
        </p>
        {linked && !warehouseId ? (
          <p className="text-xs text-amber-200 mt-1">{t.needsWarehouse}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-xs opacity-70">{t.warehouseLabel}</span>
          <select
            value={warehouseId}
            onChange={(e) => setWarehouseId(e.target.value)}
            className={selectCls}
            disabled={!canManage && linked}
          >
            <option value="">{locale === "en" ? "Select warehouse…" : "اختر مخزناً…"}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {locale === "en" && w.nameEn ? w.nameEn : w.name} (
                {sectorLabel(w.sector)})
              </option>
            ))}
          </select>
          <p className="text-[11px] opacity-60">{t.warehouseHint}</p>
        </label>

        {!linked ? (
          <button type="button" disabled={busy} onClick={() => void activate()} className={btnPrimary}>
            {t.activateLink}
          </button>
        ) : (
          <>
            {canManage ? (
              <button
                type="button"
                disabled={busy || !warehouseId}
                onClick={() => void saveWarehouse()}
                className={btnPrimary}
              >
                {t.warehouseSave}
              </button>
            ) : null}
            <button type="button" disabled={busy} onClick={() => void deactivate()} className={secondaryBtn}>
              {t.unlink}
            </button>
          </>
        )}

        {isAdmin ? (
          <>
            <button type="button" disabled={busy} onClick={() => void generate()} className={btnSky}>
              <KeyRound className="w-4 h-4" />
              {t.generateKey}
            </button>
            {generatedKey ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                <p className="text-xs text-amber-100">{t.keyHint}</p>
                <div className="flex gap-2">
                  <code className="flex-1 break-all text-xs font-mono">{generatedKey}</code>
                  <button
                    type="button"
                    className="shrink-0 rounded-lg border border-white/20 px-2 py-1 text-xs"
                    onClick={() => {
                      void navigator.clipboard.writeText(generatedKey);
                      toast.success(t.copy);
                    }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                value={pasteKey}
                onChange={(e) => setPasteKey(e.target.value)}
                placeholder={t.pasteKey}
                className={inputCls}
              />
              <button
                type="button"
                disabled={busy || !pasteKey.trim()}
                onClick={() => void confirmKey()}
                className={cn(secondaryBtn, "w-auto px-4 shrink-0")}
              >
                {t.confirmKey}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
