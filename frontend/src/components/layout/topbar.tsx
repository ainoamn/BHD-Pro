"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Search, Moon, Sun, Building2, Globe, LogOut, Menu, Store } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import api from "@/lib/api";
import { NotificationsButton } from "@/components/layout/notifications-button";

export function Topbar() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const { resolvedTheme, setTheme } = useTheme();
  const { setCommandPaletteOpen, toggleSidebar } = useUIStore();
  const { company, logout } = useAuthStore();
  const { locale, setLocale } = useLocaleStore();
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const isDark = resolvedTheme !== "light";

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      logout();
    }
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 h-14 sm:h-16 bg-white/90 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800/50 flex items-center justify-between px-3 sm:px-6 gap-2">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
        <button
          type="button"
          onClick={toggleSidebar}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 shrink-0"
          aria-label="Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div
          className={cn(
            "relative hidden sm:flex items-center transition-all duration-300 min-w-0",
            searchFocused ? "w-full max-w-xs lg:max-w-sm" : "w-48 lg:w-64"
          )}
        >
          <Search className="absolute right-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={t("search") + "..."}
            className="w-full h-9 pr-9 pl-10 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onClick={() => setCommandPaletteOpen(true)}
            readOnly
          />
          <kbd className="absolute left-2 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[10px] text-slate-500 font-mono">
            Ctrl+K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all"
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm">{locale === "ar" ? "ع" : "EN"}</span>
          </button>
          {langOpen && (
            <div className="absolute top-full mt-1 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[140px] z-50">
              <button
                type="button"
                onClick={() => {
                  setLocale("ar");
                  setLangOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2 text-sm text-right hover:bg-slate-100 dark:hover:bg-slate-800",
                  locale === "ar" && "text-emerald-400 bg-emerald-500/10"
                )}
              >
                {t("arabic")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setLocale("en");
                  setLangOpen(false);
                }}
                className={cn(
                  "w-full px-4 py-2 text-sm text-left hover:bg-slate-800",
                  locale === "en" && "text-emerald-400 bg-emerald-500/10"
                )}
              >
                {t("english")}
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? t("lightMode") : t("darkMode")}
          title={isDark ? t("lightMode") : t("darkMode")}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <NotificationsButton />

        <Link
          href="/pos"
          title="Hisaby POS"
          onClick={async (e) => {
            try {
              const res = await api.getPosLinkStatus();
              if (!res.data.linked) {
                await api.activatePosLink();
              }
            } catch {
              /* POS shell will show link status */
            }
          }}
          className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-700 dark:text-sky-300 hover:bg-sky-500/20 text-xs font-bold transition-all"
        >
          <Store className="w-4 h-4" />
          POS
        </Link>

        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg max-w-[140px] lg:max-w-none">
          <Building2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
          <span className="text-sm text-slate-900 dark:text-white font-medium truncate">{company?.name || "—"}</span>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          title={tAuth("logout")}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-rose-400 hover:bg-slate-700/50 transition-all"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
