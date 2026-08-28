# Live Deployment Investigation

## Initial evidence — 2026-08-28

- The connected GitHub `main` branch and local project head were both at checkpoint `c823b8bb` when inspected.
- The Railway configuration specifies a Nixpacks deployment using `pnpm install && pnpm build`, `pnpm start`, and `/api/health`.
- Opening `https://learn.allaboutultrasound.com/` returned the expected application title but an otherwise blank initial viewport. The browser console contained no captured client error at that time.

Further verification must distinguish a Railway service build or start failure from a custom-domain routing/cache issue. No secrets are recorded in this file.

## Deployment-account access — 2026-08-28

- No Railway connector is configured for this task.
- The browser session did not load an authenticated Railway dashboard; it returned to a blank page before service or deployment details could be inspected.
- The live learner domain does respond through Railway (`x-railway-request-id` and a successful `/api/health` response), but serves an asset revision that must be compared with the configured GitHub deployment source in Railway.
