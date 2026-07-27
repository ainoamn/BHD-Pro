"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  Settings,
  Shield,
  Store,
  Users,
  UtensilsCrossed,
  Wallet,
  X,
  RefreshCw,
  LogOut,
  Calculator,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import api from "@/lib/api";

const NAV = [
  { href: "/admin", key: "overview" as const, perm: "overview" as const, icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", key: "tenants" as const, perm: "tenants" as const, icon: Building2 },
  { href: "/admin/users", key: "users" as const, perm: "users" as const, icon: Users },
  { href: "/admin/operators", key: "operators" as const, perm: "operators" as const, icon: Shield },
  { href: "/admin/billing", key: "billing" as const, perm: "billing" as const, icon: CreditCard },
  { href: "/admin/plans", key: "plans" as const, perm: "plans" as const, icon: Package },
  { href: "/admin/visits", key: "visits" as const, perm: "visits" as const, icon: MapPin },
  { href: "/admin/gateways", key: "gateways" as const, perm: "gateways" as const, icon: Wallet },
  { href: "/admin/settings", key: "settings" as const, perm: "overview" as const, icon: Settings },
];

const ADMIN_ME_CACHE = "hisaby-admin-me-v2";

function canAccess(perms: string[], needed: string) {
  if (!perms.length || perms.includes("full")) return true;
  return perms.includes(needed);
}

function readCachedAdminMe(email?: string | null): { permissions: string[] } | null {
  if (typeof window === "undefined" || !email) return null;
  try {
    const raw = sessionStorage.getItem(ADMIN_ME_CACHE);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      email: string;
      permissions: string[];
      at: number;
    };
    if (parsed.email !== email.toLowerCase()) return null;
    if (Date.now() - parsed.at > 5 * 60 * 1000) return null;
    return { permissions: parsed.permissions };
  } catch {
    return null;
  }
}

