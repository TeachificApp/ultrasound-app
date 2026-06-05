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
export JWT_SECRET="any-32-char-string"
pnpm dev
```

The server starts on port 3000 (auto-scans for next available port if busy). No database is required to start — the app handles missing `DATABASE_URL` gracefully, returning "DB unavailable" errors from tRPC endpoints.

### Important caveats

1. **Vite HMR in Cloud VMs**: The `vite.config.ts` sets `hmr.clientPort: 443` and `hmr.protocol: "wss"` for the Manus sandbox proxy. In Cloud Agent VMs, this causes Chrome to hang when loading the dev server UI (hundreds of module requests + failed WSS connection). **Workaround**: Use `pnpm build && node dist/index.js` to verify UI rendering in browser, or rely on curl/tests for API verification. The dev server itself works correctly for API development.

2. **Tests without DATABASE_URL**: 807/817 tests pass without a database. The 10 failures are in `server/scanCoachAdmin.test.ts` — these specifically require a live MySQL connection and throw "DB unavailable". All other test files mock or skip DB-dependent paths gracefully.

3. **TypeScript check has pre-existing errors**: `tsc --noEmit` reports ~18 type errors in client-side pages (mostly type mismatches between tRPC router returns and component usage). These are pre-existing and do not block the build or tests.

4. **Environment variables**: See `RAILWAY_DEPLOY.md` for the full list. For local dev, only `JWT_SECRET` is strictly required to start the server. `DATABASE_URL` (MySQL connection string) is needed for any DB-dependent features.

5. **pnpm build scripts warning**: On fresh `pnpm install`, you'll see a warning about ignored build scripts for `@tailwindcss/oxide`, `core-js`, `esbuild`. These packages still work correctly without running their postinstall scripts in this environment.

6. **Stripe webhooks**: `registerStripeWebhook(app)` is registered **before** `express.json()` so raw body + signature verification work. Production endpoint: `https://app.allaboutultrasound.com/api/stripe/webhook` (also `/api/webhooks/stripe`). The handler responds 200 immediately and processes events asynchronously to avoid Stripe timeouts.

7. **SDMS CME tables**: Run `scripts/sdms-cme-migration.sql` against MySQL before using SDMS CME features. Admin configures per-activity SDMS settings under LMS course/cohort Settings or Webinar Settings. Learner CME module appears in the course player when enabled. API credentials are AES-encrypted at rest using `JWT_SECRET`; never exposed to the client.

### Key file locations

- Server entry: `server/_core/index.ts`
- tRPC routers: `server/routers.ts` (barrel), individual routers in `server/routers/`
- DB schema: `drizzle/schema.ts`
- Client entry: `client/src/main.tsx`
- App routes: `client/src/App.tsx`
- Vite config: `vite.config.ts`
- Test config: `vitest.config.ts` (tests only in `server/**/*.test.ts`)

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
