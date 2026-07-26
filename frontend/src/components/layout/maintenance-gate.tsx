"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import api from "@/lib/api";

/**
 * Redirects dashboard users to /maintenance when platform maintenance is enabled.
 */
export function MaintenanceGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getPublicMaintenance();
        if (cancelled) return;
        if (res.data?.enabled && pathname !== "/maintenance") {
          router.replace("/maintenance");
          return;
        }
      } catch {
        /* fail open — do not block the app if the check fails */
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-app flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return <>{children}</>;
}
