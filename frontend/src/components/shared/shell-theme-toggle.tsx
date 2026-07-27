"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocaleStore } from "@/store/locale";

type Tone = "pos" | "resto";

/**
 * Theme toggle for POS / restaurant shells (accounting already has one in Topbar).
 * Shares next-themes key `bhd-theme` so the choice follows the user across apps.
 */
export function ShellThemeToggle({ tone = "pos" }: { tone?: Tone }) {
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocaleStore((s) => s.locale);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = !mounted || resolvedTheme !== "light";
  const label =
    locale === "en"
      ? isDark
        ? "Light mode"
        : "Dark mode"
      : isDark
        ? "الوضع النهاري"
        : "الوضع الليلي";

  const btnClass =
    tone === "resto"
      ? "w-9 h-9 flex items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/25 text-amber-800 hover:bg-amber-500/35 shrink-0 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
      : "w-9 h-9 flex items-center justify-center rounded-xl border border-sky-500/40 bg-sky-500/25 text-sky-800 hover:bg-sky-500/35 shrink-0 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-100 dark:hover:bg-sky-500/20";


  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={btnClass}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
