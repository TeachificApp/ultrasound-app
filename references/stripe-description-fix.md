# Stripe Payment Description Fix

## Goal
Add `payment_intent_data.description` to every `mode: "payment"` checkout session,
and enrich `subscription_data.description` for subscription sessions.

## Description Format
`"<Product Name> — <Payment Type Label>"`

## Payment Type Labels by Context
- One-time course purchase: `"One-Time Purchase"`
- Subscription (initial): `"Subscription — Initial"`  
- Payment plan down payment: `"Payment Plan — Down Payment"`
- Payment plan installment: `"Payment Plan — Installment"`
- Workshop registration: `"Workshop Registration"`
- Digital download: `"Digital Download"`
- Digital bundle (one-time): `"Digital Bundle — One-Time Purchase"`
- Digital bundle (subscription): `"Digital Bundle — Subscription"`
- Physical product: `"Physical Product"`
- Membership (one-time): `"Membership — One-Time"`
- Membership (subscription): `"Membership — Subscription"`
- Brand membership: `"Membership — <Plan Type>"`
- Funnel/sales page: `"Sales Page Purchase"`
- Career network: `"Career Network — <Plan Type>"`
- Team/group purchase: `"Team Purchase"`
- Webinar: `"Webinar Registration"`
- DIY product: `"DIY Product Purchase"`
- Cohort admin grant: `"Admin-Granted Enrollment"`
- Upgrade prompt: `"Course Purchase"` / `"Digital Download"` / `"Physical Product"`
- Form submission: `"Form Payment — <Form Name>"`

## Files to Edit
1. server/routers/lmsRouter.ts — lines 1528, 1569, 1625, 1815, 1838, 1902, 1927, 1949, 2984, 3062, 3140
2. server/routers/downloadsRouter.ts — lines 311, 474, 490, 608, 2088
3. server/routers/workshopRouter.ts — lines 606, 1453
4. server/routers/membershipRouter.ts — lines 817, 954
5. server/routers/brandMembershipRouter.ts — lines 381, 407, 451, 493, 531
6. server/routers/productsRouter.ts — lines 181, 323, 1271
7. server/routers/funnelRouter.ts — lines 746, 1284, 1915
8. server/routers/bundleRouter.ts — line 284
9. server/routers/careerNetworkRouter.ts — lines 819, 852
10. server/routers/teamRouter.ts — line 204
11. server/routers/webinarRouter.ts — line 429
12. server/routers/diyRouter.ts — line 773
13. server/routers/lmsCohortAdminRouter.ts — line 1636
14. server/lib/formStripeCheckout.ts — line 66

## Implementation Pattern
For `mode: "payment"` sessions, add:
```ts
payment_intent_data: {
  description: `${productName} — One-Time Purchase`,
},
```

For `mode: "subscription"` sessions, update `subscription_data.description`:
```ts
subscription_data: {
  description: `${productName} — Subscription — Initial`,
  metadata: { ... },
},
```
