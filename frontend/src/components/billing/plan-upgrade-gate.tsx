"use client";

import Link from "next/link";
import { Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title?: string;
  description?: string;
  className?: string;
  compact?: boolean;
};

export function PlanUpgradeGate({
  title,
  description,
  className,
  compact,
}: Props) {
  const arTitle = title || "ميزة ضمن باقة أعلى";
  const arDesc =
    description ||
    "هذه الخاصية غير مشمولة في باقتك الحالية. رقِّ الاشتراك لتفعيلها لفريقك.";

  if (compact) {
    return (
      <Link
        href="/subscription"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/20",
          className,
        )}
      >
        <Lock className="w-3 h-3" />
        ترقية
        <Crown className="w-3 h-3" />
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
        href="/subscription"
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white px-4 py-2.5 text-sm font-bold"
      >
        <Crown className="w-4 h-4" />
        ترقية الباقة
      </Link>
    </div>
  );
}

export function LockedNavItem({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-slate-400 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-300 transition-colors"
    >
      <Lock className="w-4 h-4 shrink-0" />
      <span className="flex-1 text-start truncate">{label}</span>
      <span className="text-[10px] font-bold text-amber-600">ترقية</span>
    </button>
  );
}
