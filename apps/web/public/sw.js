/*
 * DonorDesk service worker (phase 28.1-H). Caches only the static app shell and this offline page.
 * It never stores signed-in pages, API responses or anything under /v1, /api or /internal, so no project data is kept on the device.
 */
const VERSION = "donordesk-shell-v1";
const SHELL = ["/offline.html"];
const NEVER_CACHE = ["/api", "/v1", "/internal"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE.some((prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`))) return;

  if (request.mode === "navigate") {
    // Pages are always fetched fresh; with no connection the offline page is shown instead.
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/brand/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
  }
});
