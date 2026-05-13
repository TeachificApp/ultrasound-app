# iHeartEcho → UltrasoundAssist Multi-Tenant Migration Plan

## Architecture Overview

**Goal:** Run both apps from one codebase, one database, one deploy — differentiated by subdomain.

| Domain | App | Brand |
|--------|-----|-------|
| `app.allaboutultrasound.com` | UltrasoundAssist™ | aaus |
| `app.iheartecho.com` | EchoAssist™ | iheartecho |
| `learn.allaboutultrasound.com` | LMS (courses) | aaus (shared) |
| `member.allaboutultrasound.com` | Member dashboard (future) | shared |

## Brand Detection Strategy

1. Server middleware reads `req.hostname` and sets `ctx.brand` on every request
2. Frontend reads `window.location.hostname` at boot and loads the correct app shell
3. Vite serves a single SPA; the React root conditionally renders `<AAUSApp />` or `<IHeartEchoApp />`

## Schema Changes Required

### Tables to ADD (iHeartEcho-only, not yet in AAUS):
- `soundBytes` (+ soundByteViews, soundByteDiscussions, soundByteDiscussionReplies)
- `userPointsLog`, `userPointsTotals`
- `abTestEvents`
- `menuLinkConfig`
- `navigatorProtocolOverrides`
- `uploadJobs`
- `educatorTemplates`
- `accreditationChecklist`

### Tables to MODIFY:
- `users` → add `brandMemberships` concept (or use existing role system with brand scoping)
- Premium gating → brand-aware: iHeartEcho premium ≠ AAUS premium

### Tables already shared (78 tables):
All accreditation, educator, quickfire, case library, CME, DIY, physician, lab, media tables already exist in both projects.

## Server Router Migration

### iHeartEcho routers to copy into `/server/routers/`:
Most already exist in AAUS. The key differences are inline procedures in the main `routers.ts`:
- `accreditation` (inline router with createPeerReview, getPeerReviews, etc.)
- `lab` (inline router)
- `strain` (inline router)
- `iqr` (inline router)
- `echoCorrelation` (inline router)
- `physicianPeerReview` (inline router)
- `notification` (inline router)
- `accreditationReadiness` (inline router)
- `accreditationReadinessNavigator` (inline router)
- `accreditationChecklist` (inline router)
- `caseMix` (inline router)
- `cme` (inline router)
- `physicianOverRead` (inline router)
- `caseStudies` (inline router)
- `stats` (inline router)
- `demo` (inline router)
- `menuLinks` (inline router)

### Already migrated routers (exist in both):
- quickfireRouter, caseLibraryRouter, premiumRouter, scanCoachAdminRouter, diyRouter,
  meetingRouter, formBuilderRouter, accreditationManagerRouter, educatorRouter,
  leaderboardRouter, emailCampaignRouter, engagementRouter, soundBytesRouter,
  abTestRouter, navigatorAdminRouter, mediaRouter, emailAuthRouter, cmeRouter, adminRouter

## Frontend Migration

### iHeartEcho pages (~102K lines, 107 files):
All page components go into `client/src/pages/iheartecho/` namespace.

### Key components to migrate:
- `Layout.tsx` → becomes `IHeartEchoLayout.tsx`
- `RoleGuard.tsx` → shared (already exists in AAUS as premium gating)
- All navigator/ScanCoach pages (EchoAssist, TTE, TEE, ICE, UEA, HOCM, Strain, etc.)
- QuickFire, Flashcards, Case Library, SoundBytes, Leaderboard
- Accreditation tools (AccreditationTool, AccreditationNavigator, etc.)
- Lab Admin, Platform Admin
- Educator platform pages

### Brand-aware routing:
```tsx
function App() {
  const brand = detectBrand(); // reads window.location.hostname
  if (brand === 'iheartecho') return <IHeartEchoApp />;
  return <AAUSApp />;
}
```

## Premium Subscription Separation

- AAUS premium: existing Stripe products (monthly/annual for UltrasoundAssist)
- iHeartEcho premium: separate Stripe products (monthly/annual for EchoAssist)
- A user can hold both, one, or neither
- The `users.isPremium` field becomes brand-scoped (or we add a `brandMemberships` table)

## Migration Execution Order

1. Add brand infrastructure (detection, context, membership table)
2. Migrate missing schema tables
3. Copy iHeartEcho server routers (inline ones from routers.ts)
4. Copy iHeartEcho page components into `client/src/pages/iheartecho/`
5. Create IHeartEchoLayout and IHeartEchoApp shell
6. Wire subdomain routing in App.tsx
7. Add iHeartEcho Stripe products
8. Test both apps at their respective domains
