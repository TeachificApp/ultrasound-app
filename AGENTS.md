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

**Production-like UI in Cloud VMs** (avoids Vite HMR hang):

```bash
export JWT_SECRET="…" STRIPE_SECRET_KEY="sk_test_…"
pnpm build && node dist/index.js
```

### Important caveats

1. **Vite HMR in Cloud VMs**: The `vite.config.ts` sets `hmr.clientPort: 443` and `hmr.protocol: "wss"` for the Manus sandbox proxy. In Cloud Agent VMs, this causes Chrome to hang when loading the dev server UI (hundreds of module requests + failed WSS connection). **Workaround**: Use `pnpm build && node dist/index.js` to verify UI rendering in browser, or rely on curl/tests for API verification. The dev server itself works correctly for API development.

2. **Tests without DATABASE_URL**: Run tests with `JWT_SECRET` and `STRIPE_SECRET_KEY` set (same as dev server); otherwise any test file that imports `appRouter` fails at collection time. Without a database, expect ~10 failures in `server/scanCoachAdmin.test.ts` (live MySQL required) plus a handful of env-gated failures (SendGrid, Thinkific GraphQL, LMS email vars). The majority of the ~817 tests pass without `DATABASE_URL`.

3. **TypeScript check has pre-existing errors**: `tsc --noEmit` reports type errors in client-side pages and some server files (mostly type mismatches between tRPC router returns and component usage). These are pre-existing and do not block the build or tests.

4. **Environment variables**: See `RAILWAY_DEPLOY.md` for the full list. For local dev, `JWT_SECRET` and `STRIPE_SECRET_KEY` (dummy test key OK) are required to start the server or run tests that load `appRouter`. `DATABASE_URL` (MySQL connection string) is needed for any DB-dependent features.

5. **pnpm build scripts warning**: On fresh `pnpm install`, you'll see a warning about ignored build scripts for `@tailwindcss/oxide`, `core-js`, `esbuild`. These packages still work correctly without running their postinstall scripts in this environment.

6. **No ESLint script**: Formatting is via Prettier only (`pnpm format` / `pnpm exec prettier --check .`). There is no `pnpm lint` target in `package.json`.

### Key file locations

- Server entry: `server/_core/index.ts`
- tRPC routers: `server/routers.ts` (barrel), individual routers in `server/routers/`
- DB schema: `drizzle/schema.ts`
- Client entry: `client/src/main.tsx`
- App routes: `client/src/App.tsx`
- Vite config: `vite.config.ts`
- Test config: `vitest.config.ts` (tests only in `server/**/*.test.ts`)
