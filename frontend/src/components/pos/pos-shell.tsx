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
  Loader2,
  LogOut,
  Package,
  Settings2,
  ShieldCheck,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import toast from "react-hot-toast";
import api from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { posCopy } from "@/lib/pos-copy";
import { flushPendingPosSales, pendingAllCount, quarantinedAllCount, discardAllQuarantined } from "@/lib/pos-offline-sync";
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
import {
  DualApprovalModal,
  type DualApprovalPayload,
} from "@/components/security/dual-approval-modal";

const VOID_ALERT_KEY = "hisaby-pos-void-alert-day";
const TRAINING_KEY = "hisaby-pos-training";

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
  const [quarantineCount, setQuarantineCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [queueOpen, setQueueOpen] = useState(false);
  const [queueSales, setQueueSales] = useState<PendingPosSale[]>([]);
  const [queueOps, setQueueOps] = useState<PendingPosOp[]>([]);
  const [queueLoading, setQueueLoading] = useState(false);
  const [idleLockMinutes, setIdleLockMinutes] = useState(0);
  const [allowTrainingMode, setAllowTrainingMode] = useState(true);
  const [locked, setLocked] = useState(false);
  const [unlockOpen, setUnlockOpen] = useState(false);
  const [trainingMode, setTrainingMode] = useState(false);
  const isLogin = pathname?.startsWith("/pos/login");
  const isCustomerDisplay = pathname?.startsWith("/pos/display");
  const bareShell = isLogin || isCustomerDisplay;
  const canSeeApprovals = user?.role === "ADMIN" || user?.role === "MANAGER";

  const refreshPending = useCallback(async () => {
    try {
      const [n, q] = await Promise.all([pendingAllCount(), quarantinedAllCount()]);
      setPendingCount(n);
      setQuarantineCount(q);
    } catch {
      setPendingCount(0);
      setQuarantineCount(0);
    }
  }, []);

  const loadQueueDetail = useCallback(async () => {
    setQueueLoading(true);
    try {
      const [sales, ops] = await Promise.all([listPendingSales(), listPendingOps()]);
      setQueueSales(sales);
      setQueueOps(ops);
    } catch {
      setQueueSales([]);
      setQueueOps([]);
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
        } else if (result.synced > 0 && (result.remaining > 0 || result.quarantined > 0)) {
          if (!silent) toast.error(t.syncPartial);
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

  const onUnlock = async (_approval: DualApprovalPayload) => {
    setLocked(false);
    setUnlockOpen(false);
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
        const res = await api.getPosLinkStatus();
        if (!cancelled) setLinked(!!res.data.linked);
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
    if (linked === true) {
      router.push("/dashboard");
      return;
    }
    router.push("/pos/books");
  };

  if (bareShell) {
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
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between gap-2 px-3 sm:px-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/hisaby-mark.png" alt="" className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg object-cover shrink-0" />
            <div className="min-w-0 hidden sm:block">
              <p className="font-bold leading-tight truncate text-sm sm:text-base">{t.brand}</p>
              <p className="text-[11px] text-slate-500 truncate">{company?.name || t.tagline}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <button
              type="button"
              onClick={goAccounting}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/25 shrink-0"
              title={linked === true ? t.toAccounting : t.posBooksTitle}
            >
              {linked === true ? <Calculator className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
              <span>{linked === true ? t.toAccounting : t.posBooksNav}</span>
            </button>
            <Link
              href="/resto"
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-bold text-amber-200 hover:bg-amber-500/25 shrink-0"
              title={locale === "en" ? "Restaurants" : "المطاعم"}
            >
              <UtensilsCrossed className="w-4 h-4" />
              <span className="hidden sm:inline">{locale === "en" ? "Restaurants" : "المطاعم"}</span>
            </Link>
            <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto max-w-[46vw] sm:max-w-none scrollbar-none">
              <PosCommissionChip />
              {pendingCount > 0 || quarantineCount > 0 ? (
                <button
                  type="button"
                  onClick={openQueue}
                  title={t.pendingOffline}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-2.5 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 shrink-0"
                >
                  <CloudUpload className="w-4 h-4" />
                  <span className="tabular-nums">{pendingCount + quarantineCount}</span>
                  <span className="hidden sm:inline">{t.offlineQueueTitle}</span>
                </button>
              ) : null}
              {quarantineCount > 0 ? (
                <button
                  type="button"
                  onClick={openQueue}
                  title={t.quarantineHint}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/15 px-2.5 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 shrink-0"
                >
                  <span className="tabular-nums">{quarantineCount}</span>
                  <span className="hidden sm:inline">{t.quarantineBadge}</span>
                  <span className="sm:hidden">{t.quarantineBadge}</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                className="rounded-lg px-2 py-1.5 text-xs font-bold text-slate-400 hover:bg-white/5 shrink-0"
              >
                {locale === "en" ? "ع" : "EN"}
              </button>
              <Link
                href="/pos/inventory"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
                title={t.inventory}
              >
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">{t.inventory}</span>
              </Link>
              <Link
                href="/pos/contacts"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
                title={t.posContactsTitle}
              >
                <Users className="w-4 h-4" />
                <span className="hidden lg:inline">{t.posContactsNav}</span>
              </Link>
              <Link
                href="/pos/books"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
                title={t.posBooksTitle}
              >
                <Wallet className="w-4 h-4" />
                <span className="hidden sm:inline">{t.posBooksNav}</span>
              </Link>
              <button
                type="button"
                onClick={toggleTraining}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shrink-0 ${
                  trainingMode
                    ? "bg-violet-500/25 text-violet-100 border border-violet-400/40"
                    : "text-slate-300 hover:bg-white/5"
                }`}
                title={t.trainingMode}
              >
                <span className="hidden sm:inline">
                  {trainingMode ? t.trainingOnShort : t.trainingMode}
                </span>
                <span className="sm:hidden">TRN</span>
              </button>
              <Link
                href="/pos/shifts"
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold hover:bg-sky-500/10 shrink-0 ${
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
                  className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-200/90 hover:bg-amber-500/10 shrink-0"
                  title={t.approvals}
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span className="hidden sm:inline">{t.approvals}</span>
                </Link>
              ) : null}
              <Link
                href="/pos/settings"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5 shrink-0"
              >
                <Settings2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t.settings}</span>
              </Link>
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
        {linked === false && (
          <div className="border-t border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-100 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Link2Off className="w-3.5 h-3.5 shrink-0" />
            <span>{t.unlinked}</span>
            <Link href="/pos/inventory" className="font-bold underline underline-offset-2">
              {t.inventory}
            </Link>
            <span>·</span>
            <Link href="/pos/contacts" className="font-bold underline underline-offset-2">
              {t.posContactsNav}
            </Link>
            <span>·</span>
            <Link href="/pos/books" className="font-bold underline underline-offset-2">
              {t.posBooksNav}
            </Link>
            <span>·</span>
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
      <main className="mx-auto max-w-[1600px]">{children}</main>
    </div>
  );
}
