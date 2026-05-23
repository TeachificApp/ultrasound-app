/**
 * Cloudflare Worker — allaboutultrasound.com SEO Proxy
 *
 * Routes public-facing landing/funnel pages through the root domain
 * (allaboutultrasound.com) while leaving all authenticated app flows
 * on their existing subdomains (app.allaboutultrasound.com, etc.).
 *
 * PROXIED paths (served from root domain for SEO):
 *   /courses/:slug          → course landing pages
 *   /downloads/:slug        → digital download landing pages
 *   /bundles/:slug          → bundle landing pages
 *   /product/:slug          → product landing pages
 *   /education-library      → browsable course/download catalogue
 *   /:slug/:pageSlug        → funnel pages (multi-step funnels)
 *   /p/:slug                → standalone landing pages
 *   /assets/*               → Vite-built JS/CSS/images (SPA assets)
 *   /api/trpc/*             → tRPC API calls from proxied pages
 *   /manifest.json          → PWA manifest
 *   /favicon.ico            → favicon
 *   /robots.txt             → robots file
 *
 * REDIRECTED paths (send users to the correct subdomain):
 *   /my-dashboard           → members.allaboutultrasound.com/my-dashboard
 *   /my-downloads           → members.allaboutultrasound.com/my-downloads
 *   /account, /profile      → members.allaboutultrasound.com/...
 *   /courses/:slug/player   → learn.allaboutultrasound.com/courses/:slug/player
 *   /downloads/:slug/files  → learn.allaboutultrasound.com/downloads/:slug/files
 *   /admin/*                → app.allaboutultrasound.com/admin/...
 *   /login                  → app.allaboutultrasound.com/login
 *
 * WWW HANDLING:
 *   All requests to www.allaboutultrasound.com are 301 redirected to
 *   allaboutultrasound.com (non-www) to consolidate SEO authority.
 *
 * PASS-THROUGH (served by Weebly on the root domain):
 *   Everything else (blog, marketing pages, etc.)
 *
 * ─── Configuration ────────────────────────────────────────────────────────
 * Set these as Worker environment variables in the Cloudflare dashboard:
 *
 *   APP_ORIGIN   = https://ultrasound-urcfdrve.manus.space
 *   ROOT_DOMAIN  = allaboutultrasound.com
 *
 * ─── Canonical URL signal ─────────────────────────────────────────────────
 * The Worker adds an `x-canonical-host` header to every proxied request.
 * The Express server reads this header in funnelOgMeta.ts and emits
 * <link rel="canonical" href="https://allaboutultrasound.com/..."> so
 * Google credits the root domain URL.
 */

// ── Configurable constants ─────────────────────────────────────────────────
// These are overridden by Worker environment variables when deployed.
const DEFAULT_APP_ORIGIN = "https://ultrasound-urcfdrve.manus.space";
const DEFAULT_ROOT_DOMAIN = "allaboutultrasound.com";

// ── Path matchers ──────────────────────────────────────────────────────────

/**
 * Returns true if the path should be proxied from the root domain to the app.
 * Order matters: more specific patterns must come before catch-alls.
 */
function shouldProxy(pathname) {
  // Static assets required for the SPA to render
  if (pathname.startsWith("/assets/")) return true;

  // API calls from proxied pages (tRPC, OAuth callbacks, etc.)
  if (pathname.startsWith("/api/")) return true;

  // PWA / meta files
  if (pathname === "/manifest.json") return true;
  if (pathname === "/favicon.ico") return true;
  if (pathname === "/robots.txt") return true;

  // Explicit static landing-page prefixes
  if (/^\/courses\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/downloads\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/bundles\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/product\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/p\/[^/]+\/?$/.test(pathname)) return true;

  // Education library catalogue
  if (/^\/education-library(\/?|\?.*)$/.test(pathname)) return true;

  // Funnel pages: /:slug/:pageSlug — two-segment paths that are NOT reserved
  const twoSegment = pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
  if (twoSegment) {
    const first = twoSegment[1];
    if (!RESERVED_PREFIXES.has(first)) return true;
  }

  return false;
}

/**
 * Returns a redirect URL if the path belongs to the authenticated app,
 * or null if it should pass through to the root domain origin.
 */
const MEMBERS_ORIGIN = "https://members.allaboutultrasound.com";
const LEARN_ORIGIN = "https://learn.allaboutultrasound.com";

function getAppRedirect(pathname, appOrigin) {
  // Player/access paths → learn subdomain
  if (/^\/courses\/[^/]+\/player(\/|$)/.test(pathname)) return `${LEARN_ORIGIN}${pathname}`;
  if (/^\/downloads\/[^/]+\/files(\/|$)/.test(pathname)) return `${LEARN_ORIGIN}${pathname}`;
  if (/^\/courses\/[^/]+\/overview(\/|$)/.test(pathname)) return `${LEARN_ORIGIN}${pathname}`;

  // Account/dashboard paths → members subdomain
  const MEMBERS_PATHS = [
    /^\/my-dashboard(\/|$)/,
    /^\/my-downloads(\/|$)/,
    /^\/account(\/|$)/,
    /^\/profile(\/|$)/,
    /^\/settings(\/|$)/,
    /^\/notifications(\/|$)/,
    /^\/upgrade-success(\/|$)/,
  ];
  for (const pattern of MEMBERS_PATHS) {
    if (pattern.test(pathname)) return `${MEMBERS_ORIGIN}${pathname}`;
  }

  // App-only paths → app subdomain (but NOT /api — we proxy that)
  const APP_PATHS = [
    /^\/admin(\/|$)/,
    /^\/platform-admin(\/|$)/,
    /^\/login(\/|$)/,
    /^\/logout(\/|$)/,
    /^\/forms(\/|$)/,
  ];
  for (const pattern of APP_PATHS) {
    if (pattern.test(pathname)) return `${appOrigin}${pathname}`;
  }
  return null;
}

