"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Calculator,
  Clock3,
  CloudUpload,
  Loader2,
  LogOut,
  Menu,
  Package,
  Settings2,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { canAccessModule, moduleForPosPath, canOpenAccountingApp, canOpenRestoApp, type ModuleKey } from "@/lib/module-permissions";
import { homePathForUser } from "@/lib/user-home";
import { flushPendingPosSales, pendingAllCount, quarantinedAllCount, discardAllQuarantined } from "@/lib/pos-offline-sync";
import { toastFlushCustomerNotify } from "@/lib/pos-notify-toast";
import {
  listPendingOps,
  listPendingSales,
  removePendingOp,
  removePendingSale,
  type PendingPosOp,
  type PendingPosSale,
} from "@/lib/pos-offline-queue";
import { playPosAlertBeep } from "@/lib/pos-beep";
import { PosCommissionChip } from "@/components/pos/pos-commission-chip";
import { ShellAlertsBell } from "@/components/shared/shell-alerts-bell";
import { ShellThemeToggle } from "@/components/shared/shell-theme-toggle";
import {
  DualApprovalModal,
  type DualApprovalPayload,
} from "@/components/security/dual-approval-modal";
import { PlanUpgradeGate } from "@/components/billing/plan-upgrade-gate";

const VOID_ALERT_KEY = "hisaby-pos-void-alert-day";
const TRAINING_KEY = "hisaby-pos-training";

