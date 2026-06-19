# AGENTS.md

## Cursor Cloud specific instructions

### Architecture

Single full-stack TypeScript monolith (Express + React/Vite + tRPC). Not a monorepo. One `package.json` at root.

- **Frontend**: React 19, Vite 7, TailwindCSS 4, wouter routing, tRPC client
- **Backend**: Express 4, tRPC server, Drizzle ORM (MySQL)
- **Dev command**: `pnpm dev` (runs `tsx watch server/_core/index.ts`)
- **Build**: `pnpm build` (Vite frontend + esbuild backend)
- **Tests**: `pnpm test` or `vitest run` (server-side only, in `server/**/*.test.ts`)
- **Type check**: `pnpm check` or `tsc --noEmit`
- **Format**: `pnpm format` (Prettier)

### Running the dev server

```bash
export JWT_SECRET="any-32-char-string-at-least-32"
export STRIPE_SECRET_KEY="sk_test_dummy_key_for_local_dev"  # any non-empty test key
pnpm dev
```

Both `JWT_SECRET` and `STRIPE_SECRET_KEY` are required to start the server (`dashboardRouter.ts` instantiates Stripe at import time). Use a dummy `sk_test_…` value for local dev when Stripe is not configured.

The server starts on port 3000 (auto-scans for next available port if busy). No database is required to start — the app handles missing `DATABASE_URL` gracefully, returning "DB unavailable" errors from tRPC endpoints.

### Per-brand clinical tool URLs

Platform-admin per-brand tools (cases, quickfire, scancoach, navigator, thinkific-webhook, challenge-cards, social-content, soundbytes) use URL suffixes `-aaus` or `-ihe` (e.g. `/admin/quickfire-ihe`). Legacy paths without a suffix redirect based on hostname. The tRPC `_brand` query param is derived from the path suffix via `shared/brandScopedRoutes.ts` (`detectBrandFromPath`). Platform Admin’s brand toggle sets per-brand card links accordingly. Full deploy/QA handoff: `docs/MANUS_BRAND_URLS.md`.

### Important caveats

1. **Vite HMR in Cloud VMs**: The `vite.config.ts` sets `hmr.clientPort: 443` and `hmr.protocol: "wss"` for the Manus sandbox proxy. In Cloud Agent VMs, this causes Chrome to hang when loading the dev server UI (hundreds of module requests + failed WSS connection). **Workaround**: Use `pnpm build && node dist/index.js` to verify UI rendering in browser, or rely on curl/tests for API verification. The dev server itself works correctly for API development.

2. **Tests without DATABASE_URL**: Run tests with `JWT_SECRET` and `STRIPE_SECRET_KEY` set (same as dev server); otherwise any test file that imports `appRouter` fails at collection time. Without a database, expect ~10 failures in `server/scanCoachAdmin.test.ts` (live MySQL required) plus a handful of env-gated failures (SendGrid, Thinkific GraphQL, LMS email vars). The majority of the ~817 tests pass without `DATABASE_URL`.

3. **TypeScript check has pre-existing errors**: `tsc --noEmit` reports type errors in client-side pages and some server files (mostly type mismatches between tRPC router returns and component usage). These are pre-existing and do not block the build or tests.

4. **Environment variables**: See `RAILWAY_DEPLOY.md` for the full list. For local dev, `JWT_SECRET` and `STRIPE_SECRET_KEY` (dummy test key OK) are required to start the server or run tests that load `appRouter`. `DATABASE_URL` (MySQL connection string) is needed for any DB-dependent features.

5. **pnpm build scripts warning**: On fresh `pnpm install`, you'll see a warning about ignored build scripts for `@tailwindcss/oxide`, `core-js`, `esbuild`. These packages still work correctly without running their postinstall scripts in this environment.

6. **Service worker / white screen**: `pnpm build` runs `scripts/sync-public-assets.mjs` after Vite — it force-copies `sw.js` into `dist/public` and fails the build if `index.html` is missing the entry script or still has `%VITE_ANALYTICS_*%` placeholders. Bump `CACHE_VERSION` in `client/public/sw.js` when changing SW behavior. Production serves `/sw.js` with `Cache-Control: no-cache` via an explicit route in `server/_core/vite.ts` (not express.static). Recovery page: `/sw-clear.html`.

7. **Site Pages CMS**: LMS Admin → Settings → **Site Pages** (`/admin/lms/site-pages`). Requires DB tables from `drizzle/site-pages-migration.sql`. Uses `site_pages` + `site_nav_menus` tables and the native `LandingPageBuilder` block system.

