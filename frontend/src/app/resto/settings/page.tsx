"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { RestoLinkSettings } from "@/components/resto/resto-link-settings";
import { HisabyAppsLinkHub } from "@/components/shared/hisaby-apps-link-hub";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import toast from "react-hot-toast";

type Station = {
  id: string;
  name: string;
  nameEn: string | null;
  sortOrder: number;
  isActive: boolean;
};

export default function RestoSettingsPage() {
  const locale = useLocaleStore((s) => s.locale);
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const canManage =
    user?.role === "ADMIN" ||
    user?.role === "MANAGER" ||
    user?.role === "RESTO_MANAGER";
  const [stations, setStations] = useState<Station[]>([]);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);
  const [qrTables, setQrTables] = useState<
    Array<{
      id: string;
      code: string;
      name: string | null;
      zoneName: string;
      guestToken: string;
      path: string;
    }>
  >([]);

  const loadStations = async () => {
    try {
      const res = await api.getRestoStations();
      setStations(res.data.stations || []);
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    void loadStations();
  }, []);

  const runDemoSeed = async () => {
    setDemoBusy(true);
    try {
      await api.seedRestoDemoCatalog();
      toast.success(t.demoSeedOk);
    } catch {
      toast.error(t.actionFail);
    } finally {
      setDemoBusy(false);
    }
  };

  const purgeDemo = async () => {
    if (!window.confirm(t.demoPurgeConfirm)) return;
    setDemoBusy(true);
    try {
      await api.purgeRestoDemoCatalog();
      toast.success(t.demoPurgeOk);
    } catch {
      toast.error(t.actionFail);
    } finally {
      setDemoBusy(false);
    }
  };

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await api.createRestoStation({
        name: name.trim(),
        nameEn: nameEn.trim() || undefined,
        sortOrder: stations.length,
      });
      setName("");
      setNameEn("");
      toast.success(t.stationAdded);
      await loadStations();
    } catch {
      toast.error(t.actionFail);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-extrabold">{t.settings}</h1>
        <p className="text-sm text-stone-400 mt-1">{t.linkDesc}</p>
      </div>
      <HisabyAppsLinkHub tone="resto" />
      <RestoLinkSettings variant="resto" />

      {canManage ? (
        <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.guestQrTitle}</h2>
            <p className="text-xs text-stone-400 mt-1">{t.guestQrHint}</p>
          </div>
          <button
            type="button"
            disabled={qrBusy}
            onClick={() => {
              void (async () => {
                setQrBusy(true);
                try {
                  const res = await api.ensureRestoGuestTokens();
                  setQrTables(res.data.tables || []);
                  toast.success(t.guestQrEnsure);
                } catch {
                  toast.error(t.actionFail);
                } finally {
                  setQrBusy(false);
                }
              })();
            }}
            className="w-full rounded-xl bg-violet-500 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {qrBusy ? "…" : t.guestQrEnsure}
          </button>
          {qrTables.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto space-y-1.5 text-sm">
              {qrTables.map((tb) => (
                <li
                  key={tb.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-white/10 px-2.5 py-1.5"
                >
                  <span className="font-semibold truncate">
                    {tb.code}
                    {tb.name ? ` · ${tb.name}` : ""}
                  </span>
                  <button
                    type="button"
                    className="text-[11px] font-bold text-violet-200 shrink-0"
                    onClick={() => {
                      const url = `${window.location.origin}${tb.path}`;
                      void navigator.clipboard.writeText(url);
                      toast.success(t.guestQrCopied);
                    }}
                  >
                    {t.guestQrCopy}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {canManage ? (
        <div className="rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4 space-y-3">
          <div>
            <h2 className="font-bold">{t.demoSeedTitle}</h2>
            <p className="text-xs text-stone-400 mt-1">{t.demoSeedHint}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={demoBusy}
              onClick={() => void runDemoSeed()}
              className="flex-1 rounded-xl bg-sky-500 py-2.5 text-sm font-bold text-[#0b1220] disabled:opacity-50"
            >
              {demoBusy ? "…" : t.demoSeedRun}
            </button>
            {user?.role === "ADMIN" ? (
              <button
                type="button"
                disabled={demoBusy}
                onClick={() => void purgeDemo()}
                className="rounded-xl border border-rose-500/40 text-rose-200 px-4 py-2.5 text-sm font-semibold hover:bg-rose-500/10 disabled:opacity-50"
              >
                {t.demoPurge}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3">
        <div>
          <h2 className="font-bold">{t.stations}</h2>
          <p className="text-xs text-stone-400 mt-1">{t.stationsHint}</p>
        </div>
        <ul className="space-y-1.5">
          {stations.map((s) => (
            <li
              key={s.id}
              className="rounded-xl bg-black/20 px-3 py-2 text-sm flex justify-between gap-2"
            >
              <span className="font-semibold">
                {locale === "en" && s.nameEn ? s.nameEn : s.name}
              </span>
              <span className="text-xs text-stone-500">#{s.sortOrder}</span>
            </li>
          ))}
          {stations.length === 0 ? (
            <li className="text-xs text-stone-500">{t.kitchenEmpty}</li>
          ) : null}
        </ul>
        {canManage ? (
          <form onSubmit={onAdd} className="grid sm:grid-cols-2 gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.stationName}
              className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
              required
            />
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="EN"
              className="h-10 rounded-xl bg-black/30 border border-white/10 px-3 text-sm"
            />
            <button
              type="submit"
              disabled={busy}
              className="sm:col-span-2 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-[#14110f] disabled:opacity-50"
            >
              {t.addStation}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
