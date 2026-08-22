# Railway Deployment Guide

## Overview

This app runs on **Railway** with custom domains:

- **Main app:** `app.allaboutultrasound.com`
- **LMS subdomain:** `learn.allaboutultrasound.com`

Both domains point to the same Railway service. The app detects which subdomain is active and renders the appropriate UI.

> **Manus → Railway cutover:** The app previously ran on Manus hosting with TiDB + Forge storage. Railway uses **Railway MySQL** + **Cloudflare R2**. Set `RAILWAY_PRIMARY=true` and `STORAGE_BACKEND=r2` on Railway after DNS cutover.

---

## Build & Start Commands

Railway auto-detects configuration from these files:

- `railway.toml` — Build/deploy settings, health checks, restart policy
- `railway.json` — Service configuration (alternative format)
- `nixpacks.toml` — Nixpacks builder config (Node.js 22, pnpm)

```
Build: pnpm install && pnpm build
Start: pnpm start
```

Railway deploys automatically on every push to `main`.

---

## Required Environment Variables

Set these in your Railway service's **Variables** tab:

### Railway Primary (required after cutover)

| Variable | Description | Example |
|----------|-------------|---------|
| `RAILWAY_PRIMARY` | Disables Manus→Railway mirror sync | `true` |
| `STORAGE_BACKEND` | Use R2 instead of Manus Forge | `r2` |
| `DATABASE_URL` | Railway MySQL connection string | `mysql://root:pass@viaduct.proxy.rlwy.net:37790/railway` |

### Cloudflare R2 (required on Railway)

| Variable | Description |
|----------|-------------|
| `CF_R2_ACCOUNT_ID` | Cloudflare account ID |
| `CF_R2_ACCESS_KEY_ID` | R2 API token access key |
| `CF_R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `CF_R2_BUCKET_NAME` | Bucket name (default: `ultrasound-assist`) |
| `CF_R2_PUBLIC_URL` | Public R2 URL prefix (e.g. `https://pub-xxx.r2.dev`) |

### Core App

| Variable | Description | Example |
|----------|-------------|---------|
| `JWT_SECRET` | Session cookie signing secret | (random 32+ char string) |
| `NODE_ENV` | Must be `production` | `production` |
| `VITE_APP_URL` | Canonical app URL | `https://app.allaboutultrasound.com` |
| `VITE_APP_ID` | Manus OAuth app ID | (from Manus) |
| `VITE_APP_TITLE` | App display title | `UltrasoundAssist™` |
| `VITE_APP_LOGO` | App logo URL | (CDN URL) |
| `OAUTH_SERVER_URL` | Manus OAuth backend | `https://api.manus.im` |
| `VITE_OAUTH_PORTAL_URL` | Manus login portal | (from Manus) |
| `OWNER_OPEN_ID` | Owner's Manus open ID | (from Manus) |
| `OWNER_NAME` | Owner's display name | (your name) |
| `CANONICAL_ROOT_DOMAIN` | SEO root domain for Cloudflare proxy | `allaboutultrasound.com` |
| `IHE_CANONICAL_ROOT_DOMAIN` | iHeartEcho canonical domain | `app.iheartecho.com` |

### Stripe

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |

### SendGrid

| Variable | Description |
|----------|-------------|
| `SENDGRID_API_KEY` | SendGrid API key |
| `SENDGRID_FROM_EMAIL` | Sender email address |
| `SENDGRID_FROM_NAME` | Sender display name |

### Thinkific

| Variable | Description |
|----------|-------------|
| `THINKIFIC_API_KEY` | Thinkific API key |
| `THINKIFIC_SUBDOMAIN` | Thinkific subdomain |

### Analytics (Optional)

| Variable | Description |
|----------|-------------|
| `VITE_ANALYTICS_ENDPOINT` | Analytics endpoint URL |
| `VITE_ANALYTICS_WEBSITE_ID` | Analytics website ID |

### AI (OpenAI on Railway — no Manus Forge)

Manus Forge is not available on Railway. Use your **own OpenAI API key** server-side:

| Variable | Value |
|----------|--------|
| `BUILT_IN_FORGE_API_URL` | `https://api.openai.com` |
| `BUILT_IN_FORGE_API_KEY` | Your OpenAI `sk-...` key |

This powers **text AI**, **DALL-E image generation**, and **Whisper voice transcription**.

