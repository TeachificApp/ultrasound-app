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
const CACHE_NAME = isIHE ? "iheartecho-v2" : "ultrasound-assist-v2";
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

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  const dest = event.request.destination;

  // Never intercept: API calls, cross-origin requests, scripts, styles,
  // fonts, or workers — let these go straight to the network so a stale
  // SW cache never returns undefined (which throws TypeError: Failed to fetch)
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

  // Network-first for everything else; fall back to cache only on network error.
  // Always return a real Response — never undefined.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful navigation responses for offline shell
        if (dest === "document" && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(
          (cached) => cached ?? new Response("Network error", { status: 503, statusText: "Service Unavailable" })
        )
      )
  );
});
