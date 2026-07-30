"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Calculator,
  Crown,
  Link2,
  Lock,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
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

export function HisabyAppsPanel({ className }: { className?: string }) {
  const t = useTranslations("dashboard");
  const user = useAuthStore((s) => s.user);
  const perms = user?.modulePermissions;
  const {
    data: subscription,
    isError: loadError,
    refetch,
  } = useQuery({
    queryKey: ["subscription-modules"],
    queryFn: async () => {
      const res = await api.getCurrentSubscription({ light: true });
      return res.data as {
        features?: Record<string, boolean>;
        plan?: string;
      };
    },
  });
  const planFeatures = useMemo(
    () => ({
      ...featuresFromPlanId(subscription?.plan || user?.company?.plan),
      ...(subscription?.features || {}),
    }),
    [subscription?.features, subscription?.plan, user?.company?.plan],
  );

  const apps = useMemo(() => {
    const all = [
      {
        key: "accounting" as const,
        href: "/dashboard",
        title: t("appAccounting"),
        desc: t("appAccountingDesc"),
        icon: Calculator,
        tone: "border-emerald-500/30 bg-emerald-500/10",
        iconTone: "bg-emerald-500/15 text-emerald-400",
        current: true,
        visible: canOpenAccountingApp(perms, user?.role),
        planOk: true,
        feature: null as UpgradeFeatureKey | null,
      },
      {
        key: "pos" as const,
        href: "/pos",
        title: t("appPos"),
        desc: t("appPosDesc"),
        icon: ShoppingCart,
        tone: "border-sky-500/30 bg-sky-500/10",
        iconTone: "bg-sky-500/15 text-sky-400",
        current: false,
        visible: canOpenPosApp(perms, user?.role),
        planOk: planFeatures.pos === true,
        feature: "pos" as UpgradeFeatureKey,
      },
      {
        key: "resto" as const,
        href: "/resto",
        title: t("appResto"),
        desc: t("appRestoDesc"),
        icon: UtensilsCrossed,
        tone: "border-amber-500/30 bg-amber-500/10",
        iconTone: "bg-amber-500/15 text-amber-400",
        current: false,
        visible: canOpenRestoApp(perms, user?.role),
        planOk: planFeatures.resto === true,
        feature: "resto" as UpgradeFeatureKey,
      },
    ];
    return all.filter((a) => a.visible);
  }, [t, perms, user?.role, planFeatures.pos, planFeatures.resto]);

  if (!apps.length) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-800/50 bg-slate-900/60 p-4 sm:p-5",
        className,
      )}
    >
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">{t("hisabyApps")}</h2>
        <p className="text-sm text-slate-400 mt-0.5">{t("hisabyAppsHint")}</p>
      </div>
      {loadError ? (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-rose-300">{t("appsLoadFailed")}</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950"
          >
            {t("appsRetry")}
          </button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {apps.map((app) => {
          const Icon = app.icon;
          const href =
            app.planOk || !app.feature
              ? app.href
              : subscriptionUpgradeHref(app.feature, app.href);
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
                ) : !app.planOk ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300">
                    <Lock className="w-3 h-3" />
                    {t("appPlanLocked")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                    <Link2 className="w-3 h-3" />
                    {t("appLinked")}
                  </span>
                )}
              </div>
              <div>
                <p className="font-semibold text-white">{app.title}</p>
                <p className="text-xs text-white/60 mt-0.5">{app.desc}</p>
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
                    "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-white",
                    app.planOk
                      ? "bg-white/10 hover:bg-white/15"
                      : "bg-amber-500/25 hover:bg-amber-500/35 text-amber-100",
                  )}
                >
                  {!app.planOk ? <Crown className="w-3.5 h-3.5" /> : null}
                  {app.planOk ? t("appOpen") : t("appUpgrade")}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
