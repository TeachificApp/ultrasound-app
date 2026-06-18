/**
 * UltrasoundAssist™ / iHeartEcho Service Worker
 * Minimal SW required for PWA installability (beforeinstallprompt).
 * Caches the app shell for offline-capable home screen launch.
 * Brand-aware: uses different cache names per domain so each PWA install is isolated.
 *
 * Hardened fetch handler:
 * - Never intercepts script/style/font/worker fetches (prevents "Unexpected token '<'" errors)
 * - Never returns undefined from caches.match (always returns a real Response)
 */
const host = self.location.hostname;
const isIHE = host.indexOf("iheartecho") !== -1;
const CACHE_NAME = isIHE ? "iheartecho-v7" : "ultrasound-assist-v7";
const SHELL_URLS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isAdminDocumentPath(pathname) {
  return pathname === "/platform-admin" || pathname === "/admin" || pathname.startsWith("/admin/");
}

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  const dest = event.request.destination;

  // Never intercept: API calls, cross-origin requests, scripts, styles,
  // fonts, workers, or admin HTML navigations — let these go straight to
  // the network so a stale SW cache never returns 503 HTML for admin routes.
  if (
    url.includes("/api/") ||
    !url.startsWith(self.location.origin) ||
    dest === "script" ||
    dest === "style" ||
    dest === "font" ||
    dest === "worker"
  ) {
    return;
  }

  try {
    const path = new URL(url).pathname;
    if (dest === "document" && isAdminDocumentPath(path)) {
      return;
    }
  } catch {
    return;
  }

  // Network-first for everything else; fall back to cache only on network error.
  // Always return a real Response — never undefined (avoids "Failed to convert value to Response").
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(event.request);
        if (dest === "document" && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      } catch {
        const cached = await caches.match(event.request);
        return cached ?? new Response("Network error", { status: 503, statusText: "Service Unavailable" });
      }
    })()
  );
});
