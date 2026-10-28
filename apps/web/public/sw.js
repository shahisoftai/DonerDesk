/*
 * DonorDesk service worker (phase 28.1-H, field app 33.6). Caches only the static app shell, this offline page and the field
 * app's page (/field). The field page renders no signed-in data on the server (everything it shows comes from the phone's own
 * storage), so keeping it is safe. It never stores signed-in pages, API responses or anything under /v1, /api or /internal,
 * so no project data is kept by the worker; the offline packs live in the page's own IndexedDB and are removed on sign-out.
 */
const VERSION = "donordesk-shell-v2";
const FIELD_PAGE = "/field";
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

  if (request.mode === "navigate" && url.pathname === FIELD_PAGE) {
    // The field app: fresh when online (and kept), the kept copy when not, so forms can be filled with no signal.
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(VERSION).then((cache) => cache.put(FIELD_PAGE, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(FIELD_PAGE)) || caches.match("/offline.html")),
    );
    return;
  }

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
