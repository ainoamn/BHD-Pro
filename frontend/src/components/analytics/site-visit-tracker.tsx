"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import api from "@/lib/api";

/** Fire-and-forget page view for platform analytics (country resolved server-side via edge headers). */
export function SiteVisitTracker() {
  const pathname = usePathname();
  const last = useRef<string>("");

  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    if (last.current === pathname) return;
    last.current = pathname;

    const key = `visit:${pathname}:${new Date().toDateString()}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* ignore */
    }

    const timer = window.setTimeout(() => {
      api
        .trackSiteVisit({
          path: pathname,
          referrer: document.referrer || undefined,
        })
        .catch(() => {
          /* analytics must never break UX */
        });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return null;
}
