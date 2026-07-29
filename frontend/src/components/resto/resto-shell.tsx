"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  BarChart3,
  Calculator,
  CalendarDays,
  ChefHat,
  LayoutGrid,
  LogOut,
  Menu,
  Settings2,
  ShoppingBag,
  Soup,
  Store,
  Truck,
  Users,
  UtensilsCrossed,
  BellRing,
  Wallet,
  X,
} from "lucide-react";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { restoCopy } from "@/lib/resto-copy";
import { cn } from "@/lib/utils";
import {
  canAccessModule,
  canOpenAccountingApp,
  canOpenPosApp,
  moduleForRestoPath,
  type ModuleKey,
} from "@/lib/module-permissions";
import { homePathForUser } from "@/lib/user-home";
import { PlanUpgradeGate } from "@/components/billing/plan-upgrade-gate";
import { ShellAlertsBell } from "@/components/shared/shell-alerts-bell";
import { ShellThemeToggle } from "@/components/shared/shell-theme-toggle";

export function RestoShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { user, company, isAuthenticated, logout } = useAuthStore();
  const t = restoCopy[locale === "en" ? "en" : "ar"];
  const [linked, setLinked] = useState<boolean | null>(null);
  const [linkLoadError, setLinkLoadError] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [planOk, setPlanOk] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const isLogin = pathname?.startsWith("/resto/login");
  const perms = user?.modulePermissions;
  const isAdmin = user?.role === "ADMIN";

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
        const [linkRes, subRes] = await Promise.all([
          api.getRestoLinkStatus(),
          api.getCurrentSubscription().catch(() => null),
        ]);
        if (!cancelled) {
          setLinked(true);
          setLinkLoadError(false);
          const features = (subRes?.data as { features?: Record<string, boolean> })
            ?.features;
          setPlanOk(features?.resto !== false);
        }
      } catch (err: unknown) {
        const code = (err as { response?: { data?: { code?: string } } })?.response
          ?.data?.code;
        if (code === "PLAN_FEATURE_REQUIRED") {
          if (!cancelled) setPlanOk(false);
          return;
        }
        if (!cancelled) {
          setLinked(null);
          setLinkLoadError(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, isLogin, router, pathname]);

  const canModule = (module: ModuleKey, needed: "view" | "edit" = "view") =>
    isAdmin || canAccessModule(perms, module, needed);
  const showAccountingNav = canOpenAccountingApp(perms, user?.role);
  const showPosNav = canOpenPosApp(perms, user?.role);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      logout();
    }
    router.push("/resto/login");
  };

  /** Internal sections — not peer buttons next to Accounting/POS */
  const sections = [
    {
      href: "/resto",
      label: t.floor,
      icon: LayoutGrid,
      module: "floor" as ModuleKey,
      active: pathname === "/resto" || pathname?.startsWith("/resto/orders"),
    },
    {
      href: "/resto/takeaway",
      label: t.takeaway,
      icon: ShoppingBag,
      module: "floor" as ModuleKey,
      active: pathname?.startsWith("/resto/takeaway"),
    },
    {
      href: "/resto/delivery",
      label: t.delivery,
      icon: Truck,
      module: "floor" as ModuleKey,
      active: pathname?.startsWith("/resto/delivery"),
    },
    {
      href: "/resto/menu",
      label: t.menu,
      icon: UtensilsCrossed,
      module: "restoMenu" as ModuleKey,
      active: pathname?.startsWith("/resto/menu"),
    },
    {
      href: "/resto/recipes",
      label: t.recipes,
      icon: Soup,
      module: "restoMenu" as ModuleKey,
      active: pathname?.startsWith("/resto/recipes"),
    },
    {
      href: "/resto/kitchen",
      label: t.kitchen,
      icon: ChefHat,
      module: "kitchen" as ModuleKey,
      active: pathname?.startsWith("/resto/kitchen"),
    },
    {
      href: "/resto/expo",
      label: t.expo,
      icon: BellRing,
      module: "expo" as ModuleKey,
      active: pathname?.startsWith("/resto/expo"),
    },
    {
      href: "/resto/reservations",
      label: t.reservations,
      icon: CalendarDays,
      module: "restoReservations" as ModuleKey,
      active: pathname?.startsWith("/resto/reservations"),
    },
    {
      href: "/resto/waitlist",
      label: t.waitlist,
      icon: Users,
      module: "restoReservations" as ModuleKey,
      active: pathname?.startsWith("/resto/waitlist"),
    },
    {
      href: "/resto/board",
      label: t.liveBoard,
      icon: Activity,
      module: "floor" as ModuleKey,
      active: pathname?.startsWith("/resto/board"),
    },
    {
      href: "/resto/reports",
      label: t.reports,
      icon: BarChart3,
      module: "restoReports" as ModuleKey,
      active: pathname?.startsWith("/resto/reports"),
    },
    {
      href: "/resto/contacts",
      label: locale === "en" ? "Contacts" : "دفتر العناوين",
      icon: Users,
      module: "restoContacts" as ModuleKey,
      active: pathname?.startsWith("/resto/contacts"),
    },
    {
      href: "/resto/shifts",
      label: t.shifts,
      icon: Wallet,
      module: "posShifts" as ModuleKey,
      active: pathname?.startsWith("/resto/shifts"),
    },
    {
      href: "/resto/settings",
      label: t.settings,
      icon: Settings2,
      module: "settings" as ModuleKey,
      active: pathname?.startsWith("/resto/settings"),
    },
  ].filter((s) => canModule(s.module, "view"));

  const currentModule = moduleForRestoPath(pathname);
  const blockedByPerm =
    !!currentModule && !isLogin && !canModule(currentModule, "view");

  useEffect(() => {
    if (!hydrated || isLogin || !blockedByPerm) return;
    router.replace(homePathForUser(user));
  }, [hydrated, isLogin, blockedByPerm, router, user]);

  if (isLogin) {
    return (
      <div className="min-h-screen bg-[#14110f] text-stone-100 relative" dir={locale === "en" ? "ltr" : "rtl"}>
        <div className="absolute top-3 end-3 z-50">
          <ShellThemeToggle tone="resto" />
        </div>
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

  if (!planOk && !isLogin) {
    return (
      <div className="min-h-screen bg-[#14110f] text-stone-100 flex items-center justify-center p-6" dir={locale === "en" ? "ltr" : "rtl"}>
        <PlanUpgradeGate
          feature="resto"
          from="/resto"
          title={locale === "en" ? "Restaurants require Enterprise" : "المطاعم ضمن الباقة المؤسسية"}
          description={
            locale === "en"
              ? "Choose a plan, complete payment, and restaurants unlock after the system confirms payment."
              : "اختر باقة وأتمم الدفع — تُفتح المطاعم بعد تأكيد النظام للدفع."
          }
          className="max-w-lg bg-[#1c1814] text-stone-100 border-amber-500/40"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#14110f] text-stone-100" dir={locale === "en" ? "ltr" : "rtl"}>
      <header className="sticky top-0 z-40 border-b border-amber-500/15 bg-[#14110f]/92 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-100 shrink-0"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/hisaby-mark.png"
              alt=""
              className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover shrink-0"
            />
            <div className="min-w-0">
              <p className="font-bold leading-tight truncate text-sm sm:text-base">{t.brand}</p>
              <p className="text-[11px] text-stone-500 truncate hidden sm:block">{company?.name || t.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ShellThemeToggle tone="resto" />
            <ShellAlertsBell
              tone="resto"
              hasAlert={linkLoadError}
              title={t.alertsTitle}
              emptyLabel={t.alertsEmpty}
              items={[
                ...(linkLoadError
                  ? [
                      {
                        id: "resto-link-error",
                        title: t.loadFailed,
                        message: t.retry,
                        href: "/resto/settings",
                        tone: "error" as const,
                      },
                    ]
                  : []),
              ]}
            />
            <div className="hidden lg:flex items-center gap-1 sm:gap-2 min-w-0 max-w-[55vw] overflow-x-auto scrollbar-none">
            {showAccountingNav ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 shrink-0"
            >
              <Calculator className="w-4 h-4" />
              <span>{t.toAccounting}</span>
            </Link>
            ) : null}
            {showPosNav ? (
            <Link
              href="/pos"
              className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-2.5 py-1.5 text-xs font-bold text-sky-300 hover:bg-sky-500/25 shrink-0"
            >
              <Store className="w-4 h-4" />
              <span>{t.toPos}</span>
            </Link>
            ) : null}
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
        </div>

        <nav className="hidden lg:block border-t border-white/5 bg-black/20">
          <div className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-3 py-1.5 sm:px-4 scrollbar-none">
            {sections.map((item) => {
              const Icon = item.icon;
              const viewOnly = canModule(item.module, "view") && !canModule(item.module, "edit");
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
                  title={viewOnly ? (locale === "en" ? "View only" : "عرض فقط") : undefined}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {item.label}
                  {viewOnly ? (
                    <span className="text-[9px] opacity-70">{locale === "en" ? "view" : "عرض"}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>

        {menuOpen ? (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute inset-y-0 start-0 w-[min(20rem,88vw)] bg-[#1c1814] border-e border-amber-500/20 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <div>
                  <p className="font-bold">{t.brand}</p>
                  <p className="text-[11px] text-stone-500 truncate">{company?.name}</p>
                </div>
                <button type="button" onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  {locale === "en" ? "Systems" : "الأنظمة"}
                </p>
                {showAccountingNav ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold bg-emerald-500/10 text-emerald-200"
                >
                  <Calculator className="w-4 h-4" />
                  {t.toAccounting}
                </Link>
                ) : null}
                {showPosNav ? (
                <Link
                  href="/pos"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold bg-sky-500/10 text-sky-200"
                >
                  <Store className="w-4 h-4" />
                  {t.toPos}
                </Link>
                ) : null}
                <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-stone-500">
                  {locale === "en" ? "Restaurants" : "المطاعم"}
                </p>
                {sections.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium",
                        item.active ? "bg-amber-500/20 text-amber-100" : "text-stone-200 hover:bg-white/5",
                      )}
                    >
                      <Icon className="w-4 h-4 text-stone-400" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="p-3 border-t border-white/10 space-y-2">
                <button
                  type="button"
                  onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-stone-300 bg-white/5"
                >
                  {locale === "en" ? "العربية" : "English"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    void handleLogout();
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-rose-300 bg-rose-500/10"
                >
                  <LogOut className="w-4 h-4" />
                  {t.logout}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {blockedByPerm ? (
          <div className="border-t border-rose-500/20 bg-rose-500/10 px-3 py-3 text-center text-xs text-rose-100 sm:text-sm">
            {locale === "en"
              ? "This section is hidden for your account. Ask your company admin to grant access."
              : "هذا القسم مخفي عن حسابك. اطلب من مدير الشركة منحك صلاحية الوصول."}
          </div>
        ) : null}
      </header>
      <main className="mx-auto max-w-[1600px]">
        {blockedByPerm ? (
          <div className="p-6 text-center text-sm text-rose-100">
            {locale === "en"
              ? "Redirecting — this section is not available for your account."
              : "جاري التحويل — هذا القسم غير متاح لحسابك."}
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
