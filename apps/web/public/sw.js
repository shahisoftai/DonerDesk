/*
 * DonorDesk service worker (phase 28.1-H, field app 33.6). Caches only the static app shell, this offline page and the field
 * app's page (/field). The field page renders no signed-in data on the server (everything it shows comes from the phone's own
 * storage), so keeping it is safe. It never stores signed-in pages, API responses or anything under /v1, /api or /internal,
 * so no project data is kept by the worker; the offline packs live in the page's own IndexedDB and are removed on sign-out.
 */
const VERSION = "donordesk-shell-v4";
const FIELD_PAGE = "/field";
const SHELL = ["/offline.html"];
const NEVER_CACHE = ["/api", "/v1", "/internal"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION && !key.startsWith("donordesk-offline-maps-")).map((key) => caches.delete(key))))
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

  // Phase 49.4: maps kept for offline work. The kept street map is served from the device (answering the byte ranges the map reads); the
  // country outlines and label fonts are fetched fresh and fall back to a kept copy only with no network. Public map data only.
  if (url.pathname.startsWith("/offline-maps/")) {
    event.respondWith(fromKeptMaps(request));
    return;
  }
  if (url.pathname.startsWith("/geo/ADM1/") || url.pathname.startsWith("/tiles/fonts/")) {
    event.respondWith(fetch(request).catch(async () => (await keptMatch(request)) || Response.error()));
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

async function keptMatch(request) {
  const names = (await caches.keys()).filter((k) => k.startsWith("donordesk-offline-maps-"));
  for (const name of names) {
    const hit = await (await caches.open(name)).match(request, { ignoreSearch: true });
    if (hit) return hit;
  }
  return undefined;
}

/** A kept map file, cut to the byte range asked for (a map reads its file in small ranges). */
async function fromKeptMaps(request) {
  const hit = await keptMatch(new Request(new URL(request.url).pathname));
  if (!hit) return new Response("Not kept on this device", { status: 404 });
  const range = /bytes=(\d*)-(\d*)/.exec(request.headers.get("range") || "");
  if (!range) return hit;
  const body = await hit.arrayBuffer();
  const start = Number(range[1] || 0);
  const end = Math.min(body.byteLength - 1, range[2] ? Number(range[2]) : body.byteLength - 1);
  return new Response(body.slice(start, end + 1), {
    status: 206,
    headers: { "content-type": "application/octet-stream", "content-range": `bytes ${start}-${end}/${body.byteLength}`, "content-length": String(end - start + 1), "accept-ranges": "bytes" },
  });
}
