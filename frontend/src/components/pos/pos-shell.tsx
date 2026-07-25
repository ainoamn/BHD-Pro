"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Calculator,
  Clock3,
  CloudUpload,
  Link2,
  Link2Off,
  LogOut,
  Package,
  Settings2,
  ShieldCheck,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { flushPendingPosSales, pendingSalesCount } from "@/lib/pos-offline-sync";

export function PosShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { user, company, isAuthenticated, logout } = useAuthStore();
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [linked, setLinked] = useState<boolean | null>(null);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const isLogin = pathname?.startsWith("/pos/login");
  const canSeeApprovals = user?.role === "ADMIN" || user?.role === "MANAGER";

  const refreshPending = useCallback(async () => {
    try {
      const n = await pendingSalesCount();
      setPendingCount(n);
    } catch {
      setPendingCount(0);
    }
  }, []);

  const runFlush = useCallback(
    async (silent = false) => {
      if (syncing) return;
      setSyncing(true);
      try {
        const result = await flushPendingPosSales();
        await refreshPending();
        if (result.synced > 0) {
          toast.success(t.syncOk);
        } else if (result.failed && !silent) {
          toast.error(t.syncFail);
        }
      } catch {
        if (!silent) toast.error(t.syncFail);
      } finally {
        setSyncing(false);
      }
    },
    [refreshPending, syncing, t.syncFail, t.syncOk],
  );

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || isLogin) return;
    void refreshPending();
    const onOnline = () => {
      void runFlush(true);
    };
    window.addEventListener("online", onOnline);
    const id = window.setInterval(() => void refreshPending(), 15000);
    return () => {
      window.removeEventListener("online", onOnline);
      window.clearInterval(id);
    };
  }, [hydrated, isLogin, refreshPending, runFlush]);

  useEffect(() => {
    if (!hydrated || isLogin) return;
    let cancelled = false;
    (async () => {
      if (!isAuthenticated) {
        const ok = await api.restoreSession();
        if (!ok && !cancelled) {
          router.replace("/pos/login");
          return;
        }
      }
      try {
        const res = await api.getPosLinkStatus();
        if (!cancelled) setLinked(!!res.data.linked);
        if (!res.data.linked) {
          await api.activatePosLink();
          if (!cancelled) setLinked(true);
        }
      } catch {
        if (!cancelled) setLinked(false);
      }
      try {
        let wh = "";
        try {
          wh = localStorage.getItem("hisaby-pos-warehouse-id") || "";
        } catch {
          /* ignore */
        }
        const shiftRes = await api.getCurrentPosShift(wh || undefined);
        if (!cancelled) setShiftOpen(!!shiftRes.data.shift);
      } catch {
        if (!cancelled) setShiftOpen(false);
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
    router.push("/pos/login");
  };

  const goAccounting = () => {
    if (linked === false) {
      toast.error(t.unlinked);
    }
    router.push("/dashboard");
  };

  if (isLogin) {
    return (
      <div className="min-h-screen bg-[#0b1220] text-slate-100" dir={locale === "en" ? "ltr" : "rtl"}>
        {children}
      </div>
    );
  }

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#0b1220] flex items-center justify-center text-slate-400 text-sm">
        …
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100" dir={locale === "en" ? "ltr" : "rtl"}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/hisaby-mark.png" alt="" className="h-9 w-9 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="font-bold leading-tight truncate">{t.brand}</p>
              <p className="text-[11px] text-slate-500 truncate">{company?.name || t.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {pendingCount > 0 ? (
              <button
                type="button"
                onClick={() => void runFlush(false)}
                disabled={syncing}
                title={t.pendingOffline}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 disabled:opacity-50"
              >
                <CloudUpload className="w-4 h-4" />
                <span className="tabular-nums">{pendingCount}</span>
                <span className="hidden sm:inline">{t.syncNow}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/5"
            >
              {locale === "en" ? "ع" : "EN"}
            </button>
            <Link
              href="/inventory"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
              title={t.inventory}
            >
              <Package className="w-4 h-4" />
              <span className="hidden sm:inline">{t.inventory}</span>
            </Link>
            <Link
              href="/pos/shifts"
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-sky-500/10 ${
                shiftOpen ? "text-emerald-300" : "text-sky-200/90"
              }`}
              title={t.shifts}
            >
              <Clock3 className="w-4 h-4" />
              <span className="hidden sm:inline">
                {shiftOpen ? t.shiftOpen : t.shifts}
              </span>
            </Link>
            {canSeeApprovals ? (
              <Link
                href="/pos/approvals"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-200/90 hover:bg-amber-500/10"
                title={t.approvals}
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">{t.approvals}</span>
              </Link>
            ) : null}
            <Link
              href="/pos/settings"
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5"
            >
              <Settings2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t.settings}</span>
            </Link>
            <button
              type="button"
              onClick={goAccounting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
            >
              <Calculator className="w-4 h-4" />
              <span className="hidden sm:inline">{t.toAccounting}</span>
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {linked === false && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100 flex items-center justify-center gap-2">
            <Link2Off className="w-3.5 h-3.5 shrink-0" />
            <span>{t.unlinked}</span>
            <Link href="/pos/settings" className="font-bold underline underline-offset-2">
              {t.settings}
            </Link>
          </div>
        )}
        {linked === true && (
          <div className="border-t border-emerald-500/10 bg-emerald-500/5 px-4 py-1 text-center text-[11px] text-emerald-300/80 flex items-center justify-center gap-1.5">
            <Link2 className="w-3 h-3" />
            {t.linked}
            {user?.email ? ` · ${user.email}` : ""}
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1600px]">{children}</main>
    </div>
  );
}