6. **Production build requires analytics env vars OR safe strip**: `vite.config.ts` removes the umami `<script>` when `VITE_ANALYTICS_ENDPOINT` / `VITE_ANALYTICS_WEBSITE_ID` are unset. Use `VITE_ANALYTICS_ENDPOINT=... VITE_ANALYTICS_WEBSITE_ID=... pnpm build` for production-like builds. A broken build strips `#root` and JS if the old greedy regex matched — see `transformAnalyticsIndexHtml` in `vite.config.ts`.

<<<<<<< HEAD
7. **PR #20 `isAdminOrAuthPath` reverted**: Do not skip the Router outer `<Suspense>` for admin paths — lazy admin pages need it. `/platform-admin` stays fixed via eager `PlatformAdmin` + `AdminLoginRedirect` (`window.location.replace`, not wouter `Redirect`). Funnel `/:slug` redirects use `HardRedirect` for the same reason.

8. **wouter `<Switch>` + wrapper components**: Never place custom components (e.g. `PerBrandAdminRoutes`) as direct `<Switch>` children — wouter treats missing `path` as `*` and stops before later routes (blank funnel/admin pages). Use `perBrandAdminRouteElements()` / `perBrandUserRouteElements()` from `client/src/routes/perBrandRouteHelpers.tsx` to spread flat `<Route>` elements inside `<Switch>`.

6. **Stripe webhooks**: `registerStripeWebhook(app)` is registered **before** `express.json()` so raw body + signature verification work. Production endpoint: `https://app.allaboutultrasound.com/api/stripe/webhook` (also `/api/webhooks/stripe`). The handler responds 200 immediately and processes events asynchronously to avoid Stripe timeouts.

7. **SDMS CME tables**: Run `scripts/sdms-cme-migration.sql` against MySQL before using SDMS CME features. Admin configures per-activity SDMS settings under LMS course/cohort Settings or Webinar Settings. Learner CME module appears in the course player when enabled. API credentials are AES-encrypted at rest using `JWT_SECRET`; never exposed to the client.
6. **No ESLint script**: Formatting is via Prettier only (`pnpm format` / `pnpm exec prettier --check .`). There is no `pnpm lint` target in `package.json`.

### Stripe membership subscriptions

- Webhook handler delegates to `server/lib/membershipFulfillment.ts` for `checkout.session.completed` with `metadata.type=membership`.
- Fulfillment grants `membership_subscriptions`, enrolls courses/quizzes, downloads, bundles, and brand tiers per `membership_plan_access`.
- Checkout complete fallback: `membership.getCheckoutSessionStatus` (used when `?type=membership` on `/checkout/complete`).
- Admin manual reconcile (production): `membership.reconcileStripeMembership` with `stripeSubscriptionId` or `stripeCheckoutSessionId` + customer email.
- Duplicate Stripe subs: webhook auto-cancels extras; admin can run `membership.cancelDuplicateStripeSubscriptions` with `keepSubscriptionId` + `stripeCustomerId`.
- Enrollments respect `access_expires_at` (Thinkific import + membership renewals). Run Thinkific resync enrollments to revoke expired imports.
- Checkout blocks repurchase when active membership/enrollment exists; embedded checkout uses `useEffect` to avoid double Stripe sessions.
- Guest checkout before embedded membership pay: `membership.guestCheckoutRegister` then `/checkout/:planSlug?type=membership`.

### Stripe LMS course checkout (learn.allaboutultrasound.com)

- Webhook handler delegates guest + logged-in LMS purchases to `server/lib/lmsCheckoutFulfillment.ts` on `checkout.session.completed` when metadata has `course_id` / `hosted_checkout_*` or Stripe price matches `lms_courses` / `lms_pricing_options`.
- Guest buyers: no `user_id` / `order_id` in metadata — fulfillment resolves email from `customer_details`, creates account, order, enrollment, and sends enrollment email.
- Checkout complete fallback: `lms.getCheckoutSessionStatus` calls `reconcileLmsCheckoutFromStripeSession` for any completed session (not only logged-in users).
- Admin manual reconcile (production): `lmsEnrollmentAdmin.reconcileStripeLmsCheckout` with `stripeSubscriptionId` or `stripeCheckoutSessionId` + customer email when needed.
- **Manual enroll then link Stripe**: after `lmsEnrollmentAdmin.addEnrollment`, call `lmsEnrollmentAdmin.linkStripeSubscription` with `userId` + `courseId` (or `enrollmentId`) and `stripeSubscriptionId`. Sets `lms_orders.stripe_subscription_id` and `lms_enrollments.stripe_subscription_id` / `access_expires_at` / `source='stripe'`. CLI: `node scripts/link-lms-stripe-subscription.mjs --user-id … --course-id … --subscription sub_…`.
- `invoice.paid` and `customer.subscription.updated` extend `lms_enrollments.access_expires_at` when `stripe_subscription_id` is set.
- Membership handler also matches checkout by Stripe price ID — if a price is on both `membership_plans` and LMS, verify product routing in Stripe metadata.

