# Manus implementation guide — per-brand clinical tool URLs

Handoff for deploying and verifying brand-scoped routing for AAUS and iHeartEcho clinical tools.

**Related PR:** [#15 — Brand-scoped URLs for per-brand clinical tools](https://github.com/TeachificApp/ultrasound-app/pull/15) (`cursor/quickfire-brand-separation-4bb0`)

---

## 1. Goal

On `app.allaboutultrasound.com`, platform admins manage **both** AAUS and iHeartEcho. Hostname alone is not enough — each per-brand clinical tool must use a URL suffix so the API knows which brand to use.

| Suffix | Brand | tRPC `_brand` value |
|--------|--------|---------------------|
| `-aaus` | All About Ultrasound | `aaus` |
| `-ihe` | iHeartEcho | `iheartecho` |

**Examples**

- AAUS Daily Challenge admin: `/admin/quickfire-aaus`
- IHE Daily Challenge admin: `/admin/quickfire-ihe`
- User Daily Challenge: `/quickfire-aaus` or `/quickfire-ihe`

Legacy paths without a suffix (e.g. `/admin/quickfire`) still work: they **redirect** to `-aaus` or `-ihe` based on hostname.

---

## 2. Deploy steps

### Merge and release

1. Merge PR #15 into `main` (or the branch that contains these changes).
2. Deploy as usual (Railway / production pipeline).
3. **No new environment variables** — existing `JWT_SECRET` and `DATABASE_URL` are unchanged.
4. **No database migration** required for this feature.

### Manus sandbox / local dev

```bash
pnpm install
export JWT_SECRET="any-32-char-string-at-least-32"
# Optional for full DB features:
# export DATABASE_URL="mysql://..."

pnpm dev
```

**Manus HMR note:** `vite.config.ts` uses Manus proxy HMR (`hmr.clientPort: 443`, `wss`). In some sandboxes the browser UI can hang on dev HMR. For UI verification in Manus:

```bash
pnpm build && node dist/index.js
```

API and tests work fine with `pnpm dev`.

### Verify build and tests

```bash
pnpm build
pnpm test server/brandScopedRoutes.test.ts
pnpm test server/quickfire
```

---

## 3. Canonical source of truth

All brand URL logic lives in:

**`shared/brandScopedRoutes.ts`**

| Export | Purpose |
|--------|---------|
| `PER_BRAND_ADMIN_BASE_PATHS` | Admin tools that get suffixes |
| `PER_BRAND_USER_BASE_PATHS` | `/quickfire`, `/soundbytes` |
| `withBrandTag(path, brand)` | Append `-aaus` / `-ihe` |
| `detectBrandFromPath(pathname)` | Read brand from URL |
| `stripBrandTag(path)` | Remove suffix for comparisons |

Client helpers:

| File | Purpose |
|------|---------|
| `client/src/lib/perBrandUrls.ts` | `perBrandAdminUrl()`, `perBrandUserPath()` |
| `client/src/routes/perBrandRouteHelpers.tsx` | Registers `-aaus`/`-ihe` routes + legacy redirects |
| `client/src/components/BrandPathRedirect.tsx` | Hostname-based redirect for legacy URLs |

Daily Challenge categories:

| File | Purpose |
|------|---------|
| `shared/quickfireCategories.ts` | AAUS (6) vs IHE (7) category slots |
| `server/lib/quickfireDailySet.ts` | Daily set backfill when queue is empty |

---

## 4. Per-brand tools (must use suffixed URLs)

When linking or bookmarking from Platform Admin, always use the suffixed form:

| Tool | Base path | AAUS URL | IHE URL |
|------|-----------|----------|---------|
| Case Management | `/admin/cases` | `/admin/cases-aaus` | `/admin/cases-ihe` |
| Daily Challenge | `/admin/quickfire` | `/admin/quickfire-aaus` | `/admin/quickfire-ihe` |
| ScanCoach Editor | `/admin/scancoach` | `/admin/scancoach-aaus` | `/admin/scancoach-ihe` |
| Navigator Editor | `/admin/navigator` | `/admin/navigator-aaus` | `/admin/navigator-ihe` |
| Thinkific Webhook | `/admin/thinkific-webhook` | `...-aaus` | `...-ihe` |
| Challenge Cards | `/admin/challenge-cards` | `...-aaus` | `...-ihe` |
| Social Content | `/admin/social-content` | `...-aaus` | `...-ihe` |
| SoundBytes Admin | `/admin/soundbytes` | `...-aaus` | `...-ihe` |

User-facing:

| Tool | AAUS | IHE |
|------|------|-----|
| Daily Challenge | `/quickfire-aaus` | `/quickfire-ihe` |
| SoundBytes | `/soundbytes-aaus` | `/soundbytes-ihe` |

---

## 5. How brand reaches the server

```
User opens /admin/quickfire-ihe on app.allaboutultrasound.com
    ↓
client/src/main.tsx → getBrandParam() → detectBrandFromPath() → "iheartecho"
    ↓
tRPC calls include ?_brand=iheartecho on every request
    ↓
server/_core/context.ts prefers _brand over hostname
    ↓
Routers use ctx.brand for queries/mutations
```

**Rule for new per-brand admin pages:**

1. Register routes via `PerBrandAdminRoutes` in `client/src/App.tsx` (all three router blocks: AAUS, Members, IHE).
2. Link from Platform Admin with `perBrandAdminUrl(basePath, brand)`.
3. Do not rely on hostname when the page is opened from the AAUS app domain.

---

## 6. Platform Admin UX

On `/platform-admin`:

1. Use the **All About Ultrasound™ / iHeartEcho™** toggle (Dual App Tools section).
2. **Per-Brand Tools** card links update to the selected brand’s suffix.
3. Clicking “Daily Challenge” with IHE selected goes to `/admin/quickfire-ihe`, not `/admin/quickfire`.

### QA checklist (Platform Admin)

- [ ] Toggle AAUS → per-brand cards end in `-aaus`
- [ ] Toggle IHE → per-brand cards end in `-ihe`
- [ ] Open Daily Challenge admin on IHE URL → IHE categories (Adult Echo, Pediatric Echo, ACS, Fetal Echo, ECG, POCUS, Physics)
- [ ] Open on AAUS URL → AAUS categories (Abdominal, OB/Gyn, Small Parts, Vascular, MSK, POCUS)

---

## 7. Manual QA checklist (production)

### On `app.allaboutultrasound.com` (platform admin)

| Step | Expected |
|------|----------|
| Go to `/platform-admin`, select **iHeartEcho**, open Daily Challenge | URL is `/admin/quickfire-ihe`; IHE categories in admin |
| Select **AAUS**, open Daily Challenge | URL is `/admin/quickfire-aaus`; AAUS categories |
| Visit `/admin/quickfire` directly | Redirects to `/admin/quickfire-aaus` |
| DevTools → Network → any tRPC call from `-ihe` page | `_brand=iheartecho` in query string |

### On `app.iheartecho.com`

| Step | Expected |
|------|----------|
| Sidebar “Daily Challenge” | `/quickfire-ihe` |
| `/quickfire` (legacy) | Redirects to `/quickfire-ihe` |
| User sees IHE challenge slots | 7 categories, echo-focused content |

### On `app.allaboutultrasound.com` (AAUS users)

| Step | Expected |
|------|----------|
| Sidebar “Daily Challenge” | `/quickfire-aaus` |
| User sees AAUS challenge slots | 6 categories |

---

## 8. Key files

| Area | Files |
|------|--------|
| URL helpers | `shared/brandScopedRoutes.ts`, `client/src/lib/perBrandUrls.ts` |
| Routes | `client/src/App.tsx`, `client/src/routes/perBrandRouteHelpers.tsx` |
| Redirects | `client/src/components/BrandPathRedirect.tsx` |
| tRPC brand | `client/src/main.tsx`, `server/_core/context.ts` |
| Platform Admin links | `client/src/pages/PlatformAdmin.tsx` |
| Nav | `client/src/config/brandNav.ts` |
| Daily Challenge UI | `client/src/pages/QuickFire.tsx`, `client/src/pages/QuickFireAdmin.tsx` |
| Daily Challenge server | `server/routers/quickfireRouter.ts`, `server/lib/quickfireDailySet.ts`, `server/jobs/challengeCron.ts` |
| Tests | `server/brandScopedRoutes.test.ts`, `server/quickfire*.test.ts` |

---

## 9. Follow-up (optional)

These still use **unsuffixed** URLs and may open the wrong brand when linked from email on the AAUS domain:

- `server/routers/caseLibraryRouter.ts` — `adminUrl: .../admin/cases` (approx. lines 447, 720)

**Recommended fix:**

```ts
import { withBrandTag } from "@shared/brandScopedRoutes";

// Use ctx.brand or case.brand when building links:
const adminUrl = `${appUrl}${withBrandTag("/admin/cases", brand)}`;
```

Search the repo for hardcoded `/admin/quickfire`, `/admin/cases`, `/quickfire`, `/soundbytes` without `-aaus`/`-ihe` and update external links (emails, webhooks, internal docs).

---

## 10. Adding a new per-brand tool

1. Add base path to `PER_BRAND_ADMIN_BASE_PATHS` in `shared/brandScopedRoutes.ts`.
2. Register in all `PerBrandAdminRoutes` blocks in `client/src/App.tsx`.
3. Add a Platform Admin card in `PlatformAdmin.tsx` with `basePath` (not a static `href`).
4. If user-facing, add to `PER_BRAND_USER_BASE_PATHS` and `PerBrandUserRoutes`.
5. Add test cases in `server/brandScopedRoutes.test.ts`.
6. Run `pnpm build` and `pnpm test server/brandScopedRoutes.test.ts`.

---

## 11. What you do **not** need to do

- No Cloudflare / DNS changes for suffix routes (client-side routing only).
- No Stripe or webhook endpoint changes for this feature.
- No schema migration for brand suffixes.
- Do **not** remove legacy redirects yet — old bookmarks and emails may still use unsuffixed paths.

---

## 12. Success criteria

Implementation is complete when:

1. Brand-scoped URL changes are merged and deployed to production.
2. Platform Admin brand toggle drives correct `-aaus`/`-ihe` links.
3. Daily Challenge admin and user UIs show the correct brand categories per URL.
4. tRPC `_brand` matches the URL suffix on `app.allaboutultrasound.com` for IHE admin work.
5. Legacy URLs redirect without 404s.
