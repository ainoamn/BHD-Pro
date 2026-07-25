/* Minimal offline shell for PWA installability */
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open("hisaby-shell-v1").then((cache) =>
      cache.addAll(["/", "/manifest.webmanifest", "/brand/hisaby-mark.png"]).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        if (req.url.startsWith(self.location.origin) && res.ok) {
          caches.open("hisaby-shell-v1").then((cache) => cache.put(req, copy)).catch(() => undefined);
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || caches.match("/")))
  );
});
