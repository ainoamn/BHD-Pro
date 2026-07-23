"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Copy, KeyRound, Link2, ShoppingCart } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { cn } from "@/lib/utils";

type Variant = "pos" | "accounting";

export function PosLinkSettings({
  variant = "pos",
  className,
}: {
  variant?: Variant;
  className?: string;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [linked, setLinked] = useState(false);
  const [prefix, setPrefix] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [pasteKey, setPasteKey] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await api.getPosLinkStatus();
    setLinked(!!res.data.linked);
    setPrefix(res.data.keyPrefix);
    setCompanyName(res.data.companyName);
  };

  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);

  const activate = async () => {
    setBusy(true);
    try {
      await api.activatePosLink();
      toast.success(t.linked);
      await refresh();
    } catch {
      toast.error(t.saleFail);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const res = await api.generatePosLinkKey();
      setGeneratedKey(res.data.key);
      toast.success(t.keyHint);
      await refresh();
    } catch {
      toast.error(t.saleFail);
    } finally {
      setBusy(false);
    }
  };

  const confirmKey = async () => {
    setBusy(true);
    try {
      await api.confirmPosLinkKey(pasteKey);
      toast.success(t.linked);
      setPasteKey("");
      await refresh();
    } catch {
      toast.error(t.saleFail);
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
    ? "w-full h-10 rounded-lg bg-emerald-600 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
    : "w-full h-11 rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400 disabled:opacity-50";
  const btnSky = isAccounting
    ? "w-full h-10 rounded-lg bg-sky-600 font-semibold text-white hover:bg-sky-500 disabled:opacity-50 inline-flex items-center justify-center gap-2"
    : "w-full h-11 rounded-xl bg-sky-500 font-bold text-white hover:bg-sky-400 disabled:opacity-50 inline-flex items-center justify-center gap-2";
  const inputCls = isAccounting
    ? "w-full h-10 rounded-lg bg-slate-900 border border-slate-700 px-3 font-mono text-sm text-white focus:outline-none focus:border-emerald-500"
    : "w-full h-11 rounded-xl bg-[#0b1220] border border-white/10 px-3 font-mono text-sm";
  const secondaryBtn = isAccounting
    ? "w-full h-10 rounded-lg border border-slate-600 font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
    : "w-full h-10 rounded-xl border border-white/15 font-semibold hover:bg-white/5 disabled:opacity-40";

  return (
    <div className={cn("space-y-4", className)}>
      {isAccounting && (
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <ShoppingCart className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-white">{t.posLinkTitle}</h2>
              <p className="text-sm text-slate-400 mt-1">{t.posLinkDesc}</p>
              {companyName ? (
                <p className="text-xs text-slate-500 mt-1 truncate">{companyName}</p>
              ) : null}
            </div>
          </div>
          <Link
            href="/pos"
            className="text-sm px-4 py-2 rounded-lg bg-slate-800 text-emerald-400 hover:bg-slate-700 shrink-0"
          >
            {t.openPos}
          </Link>
        </div>
      )}

      <div className={cn("rounded-xl border p-4", linked ? statusOk : statusWarn)}>
        <p className="font-bold flex items-center gap-2 text-sm sm:text-base">
          <Link2 className="w-4 h-4" />
          {linked ? t.linked : t.unlinked}
        </p>
        {prefix && (
          <p className="text-xs text-slate-400 mt-2">
            Key prefix: {prefix}…
          </p>
        )}
      </div>

      <div className={panel}>
        <button type="button" disabled={busy} onClick={activate} className={btnPrimary}>
          {t.activateLink}
        </button>
        <button type="button" disabled={busy} onClick={generate} className={btnSky}>
          <KeyRound className="w-4 h-4" />
          {t.generateKey}
        </button>
        {generatedKey && (
          <div
            className={cn(
              "rounded-xl p-3 text-xs break-all space-y-2",
              isAccounting ? "bg-slate-950/80" : "bg-black/40",
            )}
          >
            <p className="text-amber-200">{t.keyHint}</p>
            <p className="font-mono text-sky-200">{generatedKey}</p>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-slate-300"
              onClick={() => {
                navigator.clipboard.writeText(generatedKey);
                toast.success("OK");
              }}
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
          </div>
        )}
        <div className="pt-1 space-y-2">
          <label className="text-xs text-slate-400">{t.pasteKey}</label>
          <input
            value={pasteKey}
            onChange={(e) => setPasteKey(e.target.value)}
            className={inputCls}
            placeholder="hpos_…"
          />
          <button
            type="button"
            disabled={busy || !pasteKey.trim()}
            onClick={confirmKey}
            className={secondaryBtn}
          >
            {t.saveKey}
          </button>
        </div>
      </div>
    </div>
  );
}
