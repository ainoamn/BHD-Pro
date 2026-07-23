"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Menu,
  Package,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import { useLocaleStore } from "@/store/locale";
import { adminCopy } from "@/lib/admin-copy";
import api from "@/lib/api";

const NAV = [
  { href: "/admin", key: "overview" as const, icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", key: "tenants" as const, icon: Building2 },
  { href: "/admin/users", key: "users" as const, icon: Users },
  { href: "/admin/billing", key: "billing" as const, icon: CreditCard },
  { href: "/admin/plans", key: "plans" as const, icon: Package },
  { href: "/admin/visits", key: "visits" as const, icon: MapPin },
  { href: "/admin/gateways", key: "gateways" as const, icon: Wallet },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const t = adminCopy[locale === "en" ? "en" : "ar"];
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await api.restoreSession();
      if (cancelled) return;
      const auth = useAuthStore.getState();
      if (!ok || !auth.isAuthenticated) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      try {
        const res = await api.getAdminMe();
        if (cancelled) return;
        if (!res.data.isPlatformAdmin) {
          setAllowed(false);
          setError(
            locale === "en"
              ? "Your account is not a platform operator."
              : "حسابك ليس ضمن مشرفي المنصة."
          );
          return;
        }
        setAllowed(true);
      } catch (err: unknown) {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setAllowed(false);
        setError(
          status === 404
            ? locale === "en"
              ? "Admin API not deployed yet (404)."
              : "واجهة الإدارة غير منشورة بعد (404)."
            : locale === "en"
              ? `Could not verify operator access (${status || "error"}).`
              : `تعذر التحقق من صلاحية المشرف (${status || "خطأ"}).`
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname, locale]);

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-[#f4f7f6] flex items-center justify-center text-teal-800 text-sm">
        {t.loading}
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
          <Link href="/dashboard" className="text-teal-700 text-sm font-semibold hover:underline">
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
      {NAV.map((item) => {
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
                : "text-slate-600 hover:bg-teal-50 hover:text-teal-900"
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
          <div className="mt-auto p-4 border-t border-slate-100 space-y-2">
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
                {NavLinks}
              </div>
            </div>
          )}

          <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
