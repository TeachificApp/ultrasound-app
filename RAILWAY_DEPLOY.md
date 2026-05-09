# Railway Deployment Guide

## Overview

This app is configured for Railway deployment with custom domains:
- **Main app:** `app.allaboutultrasound.com`
- **LMS subdomain:** `learn.allaboutultrasound.com`

Both domains point to the same Railway service. The app detects which subdomain is active and renders the appropriate UI.

---

## Build & Start Commands

Railway will auto-detect these from `package.json`:

```
Build: pnpm build
Start: pnpm start
```

The `railway.toml` is also configured with these commands.

---

## Required Environment Variables

Set these in your Railway service's **Variables** tab:

### Core App
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@host:port/db?ssl={"rejectUnauthorized":true}` |
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

### Manus Forge (Storage, LLM, Notifications)
| Variable | Description |
|----------|-------------|
| `BUILT_IN_FORGE_API_URL` | Forge API base URL |
| `BUILT_IN_FORGE_API_KEY` | Forge API key (server-side) |
| `VITE_FRONTEND_FORGE_API_URL` | Forge API URL (client-side) |
| `VITE_FRONTEND_FORGE_API_KEY` | Forge API key (client-side) |

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

---

## Custom Domain Setup

In Railway's **Settings → Networking → Custom Domains**:

1. Add `app.allaboutultrasound.com`
2. Add `learn.allaboutultrasound.com`
3. Railway will provide CNAME records — update your DNS accordingly

Both domains serve the same Railway service. The app's `useSubdomain` hook detects `learn.*` hostnames and renders the LMS interface.

---

## Webhook URLs to Update

After deployment, update these external services to point to your Railway domain:

### Stripe
- Dashboard → Developers → Webhooks
- Update endpoint URL to: `https://app.allaboutultrasound.com/api/stripe/webhook`

### SendGrid
- Settings → Mail Settings → Event Webhook
- Update HTTP Post URL to: `https://app.allaboutultrasound.com/api/webhooks/sendgrid`

### Thinkific
- If using Thinkific webhooks, update to: `https://app.allaboutultrasound.com/api/webhooks/thinkific`

---

## OAuth Callback Registration

Ensure the OAuth callback URL is registered with Manus:
- `https://app.allaboutultrasound.com/api/oauth/callback`

This should already be configured if you were previously using this domain.

---

## Notes

- **PORT:** The app binds to `process.env.PORT` in production (Railway sets this automatically)
- **Manus plugins:** `vite-plugin-manus-runtime` and `@builder.io/vite-plugin-jsx-loc` are optional dev dependencies. They load via try/catch and won't break the build if missing.
- **CDN assets:** FetalScanCoach images use signed Manus CDN URLs that expire in March 2027. Plan to migrate these to Cloudflare R2 before then.
- **Database:** The app uses MySQL/TiDB. If migrating the database to Railway MySQL, update `DATABASE_URL` accordingly.
