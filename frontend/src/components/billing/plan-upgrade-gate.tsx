"use client";

import Link from "next/link";
import { Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  rememberUpgradeIntent,
  subscriptionUpgradeHref,
  type UpgradeFeatureKey,
  UPGRADE_FEATURES,
} from "@/lib/plan-upgrade";

type Props = {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
  feature?: UpgradeFeatureKey;
  /** Where to return after successful payment */
  from?: string;
};

/** Small amber chip — use in sidebars / locked nav rows. */
export function UpgradeBadge({
  className,
  iconOnly,
}: {
  className?: string;
  iconOnly?: boolean;
}) {
  if (iconOnly) {
    return (
      <span
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-md border border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400",
          className,
        )}
        title="ترقية"
      >
        <Crown className="w-3 h-3" />
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-amber-500/35 bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-extrabold tracking-wide text-amber-700 dark:text-amber-400",
        className,
      )}
    >
      <Crown className="w-2.5 h-2.5" />
      ترقية
    </span>
  );
}

export function PlanUpgradeGate({
  title,
  description,
  className,
  compact,
  feature,
  from,
}: Props) {
  const meta = feature ? UPGRADE_FEATURES[feature] : null;
  const arTitle = title || (meta ? `ترقية مطلوبة: ${meta.labelAr}` : "ميزة ضمن باقة أعلى");
  const arDesc =
    description ||
    (meta
      ? `لاستخدام «${meta.labelAr}» يجب ترقية الاشتراك ثم إتمام الدفع وتأكيده من النظام.`
      : "هذه الخاصية غير مشمولة في باقتك الحالية. رقِّ الاشتراك واختر باقة ثم أتمم الدفع لتفعيلها.");
  const href = subscriptionUpgradeHref(feature, from || meta?.href);

  const go = () => {
    rememberUpgradeIntent(feature || null, from || meta?.href || null);
  };

  if (compact) {
    return (
      <Link
        href={href}
        onClick={go}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20",
          className,
        )}
      >
        <Lock className="w-3 h-3" />
        <UpgradeBadge />
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-teal-500/5 p-5 sm:p-6 text-center space-y-3",
        className,
      )}
    >
      <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/15 flex items-center justify-center">
        <Crown className="w-6 h-6 text-amber-500" />
      </div>
      <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">{arTitle}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 max-w-md mx-auto">{arDesc}</p>
      <Link
        href={href}
        onClick={go}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 text-sm font-bold"
      >
        <Crown className="w-4 h-4" />
        عرض الباقات والترقية
      </Link>
    </div>
  );
}

export function LockedNavItem({
  label,
  feature,
  from,
  onClick,
}: {
  label: string;
  feature?: UpgradeFeatureKey;
  from?: string;
  onClick?: () => void;
}) {
  const href = subscriptionUpgradeHref(feature, from);
  return (
    <Link
      href={href}
      onClick={() => {
        rememberUpgradeIntent(feature || null, from || null);
        onClick?.();
      }}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
    >
      <Lock className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-start truncate">{label}</span>
      <UpgradeBadge />
    </Link>
  );
}
