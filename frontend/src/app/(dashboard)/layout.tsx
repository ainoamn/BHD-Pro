"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { MaintenanceGate } from "@/components/layout/maintenance-gate";
import { Require2faBanner } from "@/components/auth/require-2fa-banner";
import { MobileAppSwitcher } from "@/components/shared/mobile-app-switcher";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import api from "@/lib/api";
import {
  canAccessModule,
  moduleForDashboardPath,
} from "@/lib/module-permissions";
import { homePathForUser } from "@/lib/user-home";
import { wakeApi } from "@/lib/wake-api";

const BOOT_SAFETY_MS = 12000;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [bootTimedOut, setBootTimedOut] = useState(false);
  const [bootRetry, setBootRetry] = useState(0);

  useEffect(() => {
    setHydrated(true);
    wakeApi();
  }, []);

  // Validate session; never leave mobile stuck on the spinner (cold API).
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    setBootTimedOut(false);

    const safety = window.setTimeout(() => {
      if (cancelled) return;
      const store = useAuthStore.getState();
      store.setLoading(false);
      if (!store.isAuthenticated && !store.accessToken) {
        setBootTimedOut(true);
      }
    }, BOOT_SAFETY_MS);

    (async () => {
      const store = useAuthStore.getState();
      if (store.isAuthenticated) {
        store.setLoading(false);
      } else {
        store.setLoading(true);
      }

      const ok = await api.restoreSession();
      if (cancelled) return;

      if (!ok) {
        const still = useAuthStore.getState();
        // Fresh login keeps accessToken in memory — trust it until /me works.
        if (!still.accessToken) {
          still.logout();
          if (!cancelled) setBootTimedOut(true);
        }
      }
      useAuthStore.getState().setLoading(false);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(safety);
    };
  }, [hydrated, router, bootRetry]);

  useEffect(() => {
    if (!hydrated || isLoading || bootTimedOut) return;
    if (!isAuthenticated) {
      const next = encodeURIComponent(`${pathname || "/dashboard"}${typeof window !== "undefined" ? window.location.search : ""}`);
      router.replace(`/login?next=${next}`);
    }
  }, [hydrated, isAuthenticated, isLoading, bootTimedOut, router, pathname]);

  useEffect(() => {
    if (!hydrated || !isAuthenticated || !user) return;
    if (user.role === "ADMIN") return;
    const moduleKey = moduleForDashboardPath(pathname);
    if (!moduleKey) return;
    if (!canAccessModule(user.modulePermissions, moduleKey, "view")) {
      router.replace(homePathForUser(user));
    }
  }, [hydrated, isAuthenticated, user, pathname, router]);

  if (!hydrated || isLoading) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center gap-4 p-6">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-xs">
          جاري الاتصال بالخادم…
        </p>
      </div>
    );
  }

  if (bootTimedOut && !isAuthenticated) {
    return (
      <div className="min-h-screen bg-app flex flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-base font-semibold text-slate-800 dark:text-slate-100">
          الخادم يستغرق وقتاً أطول من المعتاد
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
          غالباً بعد فترة خمول. أعد المحاولة أو سجّل الدخول من جديد.
        </p>
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            type="button"
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white"
            onClick={() => {
              wakeApi();
              setBootTimedOut(false);
              setBootRetry((n) => n + 1);
            }}
          >
            إعادة المحاولة
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-300 dark:border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:text-slate-200"
            onClick={() => {
              const next = encodeURIComponent(pathname || "/dashboard");
              router.replace(`/login?next=${next}`);
            }}
          >
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <MaintenanceGate>
      <div className="min-h-screen bg-app">
        {sidebarOpen && (
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        <Sidebar />
        <div
          className={cn(
            "transition-all duration-300 mr-0",
            sidebarCollapsed ? "lg:mr-20" : "lg:mr-72"
          )}
        >
          <Topbar />
          <MobileAppSwitcher
            current="accounting"
            className="sticky top-14 z-30 sm:top-16"
          />
          <main className="p-3 sm:p-4 md:p-6 max-w-[100vw] overflow-x-hidden">
            <Require2faBanner />
            {children}
          </main>
        </div>
        <CommandPalette />
      </div>
    </MaintenanceGate>
  );
}
