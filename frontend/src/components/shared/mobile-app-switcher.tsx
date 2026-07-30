"use client";

import Link from "next/link";
import { Calculator, ShoppingCart, UtensilsCrossed } from "lucide-react";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { cn } from "@/lib/utils";
import {
  canOpenAccountingApp,
  canOpenPosApp,
  canOpenRestoApp,
} from "@/lib/module-permissions";

type HisabyApp = "accounting" | "pos" | "resto";

const activeTone: Record<HisabyApp, string> = {
  accounting:
    "border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
  pos: "border-sky-500/50 bg-sky-500/15 text-sky-700 dark:text-sky-200",
  resto:
    "border-amber-500/50 bg-amber-500/15 text-amber-800 dark:text-amber-100",
};

export function MobileAppSwitcher({
  current,
  className,
}: {
  current: HisabyApp;
  className?: string;
}) {
  const user = useAuthStore((state) => state.user);
  const locale = useLocaleStore((state) => state.locale);
  const permissions = user?.modulePermissions;
  const role = user?.role;
  const english = locale === "en";

  const apps = [
    {
      key: "accounting" as const,
      href: "/dashboard",
      label: english ? "Accounts" : "الحسابات",
      icon: Calculator,
      visible: canOpenAccountingApp(permissions, role),
    },
    {
      key: "pos" as const,
      href: "/pos",
      label: english ? "POS" : "الكاشير",
      icon: ShoppingCart,
      visible: canOpenPosApp(permissions, role),
    },
    {
      key: "resto" as const,
      href: "/resto",
      label: english ? "Restaurant" : "المطعم",
      icon: UtensilsCrossed,
      visible: canOpenRestoApp(permissions, role),
    },
  ].filter((app) => app.visible);

  if (apps.length < 2) return null;

  return (
    <nav
      aria-label={english ? "Switch Hisaby app" : "التنقل بين أنظمة حسابي"}
      className={cn(
        "lg:hidden border-b border-slate-200 bg-white/95 px-2 py-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/95",
        className,
      )}
    >
      <div
        className={cn(
          "mx-auto grid max-w-md gap-2",
          apps.length === 2 ? "grid-cols-2" : "grid-cols-3",
        )}
      >
        {apps.map((app) => {
          const Icon = app.icon;
          const selected = app.key === current;
          return (
            <Link
              key={app.key}
              href={app.href}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-bold transition-colors",
                selected
                  ? activeTone[app.key]
                  : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{app.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