export function PosShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { user, company, isAuthenticated, logout } = useAuthStore();
  const perms = user?.modulePermissions;
  const t = posCopy[locale === "en" ? "en" : "ar"];
  const [linked, setLinked] = useState<boolean | null>(null);
  const [linkLoadError, setLinkLoadError] = useState(false);
  const [planOk, setPlanOk] = useState(true);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [quarantineCount, setQuarantineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSales, setQueueSales] = useState<PendingPosSale[]>([]);
  const [queueOps, setQueueOps] = useState<PendingPosOp[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueLoadError, setQueueLoadError] = useState(false);
  const [idleLockMinutes, setIdleLockMinutes] = useState(0);
  const [allowTrainingMode, setAllowTrainingMode] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const isLogin = pathname?.startsWith("/pos/login");
  const isCustomerDisplay = pathname?.startsWith("/pos/display");
  const bareShell = isLogin || isCustomerDisplay;
  const canSeeApprovals = user?.role === "ADMIN" || user?.role === "MANAGER";
  const canModule = useCallback(
    (module: ModuleKey, needed: "view" | "edit" = "view") =>
      user?.role === "ADMIN" || canAccessModule(perms, module, needed),
    [perms, user?.role],
  );
  const showAccountingNav =
    canOpenAccountingApp(perms, user?.role) || canModule("posBooks", "view");
  const showRestoNav = canOpenRestoApp(perms, user?.role);

  const refreshPending = useCallback(async () => {
    try {
      const [n, q] = await Promise.all([pendingAllCount(), quarantinedAllCount()]);
      setPendingCount(n);
      setQuarantineCount(q);
    } catch {
      /* keep prior counts — do not pretend the offline queue is empty */
    }
  }, []);

  const loadQueueDetail = useCallback(async () => {
    setQueueLoading(true);
    setQueueLoadError(false);
    try {
      const [sales, ops] = await Promise.all([listPendingSales(), listPendingOps()]);
      setQueueSales(sales);
      setQueueOps(ops);
      setQueueLoadError(false);
    } catch {
      setQueueSales([]);
      setQueueOps([]);
      setQueueLoadError(true);
    } finally {
      setQueueLoading(false);
    }
  }, []);

  const openQueue = useCallback(() => {
    setQueueOpen(true);
    void loadQueueDetail();
  }, [loadQueueDetail]);

  const runFlush = useCallback(
    async (silent = false) => {
      if (syncing) return;
      setSyncing(true);
      try {
        const result = await flushPendingPosSales();
        await refreshPending();
        if (queueOpen) await loadQueueDetail();
        if (result.synced > 0 && result.remaining === 0 && result.quarantined === 0) {
          toast.success(t.syncOk);
          toastFlushCustomerNotify(result.notifyAgg, t);
        } else if (result.synced > 0 && (result.remaining > 0 || result.quarantined > 0)) {
          if (!silent) toast.error(t.syncPartial);
          toastFlushCustomerNotify(result.notifyAgg, t);
        } else if (result.failed && !silent) {
          toast.error(t.syncFail);
        }
      } catch {
        if (!silent) toast.error(t.syncFail);
      } finally {
        setSyncing(false);
      }
    },
    [loadQueueDetail, queueOpen, refreshPending, syncing, t.syncFail, t.syncOk, t.syncPartial],
  );

  const discardQuarantine = useCallback(async () => {
    try {
      const n = await discardAllQuarantined();
      await refreshPending();
      if (queueOpen) await loadQueueDetail();
      if (n > 0) toast.success(t.quarantineDiscardOk);
    } catch {
      toast.error(t.syncFail);
    }
  }, [loadQueueDetail, queueOpen, refreshPending, t.quarantineDiscardOk, t.syncFail]);

  const discardOne = useCallback(
    async (kind: "sale" | "op", id: string) => {
      try {
        if (kind === "sale") await removePendingSale(id);
        else await removePendingOp(id);
        await refreshPending();
        await loadQueueDetail();
      } catch {
        toast.error(t.syncFail);
      }
    },
    [loadQueueDetail, refreshPending, t.syncFail],
  );
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || bareShell) return;
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
  }, [hydrated, bareShell, refreshPending, runFlush]);

  useEffect(() => {
    if (!hydrated || bareShell || !canSeeApprovals) return;
    let cancelled = false;
    const checkVoids = async () => {
      try {
        const [statsRes, secRes] = await Promise.all([
          api.getPosTodayStats(),
          api.getCompanySecurity(),
        ]);
        if (cancelled) return;
        const cfg = secRes.data as {
          voidAlertEnabled?: boolean;
          voidAlertThreshold?: number;
        };
        if (cfg.voidAlertEnabled === false) return;
        const threshold =
          typeof cfg.voidAlertThreshold === "number" && cfg.voidAlertThreshold >= 0
            ? cfg.voidAlertThreshold
            : 3;
        const stats = statsRes.data as {
          voidCount?: number;
          salesCount?: number;
        };
        const voids = Number(stats.voidCount) || 0;
        const sales = Number(stats.salesCount) || 0;
        const overCount = voids > threshold;
        const overRate = sales > 0 && voids / sales > 0.1;
        if (!overCount && !overRate) return;
        const dayKey = new Date().toISOString().slice(0, 10);
        try {
          if (localStorage.getItem(VOID_ALERT_KEY) === dayKey) return;
          localStorage.setItem(VOID_ALERT_KEY, dayKey);
        } catch {
          /* ignore */
        }
        playPosAlertBeep();
        toast.error(
          `${t.voidAlertToast}: ${voids}${sales ? ` / ${sales}` : ""}`,
          { duration: 6000 },
        );
      } catch {
        /* ignore */
      }
    };
    void checkVoids();
    const id = window.setInterval(() => void checkVoids(), 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [hydrated, bareShell, canSeeApprovals, t.voidAlertToast]);

  useEffect(() => {
    if (!hydrated || bareShell) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCompanySecurity();
        const d = res.data as {
          idleLockMinutes?: number;
          allowTrainingMode?: boolean;
        };
        if (!cancelled) {
          setIdleLockMinutes(
            typeof d.idleLockMinutes === "number" ? d.idleLockMinutes : 0,
          );
          setAllowTrainingMode(d.allowTrainingMode !== false);
        }
      } catch {
        /* ignore */
      }
      try {
        const on = sessionStorage.getItem(TRAINING_KEY) === "1";
        if (!cancelled) setTrainingMode(on);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, bareShell, pathname]);

  useEffect(() => {
    if (!hydrated || bareShell || idleLockMinutes <= 0 || locked) return;
    let timer: number | null = null;
    const bump = () => {
      if (timer != null) window.clearTimeout(timer);
      timer = window.setTimeout(
        () => {
          setLocked(true);
          setUnlockOpen(true);
        },
        idleLockMinutes * 60 * 1000,
      );
    };
    const events = ["pointerdown", "keydown", "touchstart", "mousemove"] as const;
    for (const ev of events) window.addEventListener(ev, bump, { passive: true });
    bump();
    return () => {
      if (timer != null) window.clearTimeout(timer);
      for (const ev of events) window.removeEventListener(ev, bump);
    };
  }, [hydrated, bareShell, idleLockMinutes, locked]);

  const toggleTraining = () => {
    if (!allowTrainingMode && !trainingMode) {
      toast.error(t.trainingDisabled);
      return;
    }
    setTrainingMode((prev) => {
      const next = !prev;
      try {
        if (next) sessionStorage.setItem(TRAINING_KEY, "1");
        else sessionStorage.removeItem(TRAINING_KEY);
      } catch {
        /* ignore */
      }
      toast.success(next ? t.trainingOn : t.trainingOff);
      return next;
    });
  };

  const onUnlock = async (approval: DualApprovalPayload) => {
    try {
      await api.posIdleUnlock(approval);
      setLocked(false);
      setUnlockOpen(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || t.idleUnlockFail;
      toast.error(typeof msg === "string" ? msg : t.idleUnlockFail);
    }
  };

  useEffect(() => {
    if (!hydrated || bareShell) return;
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
        const [linkRes, subRes] = await Promise.all([
          api.getPosLinkStatus(),
          api.getCurrentSubscription().catch(() => null),
        ]);
        if (!cancelled) {
          setLinked(true);
          setLinkLoadError(false);
          const features = (subRes?.data as { features?: Record<string, boolean> })
            ?.features;
          setPlanOk(features?.pos !== false);
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
      try {
        let wh = "";
        try {
          wh = localStorage.getItem("hisaby-pos-warehouse-id") || "";
        } catch {
          /* ignore */
        }
        const shiftRes = await api.getCurrentPosShift(wh || undefined, {
          light: true,
        });
        if (!cancelled) setShiftOpen(!!shiftRes.data.shift);
      } catch {
        /* keep prior shiftOpen — do not pretend the drawer is closed */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, bareShell, router, pathname]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      logout();
    }
    router.push("/pos/login");
  };

  const goAccounting = () => {
  // Unlinked: stay inside POS simple books. Linked: full accounting suite.
    // Apps are always company-unified; go to accounting when allowed.
    if (canOpenAccountingApp(perms, user?.role)) {
      router.push("/dashboard");
      return;
    }
    router.push("/pos/books");
  };

  const currentModule = moduleForPosPath(pathname);
  const blockedByPerm =
    !!currentModule && !isCustomerDisplay && !canModule(currentModule, "view");

  useEffect(() => {
    if (!hydrated || bareShell || !blockedByPerm) return;
    router.replace(homePathForUser(user));
  }, [hydrated, bareShell, blockedByPerm, router, user]);

  if (bareShell) {
      return (
      <div className="min-h-screen bg-[#0b1220] text-slate-100 relative" dir={locale === "en" ? "ltr" : "rtl"}>
        <div className="absolute top-3 end-3 z-50">
          <ShellThemeToggle tone="pos" />
        </div>
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

  if (!planOk) {
    return (
      <div
        className="min-h-screen bg-[#0b1220] text-slate-100 flex items-center justify-center p-6"
        dir={locale === "en" ? "ltr" : "rtl"}
      >
        <PlanUpgradeGate
          feature="pos"
          from="/pos"
          title={locale === "en" ? "POS requires a higher plan" : "الكاشير ضمن باقة أعلى"}
          description={
            locale === "en"
              ? "Choose a plan, complete payment, and POS unlocks after the system confirms payment."
              : "اختر باقة وأتمم الدفع — يُفتح الكاشير بعد تأكيد النظام للدفع."
          }
          className="max-w-lg bg-[#121a28] text-slate-100 border-amber-500/40"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100" dir={locale === "en" ? "ltr" : "rtl"}>
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b1220]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-200 shrink-0"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/hisaby-mark.png" alt="" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover shrink-0" />
            <div className="min-w-0">
              <p className="font-bold leading-tight truncate text-sm sm:text-base">{t.brand}</p>
              <p className="text-[11px] text-slate-500 truncate hidden sm:block">{company?.name || t.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <ShellThemeToggle tone="pos" />
            <ShellAlertsBell
              tone="pos"
              hasAlert={linkLoadError}
              title={t.alertsTitle}
              emptyLabel={t.alertsEmpty}
              items={[
                ...(linkLoadError
                  ? [
                      {
                        id: "pos-link-error",
                        title: t.loadFailed,
                        message: t.retry,
                        href: "/pos/settings",
                        tone: "error" as const,
                      },
                    ]
                  : []),
              ]}
            />
            {pendingCount > 0 || quarantineCount > 0 ? (
              <button
                type="button"
                onClick={openQueue}
                title={t.pendingOffline}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1.5 text-xs font-semibold text-amber-200"
              >
                <CloudUpload className="w-4 h-4" />
                <span className="tabular-nums">{pendingCount + quarantineCount}</span>
              </button>
            ) : null}

            {/* Desktop nav strip */}
            <div className="hidden lg:flex items-center gap-2 max-w-[70vw] overflow-x-auto scrollbar-none">
              {showAccountingNav ? (
              <button
                type="button"
                onClick={goAccounting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 shrink-0"
                title={t.toAccounting}
              >
                <Calculator className="w-4 h-4" />
                <span>{t.toAccounting}</span>
              </button>
              ) : null}
              {showRestoNav ? (
              <Link
                href="/resto"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25 shrink-0"
              >
                <UtensilsCrossed className="w-4 h-4" />
                <span>{locale === "en" ? "Restaurants" : "المطاعم"}</span>
              </Link>
              ) : null}
              <PosCommissionChip />
              <button
                type="button"
                onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/5 shrink-0"
              >
                {locale === "en" ? "ع" : "EN"}
              </button>
              {canModule("posInventory", "view") ? (
              <Link
                href="/pos/inventory"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
              >
                <Package className="w-4 h-4" />
                <span>{t.inventory}</span>
              </Link>
              ) : null}
              {canModule("posContacts", "view") ? (
              <Link
                href="/pos/contacts"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
              >
                <Users className="w-4 h-4" />
                <span>{t.posContactsNav}</span>
              </Link>
              ) : null}
              {canModule("posBooks", "view") ? (
              <Link
                href="/pos/books"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
              >
                <Wallet className="w-4 h-4" />
                <span>{t.posBooksNav}</span>
              </Link>
              ) : null}
              <button
                type="button"
                onClick={toggleTraining}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shrink-0 ${
                  trainingMode
                    ? "bg-violet-500/25 text-violet-100 border border-violet-400/40"
                    : "text-slate-300 hover:bg-white/5"
                }`}
              >
                {trainingMode ? t.trainingOnShort : t.trainingMode}
              </button>
              {canModule("posShifts", "view") ? (
              <Link
                href="/pos/shifts"
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-sky-500/10 shrink-0 ${
                  shiftOpen ? "text-emerald-300" : "text-sky-200/90"
                }`}
              >
                <Clock3 className="w-4 h-4" />
                <span>{shiftOpen ? t.shiftOpen : t.shifts}</span>
              </Link>
              ) : null}
              {canSeeApprovals && canModule("posShifts", "view") ? (
                <Link
                  href="/pos/approvals"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-200/90 hover:bg-amber-500/10 shrink-0"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{t.approvals}</span>
                </Link>
              ) : null}
              {canModule("settings", "view") ? (
              <Link
                href="/pos/settings"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
              >
                <Settings2 className="w-4 h-4" />
                <span>{t.settings}</span>
              </Link>
              ) : null}
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-white/5 shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {blockedByPerm ? (
          <div className="border-t border-rose-500/30 bg-rose-500/10 px-4 py-2 text-center text-xs text-rose-200">
            {locale === "en"
              ? "This POS area is hidden for your account. Ask your company admin for access."
              : "هذا القسم في الكاشير مخفي عن حسابك. اطلب من مدير الشركة منحك الصلاحية."}
          </div>
        ) : null}

        {menuOpen ? (
          <div className="lg:hidden fixed inset-0 z-50">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label="Close"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute inset-y-0 start-0 w-[min(20rem,88vw)] bg-[#121a28] border-e border-white/10 shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <div>
                  <p className="font-bold">{t.brand}</p>
                  <p className="text-[11px] text-slate-500 truncate">{company?.name}</p>
                </div>
                <button type="button" onClick={() => setMenuOpen(false)} className="p-2 rounded-lg hover:bg-white/5">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {locale === "en" ? "Systems" : "الأنظمة"}
                </p>
                {showAccountingNav ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    goAccounting();
                  }}
                  className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold bg-emerald-500/10 text-emerald-200"
                >
                  <Calculator className="w-4 h-4" />
                  {t.toAccounting}
                </button>
                ) : null}
                {showRestoNav ? (
                <Link
                  href="/resto"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold bg-amber-500/10 text-amber-200"
                >
                  <UtensilsCrossed className="w-4 h-4" />
                  {locale === "en" ? "Restaurants" : "المطاعم"}
                </Link>
                ) : null}
                <p className="px-2 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {locale === "en" ? "POS" : "الكاشير"}
                </p>
                {[
                  { href: "/pos", label: locale === "en" ? "Sell" : "البيع" },
                  ...(canModule("posInventory", "view")
                    ? [{ href: "/pos/inventory", label: t.inventory, icon: Package }]
                    : []),
                  ...(canModule("posContacts", "view")
                    ? [{ href: "/pos/contacts", label: t.posContactsNav, icon: Users }]
                    : []),
                  ...(canModule("posBooks", "view")
                    ? [{ href: "/pos/books", label: t.posBooksNav, icon: Wallet }]
                    : []),
                  ...(canModule("posShifts", "view")
                    ? [{ href: "/pos/shifts", label: shiftOpen ? t.shiftOpen : t.shifts, icon: Clock3 }]
                    : []),
                  ...(canSeeApprovals
                    ? [{ href: "/pos/approvals", label: t.approvals, icon: ShieldCheck }]
                    : []),
                  ...(canModule("settings", "view")
                    ? [{ href: "/pos/settings", label: t.settings, icon: Settings2 }]
                    : []),
                ].map((item) => {
                  const Icon = "icon" in item && item.icon ? item.icon : null;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-200 hover:bg-white/5"
                    >
                      {Icon ? <Icon className="w-4 h-4 text-slate-400" /> : null}
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    toggleTraining();
                    setMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium ${
                    trainingMode ? "bg-violet-500/20 text-violet-100" : "text-slate-200 hover:bg-white/5"
                  }`}
                >
                  {trainingMode ? t.trainingOnShort : t.trainingMode}
                </button>
              </nav>
              <div className="p-3 border-t border-white/10 space-y-2">
                <button
                  type="button"
                  onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                  className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-300 bg-white/5"
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
                  {locale === "en" ? "Log out" : "تسجيل الخروج"}
                </button>
              </div>
            </div>
          </div>
        ) : null}

      </header>
      {queueOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/60 p-3"
          onClick={() => setQueueOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] overflow-hidden rounded-2xl border border-white/10 bg-[#121a2b] shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/10">
              <div>
                <p className="font-bold text-white">{t.offlineQueueTitle}</p>
                <p className="text-[11px] text-slate-400">{t.offlineQueueHint}</p>
              </div>
              <button
                type="button"
                className="text-slate-400 text-sm"
                onClick={() => setQueueOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className="px-3 py-2 flex flex-wrap gap-2 border-b border-white/5">
              <button
                type="button"
                disabled={syncing}
                onClick={() => void runFlush(false)}
                className="h-9 px-3 rounded-lg text-xs font-bold bg-emerald-500 text-slate-950 disabled:opacity-40 inline-flex items-center gap-1.5"
              >
                {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                {t.offlineRetryFlush}
              </button>
              {quarantineCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void discardQuarantine()}
                  className="h-9 px-3 rounded-lg text-xs font-semibold border border-rose-400/40 text-rose-200 hover:bg-rose-500/10"
                >
                  {t.quarantineDiscard}
                </button>
              ) : null}
            </div>
            <div className="overflow-y-auto p-3 space-y-2">
              {queueLoading ? (
                <p className="text-sm text-slate-400 inline-flex items-center gap-2 py-6 justify-center w-full">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  …
                </p>
              ) : queueLoadError ? (
                <div className="py-8 flex flex-col items-center gap-3">
                  <p className="text-sm text-rose-300">{t.loadFailed}</p>
                  <button
                    type="button"
                    onClick={() => void loadQueueDetail()}
                    className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950"
                  >
                    {t.retry}
                  </button>
                </div>
              ) : !queueSales.length && !queueOps.length ? (
                <p className="text-sm text-slate-500 text-center py-8">{t.offlineQueueEmpty}</p>
              ) : (
                <>
                  {queueSales.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-xl border px-3 py-2.5 space-y-1 ${
                        row.quarantined
                          ? "border-rose-400/30 bg-rose-500/10"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {t.offlineQueueSale}
                            {row.receipt.number ? ` · ${row.receipt.number}` : ""}
                          </p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {new Date(row.createdAt).toLocaleString()} · {row.receipt.total}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t.offlineAttempts}: {row.attempts ?? 0}
                            {row.quarantined ? ` · ${t.quarantineBadge}` : ""}
                          </p>
                          {row.lastError ? (
                            <p className="text-[11px] text-rose-300/90 break-words">
                              {t.offlineLastError}: {row.lastError}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void discardOne("sale", row.id)}
                          className="shrink-0 text-[11px] font-semibold text-rose-300 hover:underline"
                        >
                          {t.offlineDiscardOne}
                        </button>
                      </div>
                    </div>
                  ))}
                  {queueOps.map((row) => (
                    <div
                      key={row.id}
                      className={`rounded-xl border px-3 py-2.5 space-y-1 ${
                        row.quarantined
                          ? "border-rose-400/30 bg-rose-500/10"
                          : "border-white/10 bg-black/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {t.offlineQueueOp} · {row.kind}
                          </p>
                          <p className="text-[11px] text-slate-400 tabular-nums">
                            {new Date(row.createdAt).toLocaleString()}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {t.offlineAttempts}: {row.attempts ?? 0}
                            {row.quarantined ? ` · ${t.quarantineBadge}` : ""}
                          </p>
                          {row.lastError ? (
                            <p className="text-[11px] text-rose-300/90 break-words">
                              {t.offlineLastError}: {row.lastError}
                            </p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={() => void discardOne("op", row.id)}
                          className="shrink-0 text-[11px] font-semibold text-rose-300 hover:underline"
                        >
                          {t.offlineDiscardOne}
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {trainingMode ? (
        <div className="sticky top-14 z-30 border-b border-violet-400/30 bg-violet-600/20 px-3 py-1.5 text-center text-[11px] font-bold text-violet-100 tracking-wide">
          {t.trainingBanner}
        </div>
      ) : null}
      {locked ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1220]/95 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#121a2b] p-5 space-y-3 text-center shadow-xl">
            <ShieldCheck className="w-10 h-10 text-amber-300 mx-auto" />
            <p className="text-lg font-bold text-white">{t.idleLockedTitle}</p>
            <p className="text-sm text-slate-400">{t.idleLockedHint}</p>
            <button
              type="button"
              onClick={() => setUnlockOpen(true)}
              className="w-full h-11 rounded-xl bg-amber-500 text-slate-950 font-bold"
            >
              {t.idleUnlock}
            </button>
          </div>
        </div>
      ) : null}
      <DualApprovalModal
        open={unlockOpen && locked}
        action="POS_IDLE_UNLOCK"
        actionLabel={t.idleUnlock}
        summary={t.idleLockedTitle}
        actorRole={user?.role}
        onCancel={() => setUnlockOpen(false)}
        onConfirm={onUnlock}
      />
      <main className="mx-auto max-w-[1600px] px-0 sm:px-0">
        {blockedByPerm ? (
          <div className="p-6 text-center text-sm text-rose-200">
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
