"use client";

import { useEffect } from "react";

/**
 * Registers a safe shell service worker and purges poisoned caches from v1/v2
 * (which used to cache every GET including /backend-api and /_next).
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const scrubOldCaches = async () => {
      try {
        if (!("caches" in window)) return;
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((k) => k === "hisaby-shell-v1" || k === "hisaby-shell-v2")
            .map((k) => caches.delete(k)),
        );
      } catch {
        /* ignore */
      }
    };

    const onLoad = () => {
      void scrubOldCaches();
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Force swap to v3 when the new script is waiting
          if (reg.waiting) reg.waiting.postMessage?.({ type: "SKIP_WAITING" });
          reg.update().catch(() => undefined);
        })
        .catch(() => undefined);
    };

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
