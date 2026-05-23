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
 *
 * REDIRECTED paths (send users to the correct subdomain):
 *   /my-dashboard           → members.allaboutultrasound.com/my-dashboard
 *   /my-downloads           → members.allaboutultrasound.com/my-downloads
 *   /account, /profile      → members.allaboutultrasound.com/...
 *   /courses/:slug/player   → learn.allaboutultrasound.com/courses/:slug/player
 *   /downloads/:slug/files  → learn.allaboutultrasound.com/downloads/:slug/files
 *   /admin/*                → app.allaboutultrasound.com/admin/...
 *   /login                  → app.allaboutultrasound.com/login
 *   /api/*                  → app.allaboutultrasound.com/api/...
 *
 * PASS-THROUGH (served by whatever is on the root domain today):
 *   Everything else (blog, marketing pages, etc.)
 *
 * ─── Configuration ────────────────────────────────────────────────────────
 * Set these as Worker environment variables in the Cloudflare dashboard:
 *
 *   APP_ORIGIN   = https://app.allaboutultrasound.com
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
const DEFAULT_APP_ORIGIN = "https://app.allaboutultrasound.com";
const DEFAULT_ROOT_DOMAIN = "allaboutultrasound.com";

// ── Path matchers ──────────────────────────────────────────────────────────

/**
 * Returns true if the path should be proxied from the root domain to the app.
 * Order matters: more specific patterns must come before catch-alls.
 */
function shouldProxy(pathname) {
  // Explicit static landing-page prefixes
  if (/^\/courses\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/downloads\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/bundles\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/product\/[^/]+\/?$/.test(pathname)) return true;
  if (/^\/p\/[^/]+\/?$/.test(pathname)) return true;
  // Education library catalogue
  if (/^\/education-library(\/?|\?.*)$/.test(pathname)) return true;

  // Funnel pages: /:slug/:pageSlug — two-segment paths that are NOT reserved
  // We check the first segment is not a known app/API prefix.
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

  // App-only paths → app subdomain
  const APP_PATHS = [
    /^\/admin(\/|$)/,
    /^\/platform-admin(\/|$)/,
    /^\/login(\/|$)/,
    /^\/logout(\/|$)/,
    /^\/api(\/|$)/,
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
  "sitemap.xml",
]);

// ── Worker entry point ─────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const appOrigin = (env.APP_ORIGIN || DEFAULT_APP_ORIGIN).replace(/\/$/, "");
    const rootDomain = env.ROOT_DOMAIN || DEFAULT_ROOT_DOMAIN;

    const url = new URL(request.url);
    const { pathname, search } = url;

    // 1. Redirect known app-only paths to the app subdomain
    const appRedirect = getAppRedirect(pathname, appOrigin);
    if (appRedirect) {
      return Response.redirect(`${appRedirect}${search}`, 302);
    }

    // 2. Proxy public landing/funnel pages
    if (shouldProxy(pathname)) {
      const targetUrl = `${appOrigin}${pathname}${search}`;

      // Clone the request and add the canonical host header so the Express
      // server knows to emit canonical URLs pointing to the root domain.
      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: (() => {
          const h = new Headers(request.headers);
          h.set("x-canonical-host", rootDomain);
          // Forward the real visitor IP for analytics/rate-limiting
          h.set("x-forwarded-for", request.headers.get("cf-connecting-ip") || "");
          // Prevent the app from redirecting based on Host header mismatches
          h.set("x-forwarded-host", rootDomain);
          return h;
        })(),
        body: request.method !== "GET" && request.method !== "HEAD" ? request.body : null,
        redirect: "manual",
      });

      const response = await fetch(proxyRequest);

      // Rewrite the response so the browser sees the root domain URL.
      // Strip the x-frame-options header so the page can be embedded if needed.
      const newHeaders = new Headers(response.headers);
      newHeaders.delete("x-frame-options");
      // Tell Cloudflare to cache HTML for 60 seconds (adjust as needed)
      if (response.headers.get("content-type")?.includes("text/html")) {
        newHeaders.set("cache-control", "public, max-age=60, stale-while-revalidate=300");
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    // 3. Pass through to whatever is on the root domain (WordPress, static site, etc.)
    return fetch(request);
  },
};
