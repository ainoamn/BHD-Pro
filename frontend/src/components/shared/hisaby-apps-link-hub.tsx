"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Calculator,
  Crown,
  Link2,
  Loader2,
  Lock,
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
import {
  featuresFromPlanId,
  rememberUpgradeIntent,
  subscriptionUpgradeHref,
  type UpgradeFeatureKey,
} from "@/lib/plan-upgrade";

type HubTone = "accounting" | "pos" | "resto";

const copy = {
  ar: {
    title: "أنظمة حسابي — شركة واحدة",
    hint: "المحاسبة والكاشير والمطاعم مربوطة دائماً بنفس الشركة. إظهار كل نظام يعتمد على الباقة والصلاحيات.",
    accounting: "المحاسبة",
    pos: "الكاشير",
    resto: "المطاعم",
    open: "فتح",
    upgrade: "ترقية",
    unified: "مربوط دائماً",
    locked: "غير مشمول بالباقة",
    current: "الحالي",
    loadFailed: "تعذر تحميل حالة الأنظمة",
    retry: "إعادة المحاولة",
  },
  en: {
    title: "Hisaby apps — one company",
    hint: "Accounting, POS, and Restaurants stay linked on one company. Which apps you see depends on plan and permissions.",
    accounting: "Accounting",
    pos: "POS",
    resto: "Restaurants",
    open: "Open",
    upgrade: "Upgrade",
    unified: "Always linked",
    locked: "Not on your plan",
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
  const [planFeatures, setPlanFeatures] = useState<Record<string, boolean>>(
    () => featuresFromPlanId(user?.company?.plan),
  );

  const refresh = useCallback(async () => {
    setLoadError(false);
    try {
      const [sub] = await Promise.all([
        api.getCurrentSubscription().catch(() => null),
        api.getPosLinkStatus().catch(() => null),
        api.getRestoLinkStatus().catch(() => null),
      ]);
      const data = sub?.data as
        | { features?: Record<string, boolean>; plan?: string }
        | undefined;
      const fromPlan = featuresFromPlanId(data?.plan || user?.company?.plan);
      setPlanFeatures({ ...fromPlan, ...(data?.features || {}) });
      setReady(true);
      setLoadError(false);
    } catch {
      setReady(false);
      setLoadError(true);
      setPlanFeatures(featuresFromPlanId(user?.company?.plan));
    }
  }, [user?.company?.plan]);

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
      planOk: true,
      feature: null as UpgradeFeatureKey | null,
    },
    {
      key: "pos" as const,
      href: "/pos",
      title: t.pos,
      icon: ShoppingCart,
      current: tone === "pos",
      visible: canOpenPosApp(perms, role),
      planOk: planFeatures.pos === true,
      feature: "pos" as UpgradeFeatureKey,
    },
    {
      key: "resto" as const,
      href: "/resto",
      title: t.resto,
      icon: UtensilsCrossed,
      current: tone === "resto",
      visible: canOpenRestoApp(perms, role),
      planOk: planFeatures.resto === true,
      feature: "resto" as UpgradeFeatureKey,
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
          const href =
            app.planOk || !app.feature
              ? app.href
              : subscriptionUpgradeHref(app.feature, app.href);
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
                ) : !app.planOk ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-300">
                    <Lock className="w-3 h-3" />
                    {t.locked}
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
                  href={href}
                  onClick={() => {
                    if (!app.planOk && app.feature) {
                      rememberUpgradeIntent(app.feature, app.href);
                    }
                  }}
                  className={cn(
                    "inline-flex min-h-9 items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold",
                    app.planOk
                      ? "bg-white/10 hover:bg-white/15"
                      : "bg-amber-500/20 text-amber-200 hover:bg-amber-500/30",
                  )}
                >
                  {!app.planOk ? <Crown className="w-3 h-3" /> : null}
                  {app.planOk ? t.open : t.upgrade}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
