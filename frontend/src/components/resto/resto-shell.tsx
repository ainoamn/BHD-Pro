"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  Calculator,
  CalendarDays,
  ChefHat,
  LayoutGrid,
  Link2,
  Link2Off,
  LogOut,
  Settings2,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { cn } from "@/lib/utils";

export function RestoShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { company, isAuthenticated, logout } = useAuthStore();
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [linked, setLinked] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const isLogin = pathname?.startsWith("/resto/login");

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || isLogin) return;
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) {
        const ok = await api.restoreSession();
        if (!ok && !cancelled) {
          router.replace("/resto/login");
          return;
        }
      }
      try {
        const res = await api.getRestoLinkStatus();
        if (!cancelled) setLinked(!!res.data.linked);
      } catch {
        if (!cancelled) setLinked(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, isLogin, router, pathname]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      logout();
    }
    router.push("/resto/login");
  };

  if (isLogin) {
    return (
      <div className="min-h-screen bg-[#14110f] text-stone-100" dir={locale === "en" ? "ltr" : "rtl"}>
        {children}
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#14110f] flex items-center justify-center text-stone-400 text-sm">
        …
      </div>
    );
  }

  /** Internal sections — not peer buttons next to Accounting/POS */
  const sections = [
    {
      href: "/resto",
      label: t.floor,
      icon: LayoutGrid,
      active: pathname === "/resto" || pathname?.startsWith("/resto/orders"),
    },
    {
      href: "/resto/menu",
      label: t.menu,
      icon: UtensilsCrossed,
      active: pathname?.startsWith("/resto/menu"),
    },
    {
      href: "/resto/kitchen",
      label: t.kitchen,
      icon: ChefHat,
      active: pathname?.startsWith("/resto/kitchen"),
    },
    {
      href: "/resto/reservations",
      label: t.reservations,
      icon: CalendarDays,
      active: pathname?.startsWith("/resto/reservations"),
    },
    {
      href: "/resto/reports",
      label: t.reports,
      icon: BarChart3,
      active: pathname?.startsWith("/resto/reports"),
    },
    {
      href: "/resto/settings",
      label: t.settings,
      icon: Settings2,
      active: pathname?.startsWith("/resto/settings"),
    },
  ];

  return (
    <div className="min-h-screen bg-[#14110f] text-stone-100" dir={locale === "en" ? "ltr" : "rtl"}>
      <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-[#14110f]/92 backdrop-blur-xl">
        {/* App switcher row — one button per product */}
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/hisaby-mark.png"
              alt=""
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0 hidden sm:block">
              <p className="font-bold leading-tight truncate text-sm sm:text-base">{t.brand}</p>
              <p className="text-[11px] text-stone-500 truncate">{company?.name || t.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 shrink-0"
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">{t.toAccounting}</span>
            </Link>
            <Link
              href="/pos"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-2.5 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25 shrink-0"
            >
              <Store className="w-4 h-4" />
              <span className="hidden sm:inline">{t.toPos}</span>
            </Link>
            <Link
              href="/resto"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/25 px-2.5 py-1.5 text-xs font-bold text-amber-100 ring-1 ring-amber-400/40 shrink-0"
              title={t.brand}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span>{t.openRestoShort}</span>
            </Link>
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="rounded-lg px-2 py-1.5 text-xs font-bold text-stone-400 hover:bg-white/5 shrink-0"
            >
              {locale === "en" ? "ع" : "EN"}
            </button>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-400 hover:bg-white/5 shrink-0"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Internal resto sections */}
        <nav className="border-t border-white/5 bg-black/20">
          <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-3 py-1.5 sm:px-4 scrollbar-none">
            {sections.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap shrink-0 transition",
                    item.active
                      ? "bg-amber-500/20 text-amber-100"
                      : "text-stone-400 hover:bg-white/5 hover:text-stone-200",
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>

        {linked === false ? (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-100 sm:text-sm">
            <Link2Off className="inline w-3.5 h-3.5 me-1.5 align-text-bottom" />
            {t.linkBanner}{" "}
            <Link href="/resto/settings" className="font-bold underline underline-offset-2">
              {t.settings}
            </Link>
          </div>
        ) : linked === true ? (
          <div className="border-t border-emerald-500/15 bg-emerald-500/5 px-3 py-1 text-center text-[11px] text-emerald-200/80">
            <Link2 className="inline w-3 h-3 me-1 align-text-bottom" />
            {t.linked}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-[1600px]">{children}</main>
    </div>
  );
}
