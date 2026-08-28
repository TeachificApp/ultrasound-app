/**
 * UltrasoundAssist™ / iHeartEcho Service Worker
 *
 * Purpose: PWA installability (beforeinstallprompt) only.
 * We intentionally do NOT intercept fetch/navigation — a previous version cached
 * stale HTML/JS and caused site-wide white screens when Cloudflare cached old sw.js.
 *
 * Bump CACHE_VERSION on every SW change so activate deletes legacy caches.
 */
const CACHE_VERSION = "v9";
const host = self.location.hostname;
const isIHE = host.indexOf("iheartecho") !== -1;
const CACHE_NAME = isIHE ? `iheartecho-${CACHE_VERSION}` : `ultrasound-assist-${CACHE_VERSION}`;

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

// No fetch handler — network always serves fresh HTML/JS/CSS.
