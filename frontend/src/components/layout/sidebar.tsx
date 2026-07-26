"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  FileText,
  BookOpen,
  Package,
  Users,
  BarChart3,
  Receipt,
  Settings,
  Crown,
  Shield,
  Lock,
  Percent,
  KeyRound,
  FileStack,
  FormInput,
  ArrowLeftRight,
  RefreshCcw,
  ChevronLeft,
  ChevronRight,
  Calculator,
  Network,
  Landmark,
  Target,
  Building2,
  FolderKanban,
  HardDrive,
  UserCircle,
  Wallet,
  Warehouse,
  Truck,
  ClipboardList,
  ShieldAlert,
  MessageCircle,
  Brain,
  Store,
  UtensilsCrossed,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { UpgradeBadge } from "@/components/billing/plan-upgrade-gate";
import {
  rememberUpgradeIntent,
  subscriptionUpgradeHref,
  type UpgradeFeatureKey,
} from "@/lib/plan-upgrade";
import {
  findPlanModule,
  moduleCodeByHref,
  type PlanModuleGrant,
} from "@/lib/plan-access-catalog";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "dashboard" },
  { href: "/sales", icon: FileText, label: "sales" },
  { href: "/purchases", icon: Receipt, label: "purchases" },
  { href: "/accounting", icon: Calculator, label: "accounting" },
  { href: "/reports", icon: BarChart3, label: "reports" },
  { href: "/chart-of-accounts", icon: Network, label: "chartOfAccounts" },
  { href: "/journal", icon: BookOpen, label: "journal" },
  { href: "/bank-accounts", icon: Landmark, label: "bankAccounts" },
  { href: "/cost-centers", icon: Target, label: "costCenters" },
  { href: "/branches", icon: Building2, label: "branches" },
  { href: "/projects", icon: FolderKanban, label: "projects" },
  { href: "/assets", icon: HardDrive, label: "assets" },
  { href: "/employees", icon: UserCircle, label: "employees" },
  { href: "/employee-claims", icon: Wallet, label: "employeeClaims" },
  { href: "/commitments", icon: RefreshCcw, label: "commitments" },
  { href: "/management-alerts", icon: ShieldAlert, label: "managementAlerts" },
  { href: "/inventory", icon: Package, label: "inventory" },
  { href: "/delivery-notes", icon: Truck, label: "deliveryNotes" },
  { href: "/stock-counts", icon: ClipboardList, label: "stockCounts" },
  { href: "/warehouses", icon: Warehouse, label: "warehouses" },
  { href: "/contacts", icon: Users, label: "addressBook" },
  { href: "/vat", icon: Receipt, label: "vat" },
  { href: "/integrations", icon: MessageCircle, label: "integrations" },
  { href: "/ai-analytics", icon: Brain, label: "aiAnalytics" },
];

const settingsItems = [
  { href: "/settings", icon: Settings, label: "settings" },
  { href: "/period-locks", icon: Lock, label: "periodLocks" },
  { href: "/tax-rates", icon: Percent, label: "taxRates" },
  { href: "/api-keys", icon: KeyRound, label: "apiKeys" },
  { href: "/document-templates", icon: FileStack, label: "documentTemplates" },
  { href: "/custom-fields", icon: FormInput, label: "customFields" },
  { href: "/exchange-rates", icon: ArrowLeftRight, label: "exchangeRates" },
  { href: "/fx-revaluation", icon: RefreshCcw, label: "fxRevaluation" },
  { href: "/subscription", icon: Crown, label: "subscription" },
  { href: "/users", icon: Shield, label: "users" },
];

