"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import api from "@/lib/api";

/**
 * Redirects dashboard users to /maintenance when platform maintenance is enabled.
 * Renders children immediately (fail-open) so a slow API never blocks the shell 30s+.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPublicMaintenance();
        if (cancelled) return;
        if (res.data?.enabled && pathname !== "/maintenance") {
          router.replace("/maintenance");
        }
      } catch {
        /* fail open — do not block the app if the check fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  return <>{children}</>;
}
