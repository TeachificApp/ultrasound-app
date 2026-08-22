# Complete Railway Cutover Manifest

## Objective

This project must run entirely outside Manus-managed production services. **Railway is the application runtime and MySQL data-plane target.** Cloudflare R2, SendGrid, Stripe, Thinkific, Printful, Bookvault, and any chosen AI provider remain external vendors, but their credentials and webhook destinations must be configured against the Railway runtime only. No managed Manus OAuth, Forge endpoint, managed database, deployment, scheduled runtime, or production domain route may remain a production dependency after cutover.

## Current Evidence

The Railway MySQL target has the migrated user foundation and the Railway-only authentication compatibility columns required by the existing sign-in queries. The deployed Railway-facing sign-in page now completes a magic-link request instead of failing on missing user columns. The previous success page was not proof of delivery because the current request route returned success even when the email provider declined the handoff; this is now corrected in source so a failed handoff is visible to the user after the Railway service is redeployed.

| Service area | Current implementation | Railway cutover requirement | Completion criterion |
|---|---|---|---|
| Web application and API | Node/Express, React, tRPC, Vite build; `railway.toml` and `railway.json` already exist | Deploy the current repository as a Railway service using `pnpm build` and `pnpm start` | Railway health check at `/api/health` is green and serving the built client/API |
| Primary database | Manus source plus Railway MySQL target | Use Railway MySQL as the only runtime `DATABASE_URL` | Runtime has no connection to the Manus database; parity reconciliation is recorded |
| Authentication | Existing password/magic-link logic; managed OAuth fallbacks remain in the core SDK | Use local signed sessions plus Railway MySQL user records; remove managed OAuth fallback from production path | Password reset, magic-link issue/consume, sign-out, and protected routes work without `OAUTH_SERVER_URL` or `VITE_APP_ID` |
| Password migration | Source password hashes intentionally excluded | Require independent password setup/reset after a verified Railway magic-link sign-in | No source password hash is copied; password-login succeeds after reset |
| Email | SendGrid HTTP API adapter | Configure `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, and sender verification in Railway; surface provider failure | A user-approved magic-link test is accepted by SendGrid and received/used successfully |
| Object storage | Direct R2 support already present, with Forge legacy fallback | Set `STORAGE_BACKEND=r2` and the R2 variables in Railway; migrate/verify existing objects | Upload, download, media retrieval, and large-file multipart flows succeed without Forge |
| AI, image, transcription, maps | Manus Forge helpers and frontend Forge references | Replace each Forge helper with a vendor-backed server integration; remove public Forge key references | Every AI/media/map feature declares and passes its Railway-only integration test |
| Notifications | Manus owner-notification helper | Replace with email, webhook, or an external notification provider selected for Railway | Administrative alerts reach the intended recipient without Manus notification APIs |
| Scheduled work | Manus heartbeat and project jobs | Use Railway cron services or a separate Railway worker service | Every production recurring job has an explicit Railway schedule, execution log, and idempotency control |
| Stripe and other webhooks | Existing server webhooks | Change every provider endpoint to the Railway production domain and validate signatures | Stripe, SendGrid, Thinkific, and other enabled webhooks deliver successfully to Railway |
| Domains and DNS | Existing production domains include app and learning routes | Point each production hostname to Railway after validation; retain a rollback DNS plan | HTTPS, cookies, canonical URLs, redirects, and domain-specific branding work on Railway |

## Railway Environment Categories

The following values must be created in the Railway service configuration without copying any secret into source code, documentation, browser forms, logs, or Git history.

| Category | Required variables or settings |
|---|---|
| Runtime | `NODE_ENV=production`, `DATABASE_URL` from Railway MySQL, strong independent `JWT_SECRET`, `VITE_APP_URL`, canonical domains |
| Authentication | Do not set or depend on `OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`, Forge session keys, or owner identity values for production authentication |
| Email | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`, `SENDGRID_FROM_NAME`; verified sender/domain in SendGrid |
| Storage | `STORAGE_BACKEND=r2`, `CF_R2_ACCOUNT_ID`, `CF_R2_ACCESS_KEY_ID`, `CF_R2_SECRET_ACCESS_KEY`, `CF_R2_BUCKET_NAME`, `CF_R2_PUBLIC_URL` |
| Payments | Existing production Stripe server-side keys and webhook signing secret; publishable key only in the client build |
| Learning and commerce providers | Only the actively required Thinkific, Printful, Bookvault, and other provider keys, configured as Railway secrets |
| AI and media | Chosen external provider keys and server-only endpoints; no `BUILT_IN_FORGE_API_*` or `VITE_FRONTEND_FORGE_*` value |

## Safety and Cutover Gates

The migration remains insert-only for data synchronization. Railway rows are never overwritten or deleted by the migration utilities. Raw legacy authentication and webhook tables remain excluded because they can contain bearer material or provider signatures. Before DNS cutover, the deployed Railway service must pass database, authentication, email, object-storage, payment-webhook, scheduled-job, and domain-cookie verification. The former Manus deployment remains a rollback reference only until these checks pass; it must not continue to receive production traffic after the Railway cutover is approved.
