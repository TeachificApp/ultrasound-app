# Cloudflare Reverse Proxy — SEO Setup Guide

## What This Does

Public-facing landing and funnel pages are served from **allaboutultrasound.com** (root domain) for SEO purposes. All authenticated app flows — student dashboards, course players, member portals, admin panels — remain on their existing subdomains and are unaffected.

| URL pattern | Served from | Purpose |
|---|---|---|
| `allaboutultrasound.com/courses/:slug` | Root domain (proxied) | Course landing pages — SEO |
| `allaboutultrasound.com/downloads/:slug` | Root domain (proxied) | Download landing pages — SEO |
| `allaboutultrasound.com/bundles/:slug` | Root domain (proxied) | Bundle landing pages — SEO |
| `allaboutultrasound.com/product/:slug` | Root domain (proxied) | Product landing pages — SEO |
| `allaboutultrasound.com/:slug/:pageSlug` | Root domain (proxied) | Funnel pages — SEO |
| `allaboutultrasound.com/p/:slug` | Root domain (proxied) | Standalone landing pages — SEO |
| `app.allaboutultrasound.com/dashboard` | App subdomain | Student dashboard |
| `learn.allaboutultrasound.com/...` | App subdomain | Course player |
| `members.allaboutultrasound.com/...` | App subdomain | Member portal |
| `allaboutultrasound.com/admin/*` | Redirects → app subdomain | Admin panel |
| `allaboutultrasound.com/dashboard` | Redirects → app subdomain | Student dashboard |

---

## Prerequisites

- Your domain (`allaboutultrasound.com`) must be on **Cloudflare** (DNS managed by Cloudflare). If it is not, transfer DNS to Cloudflare first — this is free and takes about 24 hours.
- You need access to the Cloudflare dashboard for `allaboutultrasound.com`.

---

## Step 1 — Deploy the Cloudflare Worker

1. Log in to [dash.cloudflare.com](https://dash.cloudflare.com) and select the `allaboutultrasound.com` zone.
2. Go to **Workers & Pages** → **Create** → **Create Worker**.
3. Name it `aaus-seo-proxy` (or any name you prefer).
4. Replace the default worker code with the contents of `cloudflare-proxy-worker.js` (included in this folder).
5. Click **Deploy**.

### Set Environment Variables

In the Worker settings → **Variables** → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `APP_ORIGIN` | `https://app.allaboutultrasound.com` |
| `ROOT_DOMAIN` | `allaboutultrasound.com` |

---

## Step 2 — Add a Worker Route

This tells Cloudflare to run your Worker on specific URL patterns instead of passing them to your existing root domain server.

1. In the Cloudflare dashboard, go to **Workers & Pages** → **aaus-seo-proxy** → **Settings** → **Triggers** → **Add Route**.
2. Add the following routes (one per line):

```
allaboutultrasound.com/courses/*
allaboutultrasound.com/downloads/*
allaboutultrasound.com/bundles/*
allaboutultrasound.com/product/*
allaboutultrasound.com/p/*
```

3. For funnel pages (two-segment paths like `/my-funnel/landing-page`), the Worker handles these dynamically — no additional route needed beyond the wildcard catch-all below.

> **Optional:** If you want the Worker to handle all paths (including the funnel catch-all), add a single catch-all route: `allaboutultrasound.com/*`. The Worker code already has logic to pass non-proxied paths through to your existing root domain server, so this is safe.

---

## Step 3 — Set `CANONICAL_ROOT_DOMAIN` on Railway

The app server needs to know the root domain so it can emit correct `<link rel="canonical">` tags when pages are proxied.

1. In Railway → your service → **Variables**, add:

| Key | Value |
|---|---|
| `CANONICAL_ROOT_DOMAIN` | `allaboutultrasound.com` |

This is already wired into the app code — `funnelOgMeta.ts` reads the `x-canonical-host` header sent by the Worker and falls back to this env var.

---

## Step 4 — Verify

After deploying, check the following:

### Canonical tags are correct
Open `https://allaboutultrasound.com/courses/your-course-slug` in a browser, view source, and confirm:

```html
<link rel="canonical" href="https://allaboutultrasound.com/courses/your-course-slug" />
```

The canonical URL should point to the **root domain**, not `app.allaboutultrasound.com`.

### App flows still work
Confirm that `allaboutultrasound.com/dashboard` redirects to `app.allaboutultrasound.com/dashboard` and that the student portal, course player, and admin panel are unaffected.

### Google Search Console
Submit `allaboutultrasound.com` as a property in Google Search Console and request indexing for your key landing pages. It may take 2–4 weeks for Google to re-crawl and update rankings.

---

## How It Works (Technical Summary)

```
User visits allaboutultrasound.com/courses/intro-to-vascular
         │
         ▼
Cloudflare Worker intercepts the request
         │
         ├─ Adds header: x-canonical-host: allaboutultrasound.com
         ├─ Adds header: x-forwarded-host: allaboutultrasound.com
         │
         ▼
Fetches https://app.allaboutultrasound.com/courses/intro-to-vascular
         │
         ▼
Express server sees x-canonical-host header
         │
         ├─ Injects: <link rel="canonical" href="https://allaboutultrasound.com/courses/intro-to-vascular">
         ├─ OG tags use root domain URL
         │
         ▼
Worker returns HTML to browser
Browser URL bar shows: allaboutultrasound.com/courses/intro-to-vascular ✓
Google indexes:        allaboutultrasound.com/courses/intro-to-vascular ✓
```

---

## What Is NOT Proxied (Stays on Subdomains)

The following paths are explicitly excluded from proxying and will either redirect to the app subdomain or pass through to your existing root domain server:

- `/dashboard`, `/admin/*`, `/my-downloads`, `/account`, `/profile`
- `/login`, `/logout`, `/settings`, `/notifications`
- `/api/*` — all tRPC and REST API calls
- `/forms/*` — embedded form renderer (these are typically iframed anyway)
- `/student/*`, `/media/*`

---

## Customising the Funnel Catch-All

The Worker uses a list of **reserved prefixes** to distinguish funnel slugs (e.g., `/my-funnel/landing-page`) from app paths. If you add new top-level routes to the app in future, add them to the `RESERVED_PREFIXES` set in `cloudflare-proxy-worker.js` to prevent them from being accidentally proxied.

Current reserved prefixes:
`courses`, `downloads`, `bundles`, `product`, `products`, `dashboard`, `admin`, `api`, `my-downloads`, `account`, `profile`, `login`, `logout`, `student`, `settings`, `notifications`, `forms`, `learn`, `f`, `p`, `media`, `blog`, `about`, `contact`, `pricing`, `terms`, `privacy`

---

## Estimated Time to Implement

| Task | Time |
|---|---|
| Transfer DNS to Cloudflare (if not already there) | 24 hours (propagation) |
| Deploy Worker and set env vars | 15 minutes |
| Add Worker routes | 5 minutes |
| Set `CANONICAL_ROOT_DOMAIN` secret in Manus | 2 minutes |
| Verify canonical tags and test redirects | 15 minutes |
| **Total (excluding DNS transfer)** | **~35 minutes** |
