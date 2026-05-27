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
export STRIPE_SECRET_KEY="sk_test_placeholder_key_12345678901234567890"
pnpm dev
```

The server starts on port 3000 (auto-scans for next available port if busy). No database is required to start — the app handles missing `DATABASE_URL` gracefully, returning "DB unavailable" errors from tRPC endpoints.

### Important caveats

1. **Vite HMR in Cloud VMs**: The `vite.config.ts` sets `hmr.clientPort: 443` and `hmr.protocol: "wss"` for the Manus sandbox proxy. In Cloud Agent VMs, this causes Chrome to hang when loading the dev server UI (hundreds of module requests + failed WSS connection). **Workaround**: Use `pnpm build && node dist/index.js` to verify UI rendering in browser, or rely on curl/tests for API verification. The dev server itself works correctly for API development.

2. **Tests without DATABASE_URL**: Most tests pass without a database. The failures in `server/scanCoachAdmin.test.ts` specifically require a live MySQL connection. **Important**: `vitest run` never exits cleanly in Cloud VMs because several test files import OAuth/Stripe modules that hold open handles. Use `timeout 120 pnpm exec vitest run 2>&1` to get results; all passing tests complete within ~30s but the process hangs indefinitely afterward. The `brandMembership.test.ts` and `lms.users.analytics.test.ts` failures are due to missing Stripe authenticator at the tRPC caller level (not the module-level key).

3. **TypeScript check has pre-existing errors**: `tsc --noEmit` reports ~18 type errors in client-side pages (mostly type mismatches between tRPC router returns and component usage). These are pre-existing and do not block the build or tests.

4. **Environment variables**: See `RAILWAY_DEPLOY.md` for the full list. For local dev, both `JWT_SECRET` and `STRIPE_SECRET_KEY` are required to start the server (Stripe is initialized at module level in `server/routers/dashboardRouter.ts` and crashes without a key). Use any placeholder value for `STRIPE_SECRET_KEY` (e.g. `sk_test_placeholder_key_12345678901234567890`). `DATABASE_URL` (MySQL connection string) is needed for any DB-dependent features.

5. **pnpm build scripts warning**: On fresh `pnpm install`, you'll see a warning about ignored build scripts for `@tailwindcss/oxide`, `core-js`, `esbuild`. These packages still work correctly without running their postinstall scripts in this environment.

### Key file locations

- Server entry: `server/_core/index.ts`
- tRPC routers: `server/routers.ts` (barrel), individual routers in `server/routers/`
- DB schema: `drizzle/schema.ts`
- Client entry: `client/src/main.tsx`
- App routes: `client/src/App.tsx`
- Vite config: `vite.config.ts`
- Test config: `vitest.config.ts` (tests only in `server/**/*.test.ts`)
