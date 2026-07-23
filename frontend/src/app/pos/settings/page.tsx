"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Copy, KeyRound, Link2 } from "lucide-react";
import api from "@/lib/api";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";

export default function PosSettingsPage() {
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

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{t.settings}</h1>
        <p className="text-sm text-slate-400 mt-1">{companyName}</p>
      </div>

      <div
        className={`rounded-2xl border p-4 ${
          linked ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"
        }`}
      >
        <p className="font-bold flex items-center gap-2">
          <Link2 className="w-4 h-4" />
          {linked ? t.linked : t.unlinked}
        </p>
        {prefix && <p className="text-xs text-slate-400 mt-2">Key prefix: {prefix}…</p>}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
        <button
          type="button"
          disabled={busy}
          onClick={activate}
          className="w-full h-11 rounded-xl bg-emerald-500 font-bold text-white hover:bg-emerald-400 disabled:opacity-50"
        >
          {t.activateLink}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={generate}
          className="w-full h-11 rounded-xl bg-sky-500 font-bold text-white hover:bg-sky-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          <KeyRound className="w-4 h-4" />
          {t.generateKey}
        </button>
        {generatedKey && (
          <div className="rounded-xl bg-black/40 p-3 text-xs break-all space-y-2">
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
        <div className="pt-2 space-y-2">
          <label className="text-xs text-slate-400">{t.pasteKey}</label>
          <input
            value={pasteKey}
            onChange={(e) => setPasteKey(e.target.value)}
            className="w-full h-11 rounded-xl bg-[#0b1220] border border-white/10 px-3 font-mono text-sm"
            placeholder="hpos_…"
          />
          <button
            type="button"
            disabled={busy || !pasteKey.trim()}
            onClick={confirmKey}
            className="w-full h-10 rounded-xl border border-white/15 font-semibold hover:bg-white/5 disabled:opacity-40"
          >
            {t.saveKey}
          </button>
        </div>
      </div>

      <Link href="/pos" className="block text-center text-sm text-sky-300 hover:underline">
        ← {t.openPos}
      </Link>
    </div>
  );
}
