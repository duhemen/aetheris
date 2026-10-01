const CACHE = "aetheris-v10";
const CDN_CACHE = "aetheris-cdn-v10";
const OFFLINE_URL = "/static/offline.html";

const PRECACHE = [
  "/",
  "/manifest.json",
  "/static/tailwind.css",
  "/static/index.html",
  "/static/v5-extras.js",
  "/static/v6-rooms.js",
  "/static/v7-auth.js",
  "/static/v8-voice.js",
  "/static/v8-rooms-pro.js",
  "/static/v8-ui-polish.js",
  "/static/v9-share.js",
  "/static/v10-admin.js",
  "/static/v10-i18n.js",
  "/static/v10-record.js",
  "/static/v10-e2ee.js",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // API & WS: network-only
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ws")) return;

  // CDN: cache-first with network refresh
  if (url.origin !== location.origin) {
    e.respondWith(
      caches.open(CDN_CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return hit || await fetchPromise || new Response("", { status: 504 });
      })
    );
    return;
  }

  // Static: stale-while-revalidate
  if (url.pathname.startsWith("/static/") || url.pathname.endsWith(".css") || url.pathname.endsWith(".js")) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const hit = await c.match(e.request);
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return hit || await fetchPromise || new Response("", { status: 504 });
      })
    );
    return;
  }

  // Navigasi / HTML: network-first, fallback cache, fallback offline page
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      try {
        const res = await fetch(e.request);
        if (res.ok && e.request.method === "GET") c.put(e.request, res.clone());
        return res;
      } catch {
        const hit = await c.match(e.request);
        if (hit) return hit;
        return c.match(OFFLINE_URL) || new Response("Offline", { status: 503 });
      }
    })
  );
});

// Background sync: queue post ketika offline
self.addEventListener("sync", (e) => {
  if (e.tag === "aetheris-sync-chat") {
    e.waitUntil(flushQueue());
  }
});

async function flushQueue() {
  // Placeholder untuk IndexedDB queue — simplified
  console.log("[SW] Sync triggered");
}