function writeCachedAdminMe(email: string, permissions: string[]) {
  try {
    sessionStorage.setItem(
      ADMIN_ME_CACHE,
      JSON.stringify({
        email: email.toLowerCase(),
        permissions,
        at: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

/** Ping API so Render cold-start begins as early as possible. */
function wakeApi() {
  if (typeof window === "undefined") return;
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const t = window.setTimeout(() => ctrl?.abort(), 25000);
  fetch("/backend-api/health", {
    method: "GET",
    credentials: "omit",
    cache: "no-store",
    signal: ctrl?.signal,
  }).catch(() => {
    /* ignore — wake is best-effort */
  }).finally(() => window.clearTimeout(t));
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [perms, setPerms] = useState<string[]>(["full"]);
  const [slow, setSlow] = useState(false);
  const [retryKey, setRetryKey] = useState(0);
  const verifying = useRef(false);

  const handleLogout = async () => {
    setOpen(false);
    try {
      await api.logout();
    } catch {
      logout();
    }
    router.push("/login");
  };

  const SystemLinks = (
    <div className="space-y-1">
      <Link
        href="/dashboard"
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100"
      >
        <Calculator className="w-3.5 h-3.5" />
        {t.toAccounting}
      </Link>
      <Link
        href="/pos"
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-sky-800 bg-sky-50 hover:bg-sky-100"
      >
        <Store className="w-3.5 h-3.5" />
        {t.toPos}
      </Link>
      <Link
        href="/resto"
        onClick={() => setOpen(false)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100"
      >
        <UtensilsCrossed className="w-3.5 h-3.5" />
        {t.toResto}
      </Link>
    </div>
  );

  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  const verify = useCallback(async () => {
    if (verifying.current) return;
    verifying.current = true;
    setSlow(false);
    setError(null);
    wakeApi();

    const slowTimer = window.setTimeout(() => setSlow(true), 2500);

    try {
      const auth = useAuthStore.getState();
      let ok = auth.isAuthenticated && !!auth.user;
      if (!ok) {
        ok = await api.restoreSession();
      }
      const nextAuth = useAuthStore.getState();
      if (!ok || !nextAuth.isAuthenticated || !nextAuth.user) {
        router.replace(`/login?next=${encodeURIComponent(pathnameRef.current || "/admin")}`);
        return;
      }

      const cached = readCachedAdminMe(nextAuth.user.email);
      if (cached) {
        setPerms(cached.permissions.length ? cached.permissions : ["full"]);
        setAllowed(true);
        void api
          .getAdminMe()
          .then((res) => {
            if (!res.data.isPlatformAdmin) {
              setAllowed(false);
              setError(
                locale === "en"
                  ? "Your account is not a platform operator."
                  : "حسابك ليس ضمن مشرفي المنصة.",
              );
              return;
            }
            const p = (res.data as { permissions?: string[] }).permissions;
            const next = Array.isArray(p) && p.length ? p : ["full"];
            setPerms(next);
            writeCachedAdminMe(nextAuth.user!.email, next);
          })
          .catch(() => {
            /* keep cached allow */
          });
        return;
      }

      const res = await api.getAdminMe();
      if (!res.data.isPlatformAdmin) {
        setAllowed(false);
        setError(
          locale === "en"
            ? "Your account is not a platform operator."
            : "حسابك ليس ضمن مشرفي المنصة.",
        );
        return;
      }
      const p = (res.data as { permissions?: string[] }).permissions;
      const next = Array.isArray(p) && p.length ? p : ["full"];
      setPerms(next);
      writeCachedAdminMe(nextAuth.user.email, next);
      setAllowed(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 401) {
        router.replace(`/login?next=${encodeURIComponent(pathnameRef.current || "/admin")}`);
        return;
      }
      setAllowed(false);
      setError(
        status === 404
          ? locale === "en"
            ? "Admin API not deployed yet (404)."
            : "واجهة الإدارة غير منشورة بعد (404)."
          : locale === "en"
            ? `Could not reach the API (${status || "timeout/network"}). The server may be waking up — retry in a moment.`
            : `تعذر الوصول للخادم (${status || "انتهاء المهلة/شبكة"}). قد يكون الخادم يستيقظ — أعد المحاولة بعد لحظات.`,
      );
    } finally {
      window.clearTimeout(slowTimer);
      verifying.current = false;
    }
  }, [locale, router]);

  useEffect(() => {
    void verify();
  }, [verify, retryKey, user?.id]);

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-3">
          <div className="mx-auto h-8 w-8 rounded-full border-2 border-teal-700 border-t-transparent animate-spin" />
          <p className="text-teal-900 text-sm font-bold">{t.loading}</p>
          {slow ? (
            <>
              <p className="text-xs text-slate-600 leading-relaxed">
                {locale === "en"
                  ? "The API is waking up (Render free tier). First load can take 20–40 seconds."
                  : "الخادم يستيقظ الآن (استضافة Render المجانية). أول تحميل قد يستغرق 20–40 ثانية."}
              </p>
              <button
                type="button"
                onClick={() => {
                  setAllowed(null);
                  setRetryKey((k) => k + 1);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:underline"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {locale === "en" ? "Retry now" : "إعادة المحاولة"}
              </button>
            </>
          ) : null}
        </div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-lg font-bold text-slate-900">{t.console}</p>
          <p className="text-sm text-slate-600">{error}</p>
          <p className="text-xs text-slate-500">{user?.email}</p>
          <button
            type="button"
            onClick={() => {
              setAllowed(null);
              setRetryKey((k) => k + 1);
            }}
            className="inline-flex items-center gap-1.5 mx-auto text-sm font-bold text-teal-800 hover:underline"
          >
            <RefreshCw className="w-4 h-4" />
            {locale === "en" ? "Retry" : "إعادة المحاولة"}
          </button>
          <Link href="/dashboard" className="block text-teal-700 text-sm font-semibold hover:underline">
            {t.backApp}
          </Link>
          <Link
            href="/login?next=/admin&switch=1"
            className="block text-sm font-bold text-emerald-900 hover:underline"
          >
            {locale === "en" ? "Sign in with another account" : "الدخول بحساب مشرف آخر"}
          </Link>
        </div>
      </div>
    );
  }

  const NavLinks = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.filter((item) => canAccess(perms, item.perm)).map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(item.href + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "bg-teal-700 text-white"
                : "text-slate-600 hover:bg-teal-50 hover:text-teal-900",
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {t[item.key]}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-[#f4f7f6] text-slate-900" dir={locale === "en" ? "ltr" : "rtl"}>
      <div className="lg:flex min-h-screen">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-e border-slate-200 bg-white">
          <div className="px-4 py-5 border-b border-slate-100 flex items-center gap-2.5">
            <Image src="/brand/hisaby-mark.png" alt="" width={36} height={36} className="rounded-lg" />
            <div className="min-w-0">
              <p className="font-extrabold text-teal-900 leading-tight">{t.brand}</p>
              <p className="text-[11px] text-slate-500 truncate">{t.console}</p>
            </div>
          </div>
          {NavLinks}
          <div className="mt-auto p-4 border-t border-slate-100 space-y-3">
            {SystemLinks}
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="text-xs font-bold text-slate-500 hover:text-teal-800"
            >
              {t.lang}
            </button>
            <Link href="/dashboard" className="block text-xs text-slate-500 hover:text-teal-800">
              ← {t.backApp}
            </Link>
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700"
            >
              <LogOut className="w-3.5 h-3.5" />
              {t.logout}
            </button>
            <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 h-14 flex items-center justify-between">
            <button type="button" onClick={() => setOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-bold text-teal-900">{t.console}</span>
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "ar" : "en")}
              className="text-xs font-bold px-2 py-1 rounded-md bg-slate-100"
            >
              {t.lang}
            </button>
          </header>

          {open && (
            <div className="lg:hidden fixed inset-0 z-40">
              <button
                type="button"
                className="absolute inset-0 bg-slate-900/40"
                onClick={() => setOpen(false)}
                aria-label="Close"
              />
              <div className="absolute inset-y-0 start-0 w-72 bg-white shadow-xl flex flex-col">
                <div className="flex items-center justify-between px-4 py-4 border-b">
                  <span className="font-bold">{t.brand}</span>
                  <button type="button" onClick={() => setOpen(false)} className="p-2">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {NavLinks}
                </div>
                <div className="p-4 border-t space-y-3">
                  {SystemLinks}
                  <button
                    type="button"
                    onClick={() => setLocale(locale === "en" ? "ar" : "en")}
                    className="text-xs font-bold text-slate-500"
                  >
                    {t.lang}
                  </button>
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="block text-xs text-slate-500"
                  >
                    ← {t.backApp}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-rose-600 bg-rose-50"
                  >
                    <LogOut className="w-4 h-4" />
                    {t.logout}
                  </button>
                  <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
                </div>
              </div>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[100rem] w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