export function Sidebar() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarOpen, toggleSidebarCollapse, setSidebarOpen } = useUIStore();
  const { user } = useAuthStore();
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [features, setFeatures] = useState<Record<string, boolean>>({
    pos: true,
    resto: true,
    aiAnalytics: true,
    apiKeys: true,
    multiBranch: true,
    advancedReports: true,
  });
  const [modules, setModules] = useState<Record<string, PlanModuleGrant> | null>(
    null,
  );

  const isModuleOpen = (code: string, legacyFallback?: boolean) => {
    const grant = modules?.[code];
    if (grant) return grant.enabled !== false;
    if (legacyFallback !== undefined) return legacyFallback;
    return true;
  };

  const lockForHref = (
    href: string,
  ): { code: string; upgradeKey: UpgradeFeatureKey | string } | null => {
    const code = moduleCodeByHref(href);
    if (!code) return null;
    if (isModuleOpen(code)) return null;
    const mod = findPlanModule(code);
    const legacy = mod?.legacyFeature;
    const upgradeKey =
      legacy === "pos" ||
      legacy === "resto" ||
      legacy === "aiAnalytics" ||
      legacy === "multiBranch" ||
      legacy === "apiKeys" ||
      legacy === "advancedReports"
        ? legacy
        : code;
    return { code, upgradeKey };
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getAdminMe();
        if (!cancelled) setIsPlatformAdmin(!!res.data.isPlatformAdmin);
      } catch {
        if (!cancelled) setIsPlatformAdmin(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.email]);

  useEffect(() => {
    let cancelled = false;
    if (!user) return;
    (async () => {
      try {
        const res = await api.getCurrentSubscription();
        const data = res.data as {
          features?: Record<string, boolean>;
          modules?: Record<string, PlanModuleGrant>;
        };
        if (!cancelled) {
          if (data.features) setFeatures((prev) => ({ ...prev, ...data.features }));
          if (data.modules) setModules(data.modules);
        }
      } catch {
        /* keep defaults until subscription loads */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setOpenAlerts(0);
      return;
    }
    (async () => {
      try {
        const res = await api.getManagementAlerts("OPEN");
        const rows = res.data as unknown[];
        if (!cancelled) setOpenAlerts(Array.isArray(rows) ? rows.length : 0);
      } catch {
        if (!cancelled) setOpenAlerts(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, pathname]);

  const closeMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 h-screen bg-white dark:bg-slate-900/95 backdrop-blur-xl border-l border-slate-200 dark:border-slate-800/50 z-50 transition-all duration-300 ease-in-out flex flex-col",
        sidebarCollapsed ? "w-20 lg:w-20" : "w-72",
        sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-200 dark:border-slate-800/50 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white truncate">{tApp("name")}</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{tApp("tagline")}</p>
          </div>
        )}
      </div>

      <div className="px-3 pt-3 shrink-0 space-y-2">
        {isModuleOpen("pos", features.pos !== false) ? (
          <Link
            href="/pos"
            onClick={() => {
              closeMobile();
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 hover:bg-sky-500/20 transition-all",
              sidebarCollapsed && "justify-center px-2"
            )}
          >
            <Store className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-sm font-bold">الكاشير / POS</span>
            )}
          </Link>
        ) : (
          <Link
            href={subscriptionUpgradeHref("pos", "/pos")}
            onClick={() => {
              rememberUpgradeIntent("pos", "/pos");
              closeMobile();
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/40 hover:text-amber-700 transition-all",
              sidebarCollapsed && "justify-center px-2"
            )}
            title="يتطلب ترقية الباقة"
          >
            {sidebarCollapsed ? (
              <UpgradeBadge iconOnly />
            ) : (
              <>
                <Lock className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold flex-1">الكاشير / POS</span>
                <UpgradeBadge />
              </>
            )}
          </Link>
        )}
        {isModuleOpen("resto", features.resto !== false) ? (
          <Link
            href="/resto"
            onClick={() => {
              closeMobile();
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 hover:bg-amber-500/20 transition-all",
              sidebarCollapsed && "justify-center px-2"
            )}
          >
            <UtensilsCrossed className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && (
              <span className="text-sm font-bold">المطاعم</span>
            )}
          </Link>
        ) : (
          <Link
            href={subscriptionUpgradeHref("resto", "/resto")}
            onClick={() => {
              rememberUpgradeIntent("resto", "/resto");
              closeMobile();
            }}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/60 text-slate-500 border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500/40 hover:text-amber-700 transition-all",
              sidebarCollapsed && "justify-center px-2"
            )}
            title="يتطلب الباقة المؤسسية"
          >
            {sidebarCollapsed ? (
              <UpgradeBadge iconOnly />
            ) : (
              <>
                <Lock className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-bold flex-1">المطاعم</span>
                <UpgradeBadge />
              </>
            )}
          </Link>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <nav className="px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const locked = lockForHref(item.href);
            const isActive =
              !locked &&
              (pathname === item.href || pathname.startsWith(item.href + "/"));
            const Icon = item.icon;
            if (locked) {
              const upgradeKey = locked.upgradeKey;
              const known =
                upgradeKey === "pos" ||
                upgradeKey === "resto" ||
                upgradeKey === "aiAnalytics" ||
                upgradeKey === "multiBranch" ||
                upgradeKey === "apiKeys" ||
                upgradeKey === "advancedReports"
                  ? (upgradeKey as UpgradeFeatureKey)
                  : null;
              return (
                <Link
                  key={item.href}
                  href={subscriptionUpgradeHref(upgradeKey, item.href)}
                  onClick={() => {
                    rememberUpgradeIntent(known, item.href);
                    closeMobile();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-400 border border-dashed border-transparent hover:border-amber-500/30 hover:bg-amber-500/5 hover:text-amber-700 dark:hover:text-amber-300",
                    sidebarCollapsed && "justify-center px-2",
                  )}
                  title="يتطلب ترقية الباقة"
                >
                  {sidebarCollapsed ? (
                    <UpgradeBadge iconOnly />
                  ) : (
                    <>
                      <Lock className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium flex-1">{t(item.label)}</span>
                      <UpgradeBadge />
                    </>
                  )}
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-500"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                )}
              >
                <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-emerald-400")} />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium flex-1">{t(item.label)}</span>
                )}
                {!sidebarCollapsed && item.href === "/management-alerts" && openAlerts > 0 && (
                  <span className="text-[10px] min-w-[1.25rem] h-5 px-1.5 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    {openAlerts > 99 ? "99+" : openAlerts}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <nav className="px-3 py-4 space-y-1 border-t border-slate-200 dark:border-slate-800/50">
          {isPlatformAdmin && (
            <Link
              href="/admin"
              prefetch
              onClick={closeMobile}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                pathname.startsWith("/admin")
                  ? "bg-amber-500/10 text-amber-400"
                  : "text-amber-700 dark:text-amber-400/80 hover:bg-amber-500/10"
              )}
            >
              <ShieldAlert className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">إدارة المنصة</span>
              )}
            </Link>
          )}
          {settingsItems.map((item) => {
            const locked = lockForHref(item.href);
            const isActive = !locked && pathname === item.href;
            const Icon = item.icon;
            if (locked) {
              const upgradeKey = locked.upgradeKey;
              const known =
                upgradeKey === "apiKeys" ||
                upgradeKey === "advancedReports" ||
                upgradeKey === "multiBranch" ||
                upgradeKey === "aiAnalytics" ||
                upgradeKey === "pos" ||
                upgradeKey === "resto"
                  ? (upgradeKey as UpgradeFeatureKey)
                  : null;
              return (
                <Link
                  key={item.href}
                  href={subscriptionUpgradeHref(upgradeKey, item.href)}
                  onClick={() => {
                    rememberUpgradeIntent(known, item.href);
                    closeMobile();
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-slate-400 border border-dashed border-transparent hover:border-amber-500/30 hover:bg-amber-500/5",
                    sidebarCollapsed && "justify-center px-2",
                  )}
                  title="يتطلب ترقية الباقة"
                >
                  {sidebarCollapsed ? (
                    <UpgradeBadge iconOnly />
                  ) : (
                    <>
                      <Lock className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm font-medium flex-1">{t(item.label)}</span>
                      <UpgradeBadge />
                    </>
                  )}
                </Link>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={closeMobile}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                  isActive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50"
                )}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {!sidebarCollapsed && (
                  <span className="text-sm font-medium">{t(item.label)}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="shrink-0 p-4 border-t border-slate-200 dark:border-slate-800/50">
        <div className="flex items-center gap-3">
          {user?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatar}
              alt=""
              className="w-9 h-9 rounded-lg object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
              {user?.name?.charAt(0) || "م"}
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{user?.name || "—"}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user?.email || (user?.role === "ADMIN" ? "Admin" : "Accountant")}
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={toggleSidebarCollapse}
        className="hidden lg:flex absolute -left-3 top-20 w-6 h-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
      >
        {sidebarCollapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </aside>
  );
}
