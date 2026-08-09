/* Hisaby shell SW v3 — network-first; never poison API or Next chunks. */
const CACHE = "hisaby-shell-v3";
const PRECACHE = ["/", "/manifest.webmanifest", "/brand/hisaby-mark.png"];

function shouldBypass(url) {
  try {
    const u = new URL(url);
    const path = u.pathname || "";
    // Always hit network for app data and build artifacts
    if (path.startsWith("/backend-api")) return true;
    if (path.startsWith("/api")) return true;
    if (path.startsWith("/_next")) return true;
    if (path.includes(".")) {
      // JS/CSS/maps from previous deploys must not stick around as offline shells
      if (/\.(js|css|map|json|woff2?|ttf|eot)$/i.test(path) && !path.startsWith("/brand/")) {
        return true;
      }
    }
    // Cross-origin always network
    if (u.origin !== self.location.origin) return true;
  } catch {
    return true;
  }
  return false;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("hisaby-shell-") && k !== CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  if (shouldBypass(req.url)) {
    // Network only — never serve HTML for API failures
    event.respondWith(fetch(req));
    return;
  }

  // Navigations / static brand shell: network first, tiny offline fallback
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && req.mode === "navigate") {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(async () => {
        if (req.mode === "navigate") {
          return (
            (await caches.match(req)) ||
            (await caches.match("/")) ||
            new Response("Offline", { status: 503, statusText: "Offline" })
          );
        }
        return (await caches.match(req)) || new Response("", { status: 504 });
      })
  );
});