// First-path segments that are never funnel slugs
const RESERVED_PREFIXES = new Set([
  "courses", "downloads", "bundles", "product", "products",
  "dashboard", "admin", "api", "my-downloads", "account",
  "profile", "login", "logout", "student", "settings",
  "notifications", "forms", "learn", "f", "p", "media",
  "blog", "about", "contact", "pricing", "terms", "privacy",
  "_next", "static", "assets", "favicon.ico", "robots.txt",
  "sitemap.xml", "platform-admin", "upgrade-success",
]);

// ── Worker entry point ─────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const appOrigin = (env.APP_ORIGIN || DEFAULT_APP_ORIGIN).replace(/\/$/, "");
    const rootDomain = env.ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;

    const url = new URL(request.url);
    const { pathname, search } = url;
    const hostname = url.hostname;

    // ─── 0. www → non-www 301 redirect ──────────────────────────────────
    // Consolidate all traffic to the non-www root domain for SEO.
    if (hostname === `www.${rootDomain}`) {
      const canonicalUrl = `https://${rootDomain}${pathname}${search}`;
      return Response.redirect(canonicalUrl, 301);
    }

    // ─── 1. Health check endpoint for debugging ─────────────────────────
    if (pathname === "/worker-ping") {
      return new Response("WORKER IS ALIVE", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });
    }

    // ─── 2. Redirect known app-only paths to the correct subdomain ──────
    const appRedirect = getAppRedirect(pathname, appOrigin);
    if (appRedirect) {
      return Response.redirect(`${appRedirect}${search}`, 302);
    }

    // ─── 3. Proxy public landing/funnel pages + assets ──────────────────
    if (shouldProxy(pathname)) {
      const targetUrl = `${appOrigin}${pathname}${search}`;

      // Clone the request and add the canonical host header so the Express
      // server knows to emit canonical URLs pointing to the root domain.
      const proxyHeaders = new Headers(request.headers);
      proxyHeaders.set("x-canonical-host", rootDomain);
      proxyHeaders.set("x-forwarded-for", request.headers.get("cf-connecting-ip") || "");
      proxyHeaders.set("x-forwarded-host", rootDomain);
      // Remove the host header so it doesn't conflict with the target
      proxyHeaders.delete("host");

      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
        redirect: "manual", // Don't auto-follow redirects — we handle them
      });

      let response = await fetch(proxyRequest);

      // ─── Handle redirects from origin ────────────────────────────────
      // If the origin returns a 3xx redirect (e.g., trailing slash normalization),
      // follow it internally up to 3 hops so the browser never sees a redirect
      // to the raw app origin domain.
      let redirectCount = 0;
      while (response.status >= 300 && response.status < 400 && redirectCount < 3) {
        const location = response.headers.get("location");
        if (!location) break;

        // Resolve relative redirects against the target URL
        const redirectUrl = new URL(location, targetUrl);

        // If the redirect points to the app origin, follow it internally
        // Otherwise (external redirect), rewrite it to the root domain and pass through
        if (redirectUrl.origin === appOrigin) {
          const followHeaders = new Headers(request.headers);
          followHeaders.set("x-canonical-host", rootDomain);
          followHeaders.set("x-forwarded-for", request.headers.get("cf-connecting-ip") || "");
          followHeaders.set("x-forwarded-host", rootDomain);
          followHeaders.delete("host");

          const followRequest = new Request(redirectUrl.toString(), {
            method: "GET",
            headers: followHeaders,
            redirect: "manual",
          });
          response = await fetch(followRequest);
          redirectCount++;
        } else {
          // External redirect — rewrite the location to use root domain if applicable
          // and pass through to the browser
          break;
        }
      }

      // If we exhausted redirects or got a redirect to an external domain, return it
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (location) {
          // Rewrite any redirect pointing to the app origin → root domain
          const rewrittenLocation = location.replace(appOrigin, `https://${rootDomain}`);
          return Response.redirect(rewrittenLocation, response.status);
        }
      }

      // Rewrite the response headers
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("x-frame-options");

      // Cache static assets aggressively, HTML briefly
      const contentType = response.headers.get("content-type") || "";
      if (pathname.startsWith("/assets/")) {
        // Vite assets have content hashes — cache for 1 year
        newHeaders.set("cache-control", "public, max-age=31536000, immutable");
      } else if (contentType.includes("text/html")) {
        newHeaders.set("cache-control", "public, max-age=60, stale-while-revalidate=300");
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // ─── 4. Pass through to Weebly (root domain origin) ────────────────
    return fetch(request);
  },
};
