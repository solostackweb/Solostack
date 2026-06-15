/*
 * Stackivo service worker
 * -----------------------
 * Conservative caching for a multi-tenant SaaS:
 *   - Never cache /api/* or /auth/* (sensitive + user-scoped).
 *   - Never cache non-GET requests.
 *   - Cache-first for hashed Next.js static chunks (/_next/static/...).
 *   - Stale-while-revalidate for static brand assets (icons, manifest, fonts).
 *   - Network-only for all dashboard/HTML pages, with /offline.html fallback
 *     when (and only when) the network truly fails.
 *
 * Bump CACHE_VERSION whenever this file changes shape; old caches will be
 * cleaned on `activate`.
 */

const CACHE_VERSION = "stackivo-v3";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline.html";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/portal.webmanifest",
  "/icon.svg",
  "/icon-maskable.svg",
  "/apple-touch-icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // Best-effort precache; do not fail install if a single asset 404s.
      await Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
      // Intentionally NOT calling self.skipWaiting() here — we let the new
      // worker enter the "waiting" state so the client can prompt the user
      // to reload (see ServiceWorkerRegister + UpdatePrompt on the UI).
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k)),
      );
      // Enable navigation preload where supported for faster first paint.
      if ("navigationPreload" in self.registration) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          /* ignore */
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/static/") ||
    /\.(?:js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|avif|ico)$/i.test(
      url.pathname,
    )
  );
}

function isBrandAsset(url) {
  return (
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/icon.svg" ||
    url.pathname === "/icon-maskable.svg" ||
    url.pathname === "/apple-touch-icon.svg" ||
    url.pathname === "/favicon.ico"
  );
}

function isSensitivePath(url) {
  // Never touch user-scoped or auth-bearing endpoints.
  return (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/_next/data/")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Bypass non-GET, non-http(s), and cross-origin requests.
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isSensitivePath(url)) return; // network-only by default

  // Navigations: network-first, fall back to offline page.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preload = await event.preloadResponse;
          if (preload) return preload;
          const fresh = await fetch(req);
          return fresh;
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response("Offline", {
              status: 503,
              headers: { "Content-Type": "text/plain" },
            })
          );
        }
      })(),
    );
    return;
  }

  // Hashed Next.js static chunks: cache-first (immutable by hash).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        if (cached) return cached;
        try {
          const fresh = await fetch(req);
          if (fresh.ok) cache.put(req, fresh.clone());
          return fresh;
        } catch {
          return cached || Response.error();
        }
      })(),
    );
    return;
  }

  // Brand assets + small static files: stale-while-revalidate.
  if (isBrandAsset(url) || isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })(),
    );
    return;
  }

  // Everything else: just hit the network. SaaS data is never cached here.
});

/* ---------------------------------------------------------------------------
 * Web Push
 * -------------------------------------------------------------------------*/

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Stackivo", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Stackivo";
  const options = {
    body: data.body || "",
    tag: data.tag || undefined,
    data: { url: data.url || "/" },
    icon: "/icon.svg",
    badge: "/icon.svg",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) await client.navigate(target);
            return;
          } catch {
            /* fall through to openWindow */
          }
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target);
    })(),
  );
});