### Digital download access (FetchApp-style)

- Admin: **LMS Admin → Downloads → Download Access** tab — dashboard charts, orders list, order detail with per-file downloaded/remaining and IP activity log.
- DB: `digital_purchases` (`status`, `max_downloads_per_file`, `access_expires_at`, `amount`), `digital_download_events` (`purchase_id`, `ip_address`), `digital_purchase_activity` (order timeline).
- Migration: `drizzle/0012_digital_download_access.sql` before using limits/activity in production.
- API: `downloadsAdmin.getAccessDashboard`, `listOrders`, `getOrderDetail`, `updateOrderAccess`, `expireOrder`, `reopenOrder`, `resendOrderEmail`.
- Learner downloads enforced via `downloadsLearner.trackDownload` (must succeed before file opens).
=======
8. **Marketing Site staging (`site.allaboutultrasound.com`)**: Run `scripts/marketing-site-migration.sql`. Import pages via `/admin/marketing-site` or `pnpm exec tsx scripts/import-aau-marketing-site.ts --limit 25`. Staging has `noindex` + `robots.txt` disallow. Do **not** point www DNS until approved.

7. **Form Embed Widget migration**: Run `scripts/form-embed-widget-migration.sql` after deploy. Embed loader is served at `/embed.js` (from `client/public/embed.js`). Public config/events API: `/api/form-embed/config` and `/api/form-embed/event`. For UI verification in Cloud VMs, use `pnpm build && node dist/index.js` (not `pnpm dev`) due to Vite HMR WSS issue.
>>>>>>> 67028fa (Add marketing site staging replica for www.allaboutultrasound.com)

### Key file locations

- Server entry: `server/_core/index.ts`
- tRPC routers: `server/routers.ts` (barrel), individual routers in `server/routers/`
- DB schema: `drizzle/schema.ts`
- Client entry: `client/src/main.tsx`
- App routes: `client/src/App.tsx`
- Vite config: `vite.config.ts`
- Test config: `vitest.config.ts` (tests only in `server/**/*.test.ts`)

### Email campaigns

- Audience filter schema: `shared/emailCampaignAudience.ts`; resolver: `server/lib/emailCampaignAudienceResolver.ts`
- Campaign editor supports email list targeting, all `lms_interests`, date filters, cohort/course/product filters, and A/B segmentation (stored in `audienceFilter` JSON)
- Tracking URLs use recipient keys (`u{userId}` or `e{base64url(email)}`) so list-only subscribers are tracked
- Analytics: `getCampaignAnalytics` returns fields aligned with `EmailCampaignDashboard` (`totalSent`, `uniqueOpens`, `topLinks`, `orders`, `variantStats`)

### Form Builder analytics

- **Deep analytics tab** (`GeneralFormBuilder` → Analytics): per-field distributions, numeric stats, cross-tabulation, multi-form field comparison, and Formsite-style **public reports** (table/charts/embed links with optional password + saved filter).
- **Multi-form dashboards**: `/admin/general-forms/analytics-dashboard` — combine widgets across forms; public share at `/reports/dashboard/:token`.
- **Public report URLs**: `/reports/analytics/:token` (add `?view=table` or `?view=charts`), embed at `/reports/analytics/:token/embed`.
- Report tokens are indexed in `globalFormTheme.themeSettings` (`_analyticsReportIndex`); report configs live in each form's `themeSettings._analyticsSettings`.
- Analytics utils: `shared/formAnalyticsUtils.ts`; server loader: `server/lib/formAnalyticsEngine.ts`.

### General Form Builder — results table

- **Admin-only fields**: Set via the field editor (`extraConfig.adminOnly`). Hidden on public forms; editable in the Results tab only.
- **Saved filters & form actions**: Configured in Settings → “Results Table Filters & Actions”; persisted under `themeSettings._resultsSettings` (preserved when saving theme).
- **Bulk operations**: Results tab supports multi-select, bulk field edit, and bulk delete via `generalForm.bulkUpdateSubmissions` / `bulkDeleteSubmissions`.
