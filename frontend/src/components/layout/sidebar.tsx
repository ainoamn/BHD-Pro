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
  Brain,
  Settings,
  Crown,
  Shield,
  Lock,
  Percent,
  KeyRound,
  FileStack,
  FormInput,
  ArrowLeftRight,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "dashboard" },
  { href: "/sales", icon: FileText, label: "sales" },
  { href: "/purchases", icon: Receipt, label: "purchases" },
  { href: "/accounting", icon: Calculator, label: "accounting" },
  { href: "/chart-of-accounts", icon: Network, label: "chartOfAccounts" },
  { href: "/journal", icon: BookOpen, label: "journal" },
  { href: "/bank-accounts", icon: Landmark, label: "bankAccounts" },
  { href: "/cost-centers", icon: Target, label: "costCenters" },
  { href: "/branches", icon: Building2, label: "branches" },
  { href: "/projects", icon: FolderKanban, label: "projects" },
  { href: "/assets", icon: HardDrive, label: "assets" },
  { href: "/employees", icon: UserCircle, label: "employees" },
  { href: "/employee-claims", icon: Wallet, label: "employeeClaims" },
  { href: "/inventory", icon: Package, label: "inventory" },
  { href: "/delivery-notes", icon: Truck, label: "deliveryNotes" },
  { href: "/stock-counts", icon: ClipboardList, label: "stockCounts" },
  { href: "/warehouses", icon: Warehouse, label: "warehouses" },
  { href: "/contacts", icon: Users, label: "addressBook" },
  { href: "/reports", icon: BarChart3, label: "reports" },
  { href: "/vat", icon: Receipt, label: "vat" },
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
  { href: "/subscription", icon: Crown, label: "subscription" },
  { href: "/users", icon: Shield, label: "users" },
];

export function Sidebar() {
  const t = useTranslations("nav");
  const tApp = useTranslations("app");
  const pathname = usePathname();
  const { sidebarCollapsed, sidebarOpen, toggleSidebarCollapse, setSidebarOpen } = useUIStore();
  const { user } = useAuthStore();

  const closeMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  return (
    <aside
      className={cn(
        "fixed right-0 top-0 h-screen bg-slate-900/95 backdrop-blur-xl border-l border-slate-800/50 z-50 transition-all duration-300 ease-in-out flex flex-col",
        sidebarCollapsed ? "w-20 lg:w-20" : "w-72",
        sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex items-center gap-3 px-5 py-6 border-b border-slate-800/50 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        {!sidebarCollapsed && (
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">{tApp("name")}</h1>
            <p className="text-xs text-slate-400 truncate">{tApp("tagline")}</p>
          </div>
        )}
      </div>

      <nav className="px-3 py-4 space-y-1 flex-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 border-r-2 border-emerald-500"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
              )}
            >
              <Icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-emerald-400")} />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{t(item.label)}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <nav className="px-3 py-4 space-y-1 border-t border-slate-800/50 shrink-0">
        {settingsItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeMobile}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                isActive
                  ? "bg-emerald-500/10 text-emerald-400"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/50"
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

      <div className="shrink-0 p-4 border-t border-slate-800/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
            {user?.name?.charAt(0) || "م"}
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || "—"}</p>
              <p className="text-xs text-slate-400 truncate">
                {user?.role === "ADMIN" ? "Admin" : "Accountant"}
              </p>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={toggleSidebarCollapse}
        className="hidden lg:flex absolute -left-3 top-20 w-6 h-6 bg-slate-800 border border-slate-700 rounded-full items-center justify-center text-slate-400 hover:text-white transition-colors"
      >
        {sidebarCollapsed ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>
    </aside>
  );
}
