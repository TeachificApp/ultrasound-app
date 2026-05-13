/**
 * UltrasoundAssist™ / iHeartEcho Service Worker
 * Minimal SW required for PWA installability (beforeinstallprompt).
 * Caches the app shell for offline-capable home screen launch.
 * Brand-aware: uses different cache names per domain so each PWA install is isolated.
 */
const host = self.location.hostname;
const isIHE = host.indexOf("iheartecho") !== -1;
const CACHE_NAME = isIHE ? "iheartecho-v1" : "ultrasound-assist-v1";
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
  // Network-first for API calls; cache-first for shell
  if (event.request.url.includes("/api/")) return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
