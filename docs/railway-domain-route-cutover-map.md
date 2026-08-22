# Railway Domain and Route Cutover Map

Every hostname below must terminate at the Railway application service after the production cutover. Cloudflare or the authoritative DNS provider may remain the DNS/TLS edge, but no hostname may continue to route application traffic to the Manus deployment.

| Hostname or route | Current application purpose | Railway target requirement |
|---|---|---|
| `app.allaboutultrasound.com` | Main All About Ultrasound application, admin, password and magic-link sign-in | Railway custom domain; canonical `VITE_APP_URL`; independent local session cookie scoped to this host |
| `learn.allaboutultrasound.com` | Learner, course, workshop, checkout, purchaser-access, Teach host/player, and auto-login routes | Railway custom domain; preserve all learner routes and same-host magic/auto-login redirects |
| `members.allaboutultrasound.com` | Member profile, dashboard, and subscription routes | Railway custom domain; verify member-only route shell and cookie scope |
| `app.iheartecho.net` | iHeartEcho clinical application | Railway custom domain; preserve iHeartEcho branding, canonical URLs, and local session support |
| `app.iheartecho.com` | Legacy/alternate iHeartEcho canonical login and welcome-email destination | Railway custom domain or explicit HTTPS redirect to the selected Railway iHeartEcho canonical host |
| `accreditation.iheartecho.com` | Accreditation-specific route shell | Railway custom domain; preserve accreditation route selection and session handling |
| `allaboutultrasound.net` and `www.allaboutultrasound.net` | Public marketing/domain aliases currently associated with the project | Explicit Railway target or HTTPS redirect to the approved canonical marketing destination |

## Authentication and Cookie Routes

The Railway service must serve these routes from each appropriate hostname without forwarding to Manus OAuth:

| Route | Requirement |
|---|---|
| `/login` | Local password sign-in and magic-link request; report provider-delivery failures visibly |
| `/forgot-password` and `/auth/reset-password` | Independent Railway password setup/reset; preserve reset token query string |
| `/api/auth/login` | Local password validation, local signed session, and host-aware secure cookie |
| `/api/auth/magic-verify` | One-time local magic-link verification, local signed session, then host-safe redirect |
| `/api/auth/auto-login` and `/auth/access` | Preserve purchaser-access workflow only after local token/security migration is complete |
| `/api/health` | Railway deployment health check |

The Railway runtime must set `AUTH_BACKEND=local`, use a strong independent `JWT_SECRET`, and remove the managed OAuth fallback. Each hostname must be tested for secure cookies, session continuity, sign-out, and redirect safety before traffic is switched.

## Per-Host Cookie and Route Shell Map

| Public hostname | Railway domain target | Cookie domain and modes | Canonical route shell | Required redirect behavior |
|---|---|---|---|---|
| `app.allaboutultrasound.com` | Railway application service custom domain | `.allaboutultrasound.com`; secure HTTP-only `SameSite=None` session plus host-safe `SameSite=Lax` fallback | Main application shell and direct admin shell | No redirect for application and admin routes; `/login`, password-reset, and magic-link return to this host when requested here |
| `learn.allaboutultrasound.com` | Same Railway application service custom domain | `.allaboutultrasound.com`; same secure session pair | Learner shell with courses, checkout, workshops, Teach, and purchaser access | Learner auth/auto-login URLs preserve `learn` as the host parameter and return to the requested learner path |
| `members.allaboutultrasound.com` | Same Railway application service custom domain | `.allaboutultrasound.com`; same secure session pair | Member dashboard and subscriptions shell | Authentication returns to members routes when initiated there; avoid redirecting member paths to the admin shell |
| `app.iheartecho.net` | Same Railway application service custom domain | `.iheartecho.net`; secure HTTP-only session plus host-safe Lax fallback | iHeartEcho branded clinical shell | Keep this host for iHeartEcho routes and magic-link return URLs; do not share cookies with All About Ultrasound domains |
| `app.iheartecho.com` | Same Railway application service custom domain or a Railway HTTPS redirect service | `.iheartecho.com` if retained as an app host | iHeartEcho alternate/legacy branded shell | Either serve the matching branded shell or permanently redirect to the selected `app.iheartecho.net` canonical host before authentication is issued |
| `accreditation.iheartecho.com` | Same Railway application service custom domain | `.iheartecho.com`; secure session pair | Accreditation-specific route shell | Preserve accreditation routes; do not route the host to the general app catch-all |
| `allaboutultrasound.net` and `www.allaboutultrasound.net` | Railway application or Railway redirect service, per marketing decision | `.allaboutultrasound.net` only if authenticated app routes are intentionally served there | Marketing/alias shell | Redirect to the agreed canonical marketing or application hostname over HTTPS; do not create cross-root session sharing |

The cookie resolver derives the parent two-label root domain. This yields `.allaboutultrasound.com`, `.iheartecho.net`, `.iheartecho.com`, and `.allaboutultrasound.net` respectively. Railway must forward the original public host through `X-Forwarded-Host`; auth fetches also carry `X-App-Hostname`; magic-link and purchaser-access URLs must retain the explicit `host` parameter for browser navigation callbacks.

## Webhook Repointing

Every active provider must be updated to the Railway production host before cutover. The receiving routes must retain signature verification and return their required success status.

| Provider | Existing route family | Railway action |
|---|---|---|
| Stripe | `/api/stripe/webhook` | Update endpoint to the Railway HTTPS hostname and validate live webhook signing secret and subscription lifecycle events |
| SendGrid | `/api/webhooks/sendgrid` | Update event webhook destination to Railway and verify delivery/bounce event handling |
| Thinkific | `/api/webhooks/thinkific` | Update destination only if the legacy integration remains enabled; preserve signature and duplicate-event handling |
| Other provider callbacks | Application `/api/*` callback routes | Inventory active endpoints in each provider dashboard, change to Railway, and perform a signed delivery test |

### Exact Active Webhook URLs

| Provider | Railway production HTTPS destination | Verification requirement | Provider console action |
|---|---|---|---|
| Stripe | `https://app.allaboutultrasound.com/api/stripe/webhook` | Stripe signature verified with the Railway `STRIPE_WEBHOOK_SECRET`; event delivery returns success for live events | Replace existing production endpoint with this Railway URL; retain `/api/webhooks/stripe` only as an internally tested compatibility alias if needed |
| SendGrid Event Webhook | `https://app.allaboutultrasound.com/api/webhooks/sendgrid` | SendGrid signed event payload validation where configured; process only authenticated events | Update SendGrid Event Webhook HTTP Post URL and send a signed test event |
| Thinkific | `https://app.allaboutultrasound.com/api/webhooks/thinkific` | Existing Thinkific verification/duplicate handling remains enabled | Update Thinkific only if the legacy webhook remains active; submit a test delivery after the Railway deploy |

The production provider dashboards, not source code, are the authoritative list of enabled endpoints. Before DNS cutover, compare each configured endpoint with this table and disable or replace any remaining Manus-hosted destination.

## DNS Cutover Sequence

1. Deploy and validate the Railway service on its Railway-generated hostname.
2. Add every custom domain in Railway and complete the required DNS records at the authoritative DNS provider.
3. Configure provider webhooks to the Railway HTTPS URLs and confirm signed deliveries.
4. Validate cookies, authentication, email links, checkout, media, and learner content on every hostname.
5. Switch production DNS after validation, monitor traffic and error logs, and retain a documented rollback DNS record until stable.
