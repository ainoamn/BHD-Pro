"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  LayoutDashboard,
  MapPin,
  Package,
  Shield,
  Users,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth";
import api from "@/lib/api";

const NAV = [
  { href: "/admin", label: "لوحة المؤشرات", icon: LayoutDashboard, exact: true },
  { href: "/admin/tenants", label: "الشركات", icon: Building2 },
  { href: "/admin/users", label: "المستخدمون", icon: Users },
  { href: "/admin/billing", label: "مدفوعات الاشتراك", icon: CreditCard },
  { href: "/admin/plans", label: "الباقات والعروض", icon: Package },
  { href: "/admin/visits", label: "الزيارات والـ IP", icon: MapPin },
  { href: "/admin/gateways", label: "بوابات الدفع", icon: Wallet },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await api.restoreSession();
      if (cancelled) return;
      const auth = useAuthStore.getState();
      if (!ok || !auth.isAuthenticated) {
        const next = pathname.startsWith("/admin") ? pathname : "/admin";
        router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }
      try {
        const res = await api.getAdminMe();
        if (cancelled) return;
        if (!res.data.isPlatformAdmin) {
          setAllowed(false);
          setError(
            "حسابك ليس ضمن مشرفي المنصة. أضف بريدك في PLATFORM_ADMIN_EMAILS على Render."
          );
          return;
        }
        setAllowed(true);
      } catch (err: unknown) {
        if (cancelled) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          setError(
            "واجهة الإدارة غير منشورة بعد على الخادم (404). انتظر اكتمال Deploy على Render ثم حدّث الصفحة."
          );
        } else if (status === 401) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}`);
          return;
        } else {
          setError(
            `تعذر التحقق من صلاحية مشرف المنصة${status ? ` (رمز ${status})` : ""}. تأكد أن API يعمل ثم أعد المحاولة.`
          );
        }
        setAllowed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, pathname]);

  if (allowed === null || isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-4">
          <Shield className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-xl font-bold">لوحة تحكم المنصة</h1>
          <p className="text-sm text-slate-400">{error}</p>
          <p className="text-xs text-slate-500">المستخدم الحالي: {user?.email || "—"}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-emerald-400 text-sm hover:underline"
          >
            العودة للنظام <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      <aside className="w-64 shrink-0 border-l border-slate-800 bg-slate-900/80 p-4 flex flex-col gap-2">
        <div className="mb-4 px-2">
          <p className="text-xs text-emerald-400 font-semibold tracking-wide">HISABY PLATFORM</p>
          <h1 className="text-lg font-bold mt-1">إدارة الموقع</h1>
          <p className="text-[11px] text-slate-500 mt-1 truncate">{user?.email}</p>
        </div>
        {NAV.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-emerald-600/20 text-emerald-300"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto pt-4 border-t border-slate-800">
          <Link href="/dashboard" className="text-xs text-slate-500 hover:text-slate-300 px-2">
            ← العودة لتطبيق الشركة
          </Link>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-auto p-6">{children}</main>
    </div>
  );
}
