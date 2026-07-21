"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Bell, Moon, Sun, Building2, ChevronDown, Globe, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import api from "@/lib/api";

export function Topbar() {
  const t = useTranslations("common");
  const tAuth = useTranslations("auth");
  const { theme, setTheme } = useTheme();
  const { setCommandPaletteOpen } = useUIStore();
  const { company, logout } = useAuthStore();
  const { locale, setLocale } = useLocaleStore();
  const router = useRouter();
  const [searchFocused, setSearchFocused] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      logout();
    }
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-40 h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800/50 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <div
          className={cn(
            "relative flex items-center transition-all duration-300",
            searchFocused ? "w-80" : "w-64"
          )}
        >
          <Search className="absolute right-3 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder={t("search") + "..."}
            className="w-full h-9 pr-9 pl-10 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            onClick={() => setCommandPaletteOpen(true)}
            readOnly
          />
          <kbd className="absolute left-2 px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-500 font-mono">
            Ctrl+K
          </kbd>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Language Switcher */}
        <div className="relative">
          <button
            onClick={() => setLangOpen(!langOpen)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
          >
            <Globe className="w-4 h-4" />
            <span className="text-sm">{locale === "ar" ? "ع" : "EN"}</span>
          </button>
          {langOpen && (
            <div className="absolute top-full mt-1 left-0 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden min-w-[140px] z-50">
              <button
                onClick={() => { setLocale("ar"); setLangOpen(false); }}
                className={cn("w-full px-4 py-2 text-sm text-right hover:bg-slate-800", locale === "ar" && "text-emerald-400 bg-emerald-500/10")}
              >
                {t("arabic")}
              </button>
              <button
                onClick={() => { setLocale("en"); setLangOpen(false); }}
                className={cn("w-full px-4 py-2 text-sm text-left hover:bg-slate-800", locale === "en" && "text-emerald-400 bg-emerald-500/10")}
              >
                {t("english")}
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700/50 transition-all">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 left-1.5 w-2 h-2 bg-rose-500 rounded-full animate-pulse" />
        </button>

        <button className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg hover:bg-slate-700/50 transition-all">
          <Building2 className="w-4 h-4 text-emerald-400" />
          <span className="text-sm text-white font-medium">{company?.name || "—"}</span>
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </button>

        <button
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
