"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  Calculator,
  Link2,
  Loader2,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { cn } from "@/lib/utils";
import {
  canOpenAccountingApp,
  canOpenPosApp,
  canOpenRestoApp,
} from "@/lib/module-permissions";

type HubTone = "accounting" | "pos" | "resto";

const copy = {
  ar: {
    title: "أنظمة حسابي — شركة واحدة",
    hint: "المحاسبة والكاشير والمطاعم مربوطة دائماً: نفس الشركة والمستخدمين والمخزون والحسابات. التحكم بإظهار الأنظمة لاحقاً عبر الباقة والاشتراك.",
    accounting: "المحاسبة",
    pos: "الكاشير",
    resto: "المطاعم",
    open: "فتح",
    unified: "مربوط دائماً",
    current: "الحالي",
    loadFailed: "تعذر تحميل حالة الأنظمة",
    retry: "إعادة المحاولة",
  },
  en: {
    title: "Hisaby apps — one company",
    hint: "Accounting, POS, and Restaurants stay linked: same company, users, stock, and ledgers. Module visibility is controlled later by plan/subscription.",
    accounting: "Accounting",
    pos: "POS",
    resto: "Restaurants",
    open: "Open",
    unified: "Always linked",
    current: "Current",
    loadFailed: "Could not load app status",
    retry: "Retry",
  },
} as const;

export function HisabyAppsLinkHub({
  tone = "accounting",
  className,
}: {
  tone?: HubTone;
  className?: string;
}) {
  const locale = useLocaleStore((s) => s.locale);
  const t = copy[locale === "en" ? "en" : "ar"];
  const user = useAuthStore((s) => s.user);
  const role = user?.role ?? "";
  const perms = user?.modulePermissions;

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      await Promise.all([api.getPosLinkStatus(), api.getRestoLinkStatus()]);
      setReady(true);
      setLoadError(false);
    } catch {
      setReady(false);
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shell =
    tone === "accounting"
      ? "rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-3"
      : tone === "pos"
        ? "rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3"
        : "rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-3";

  const apps = [
    {
      key: "accounting" as const,
      href: "/dashboard",
      title: t.accounting,
      icon: Calculator,
      current: tone === "accounting",
      visible: canOpenAccountingApp(perms, role),
    },
    {
      key: "pos" as const,
      href: "/pos",
      title: t.pos,
      icon: ShoppingCart,
      current: tone === "pos",
      visible: canOpenPosApp(perms, role),
    },
    {
      key: "resto" as const,
      href: "/resto",
      title: t.resto,
      icon: UtensilsCrossed,
      current: tone === "resto",
      visible: canOpenRestoApp(perms, role),
    },
  ].filter((a) => a.visible);

  if (!apps.length) return null;

  return (
    <div className={cn(shell, className)}>
      <div>
        <h2 className="text-base font-bold flex items-center gap-2">
          <Link2 className="w-4 h-4 opacity-80" />
          {t.title}
        </h2>
        <p className="text-xs opacity-60 mt-1 leading-relaxed">{t.hint}</p>
      </div>
      {loadError ? (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-rose-300">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="rounded-md bg-amber-500 px-2.5 py-1 text-[10px] font-bold text-slate-950"
          >
            {t.retry}
          </button>
        </div>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-3">
        {apps.map((app) => {
          const Icon = app.icon;
          return (
            <div
              key={app.key}
              className="rounded-xl border border-white/10 bg-black/20 p-3 flex flex-col gap-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className="w-4 h-4 shrink-0 opacity-90" />
                  <span className="font-semibold text-sm truncate">{app.title}</span>
                </div>
                {app.current ? (
                  <span className="text-[10px] font-bold uppercase opacity-50">
                    {t.current}
                  </span>
                ) : ready ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-300">
                    <Link2 className="w-3 h-3" />
                    {t.unified}
                  </span>
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin opacity-40" />
                )}
              </div>
              <div className="mt-auto">
                <Link
                  href={app.href}
                  className="inline-flex min-h-9 items-center rounded-lg bg-white/10 hover:bg-white/15 px-2.5 py-1 text-[11px] font-bold"
                >
                  {t.open}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
