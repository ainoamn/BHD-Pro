"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Calculator,
  Link2,
  Link2Off,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

type LinkState = boolean | null;

export function HisabyAppsPanel({ className }: { className?: string }) {
  const t = useTranslations("dashboard");
  const [posLinked, setPosLinked] = useState<LinkState>(null);
  const [restoLinked, setRestoLinked] = useState<LinkState>(null);
  const [busy, setBusy] = useState<"pos" | "resto" | null>(null);

  const refresh = async () => {
    const [pos, resto] = await Promise.all([
      api.getPosLinkStatus().catch(() => null),
      api.getRestoLinkStatus().catch(() => null),
    ]);
    setPosLinked(pos ? !!pos.data.linked : false);
    setRestoLinked(resto ? !!resto.data.linked : false);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refresh();
      } catch {
        if (!cancelled) {
          setPosLinked(false);
          setRestoLinked(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const quickLink = async (which: "pos" | "resto") => {
    setBusy(which);
    try {
      if (which === "pos") await api.activatePosLink();
      else await api.activateRestoLink();
      await refresh();
    } catch {
      /* settings fallback */
    } finally {
      setBusy(null);
    }
  };

  const apps = [
    {
      key: "accounting",
      href: "/dashboard",
      title: t("appAccounting"),
      desc: t("appAccountingDesc"),
      icon: Calculator,
      tone: "border-emerald-500/30 bg-emerald-500/10",
      iconTone: "bg-emerald-500/15 text-emerald-400",
      linked: true as LinkState,
      current: true,
    },
    {
      key: "pos",
      href: "/pos",
      settingsHref: "/settings",
      title: t("appPos"),
      desc: t("appPosDesc"),
      icon: ShoppingCart,
      tone: "border-sky-500/30 bg-sky-500/10",
      iconTone: "bg-sky-500/15 text-sky-400",
      linked: posLinked,
      current: false,
    },
    {
      key: "resto",
      href: "/resto",
      settingsHref: "/settings",
      title: t("appResto"),
      desc: t("appRestoDesc"),
      icon: UtensilsCrossed,
      tone: "border-amber-500/30 bg-amber-500/10",
      iconTone: "bg-amber-500/15 text-amber-400",
      linked: restoLinked,
      current: false,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/50 bg-slate-900/60 p-5",
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{t("hisabyApps")}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{t("hisabyAppsHint")}</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {apps.map((app) => {
          const Icon = app.icon;
          const linked = app.linked;
          return (
            <div
              key={app.key}
              className={cn("rounded-xl border p-4 flex flex-col gap-3", app.tone)}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    app.iconTone,
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {app.current ? (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-white/70">
                    {t("appCurrent")}
                  </span>
                ) : linked === null ? (
                  <span className="text-[10px] text-slate-400">…</span>
                ) : linked ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                    <Link2 className="w-3 h-3" />
                    {t("appLinked")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-200/90">
                    <Link2Off className="w-3 h-3" />
                    {t("appUnlinked")}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-white">{app.title}</p>
                <p className="text-xs text-white/60 mt-0.5">{app.desc}</p>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link
                  href={app.href}
                  className="inline-flex rounded-lg bg-white/10 hover:bg-white/15 px-3 py-1.5 text-xs font-bold text-white"
                >
                  {t("appOpen")}
                </Link>
                {!app.current && linked === false ? (
                  <button
                    type="button"
                    disabled={busy === app.key}
                    onClick={() =>
                      void quickLink(app.key === "pos" ? "pos" : "resto")
                    }
                    className="inline-flex rounded-lg border border-white/15 hover:bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80 disabled:opacity-50"
                  >
                    {busy === app.key ? "…" : t("appLinkNow")}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