Do **not** set `VITE_FRONTEND_FORGE_*` — those are Manus-managed browser credentials (maps only). Google Maps is optional and unused if you do not need maps.

### Legacy Manus Forge (optional)

These are only needed if `STORAGE_BACKEND=forge` or during transition on Manus hosting:

| Variable | Description |
|----------|-------------|
| `BUILT_IN_FORGE_API_URL` | Forge API base URL (Manus only) |
| `BUILT_IN_FORGE_API_KEY` | Forge API key (Manus only) |
| `VITE_FRONTEND_FORGE_API_URL` | Manus-managed — do not copy to Railway |
| `VITE_FRONTEND_FORGE_API_KEY` | Manus-managed — do not copy to Railway |
| `RAILWAY_MYSQL_URL` | Only used by mirror sync on Manus (not needed on Railway) |

---

## Manus → Railway Migration Checklist

### 1. Pre-cutover (on Manus)

- [ ] Confirm mirror sync has populated Railway MySQL (`RAILWAY_MYSQL_URL` on Manus)
- [ ] Confirm media is mirrored to R2 (check `CF_R2_*` bucket object count)
- [ ] Run a final mirror sync from admin or wait for the 6-hour cron
- [ ] Note all Manus env vars — copy them to Railway Variables

### 2. Railway service setup

- [ ] Connect GitHub repo to Railway
- [ ] Add Railway MySQL plugin (or use existing `viaduct.proxy.rlwy.net` instance)
- [ ] Set all env vars from the tables above
- [ ] Set `RAILWAY_PRIMARY=true`
- [ ] Set `STORAGE_BACKEND=r2`
- [ ] Set `DATABASE_URL` to Railway MySQL URL (not TiDB)
- [ ] Deploy from `main` and verify health check at `/api/health`

### 3. DNS cutover

In Railway **Settings → Networking → Custom Domains**:

1. Add `app.allaboutultrasound.com`
2. Add `learn.allaboutultrasound.com`
3. Update DNS CNAME records to Railway's provided targets
4. Wait for TLS certificates to provision (~5 min)

### 4. External webhooks

Update these to point at `https://app.allaboutultrasound.com`:

| Service | Endpoint |
|---------|----------|
| Stripe | `/api/stripe/webhook` |
| SendGrid | `/api/webhooks/sendgrid` |
| Thinkific | `/api/webhooks/thinkific` |

### 5. OAuth callback

Register with Manus (if not already):

- `https://app.allaboutultrasound.com/api/oauth/callback`

### 6. Cloudflare SEO proxy

Update the Cloudflare Worker `APP_ORIGIN` variable:

```
APP_ORIGIN = https://app.allaboutultrasound.com
```

See `references/cloudflare-proxy-setup.md` for full setup.

### 7. Post-cutover verification

- [ ] Login via Manus OAuth works
- [ ] `/api/debug/db-status` shows `dbConnected: true`
- [ ] Media uploads go to R2 (check new objects in bucket)
- [ ] SCORM packages play correctly
- [ ] Stripe test purchase completes
- [ ] Email delivery works (SendGrid)

### 8. Decommission Manus hosting

After 48 hours of stable Railway operation:

- [ ] Remove Manus deploy (keep OAuth app registration)
- [ ] Remove `RAILWAY_MYSQL_URL` from any remaining Manus secrets
- [ ] Plan migration of `manuscdn.com` assets to R2 (URLs expire ~March 2027)

---

## Custom Domain Setup

Both domains serve the same Railway service. The app's `useSubdomain` hook detects `learn.*` hostnames and renders the LMS interface.

---

## Notes

- **PORT:** The app binds to `process.env.PORT` in production (Railway sets this automatically)
- **Storage:** `STORAGE_BACKEND=auto` (default) prefers R2 when `CF_R2_*` is configured; set `r2` explicitly on Railway
- **Mirror sync:** Disabled automatically when `RAILWAY_PRIMARY=true` or `DATABASE_URL` points to Railway
- **Manus plugins:** `vite-plugin-manus-runtime` is optional; loads via try/catch and won't break builds
- **Manus HMR:** Set `MANUS_SANDBOX=true` only when developing inside the Manus sandbox proxy
- **CDN assets:** FetalScanCoach images use signed Manus CDN URLs that expire in March 2027 — migrate to R2 before then
