"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { useUIStore } from "@/store/ui";
import { useAuthStore } from "@/store/auth";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Company } from "@/types";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sidebarCollapsed, sidebarOpen, setSidebarOpen } = useUIStore();
  const { isAuthenticated, isLoading, setCompany } = useAuthStore();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Always validate session against cookies (even if local cache says authenticated)
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    (async () => {
      const { setLoading } = useAuthStore.getState();
      setLoading(true);
      await api.restoreSession();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [hydrated, isAuthenticated, isLoading, router]);

  // Sync company (currency, etc.) from API so display matches إعدادات الشركة
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getCompany();
        const fresh = res.data as Company;
        if (!cancelled && fresh) {
          const current = useAuthStore.getState().company;
          setCompany(current ? { ...current, ...fresh } : fresh);
        }
      } catch {
        // keep cached company
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, isAuthenticated, setCompany]);

  if (!hydrated || isLoading) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
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
        <main className="p-4 sm:p-6">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
