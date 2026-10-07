# Standalone Quiz Approved-Access Surface Audit

## Policy

Published **Quiz Creator** quizzes are not independently purchasable or discoverable content. They may be opened only:

1. as a `standalone_quiz` lesson inside a learner's active enrolled course; or
2. through an administrator-generated, active, expiry-bound HTML widget credential.

A learner may continue to view their own completed result, but that result does not grant a new quiz launch path.

## Audited surfaces

| Surface | Expected behavior | Validation |
|---|---|---|
| Education Library and Learn home catalog/search | No Quiz Creator records are queried or rendered | `lmsRouter.ts`, `EducationLibrary.tsx`, and `LMSHome.tsx` are covered by `standaloneQuizPublicSurfaceAudit.test.ts`. |
| Funnel, direct checkout, and order-bump picker | Only LMS courses with type `quiz` may be checkout targets; Quiz Creator records are absent | `funnelRouter.listAllProducts` no longer queries `standaloneQuizzes`. |
| Public availability waitlist | Quiz Creator records cannot be selected as a waitlist target | `contentAvailabilityRouter` does not accept a `quiz` product type. |
| Learner dashboard and in-page search | Assigned Quiz Creator cards open the assigned course player at the saved lesson; historic results are results-only | `dashboardRouter.ts` requires an active enrollment before adding an assigned quiz card; `StudentDashboardPage.tsx` links it to `/courses/:slug/player?lesson=:lessonId`. |
| Direct `/quizzes/:id` player route | Direct learner launches are rejected without course context or an approved widget credential | `embeddedQuizCourseAccess.ts` explicitly returns `FORBIDDEN` for a direct non-widget launch. |
| HTML widget | An active opaque widget token remains a valid approved route, independent of LMS assignment | Existing widget-launch tests and `standaloneQuiz.embedWidget.test.ts`. |
| Campaign and community pickers | Quiz Creator quizzes cannot create an inaccessible content link | Campaign and community catalog queries exclude `standaloneQuizzes`. |

## Regression coverage

Run the focused audit with:

```bash
JWT_SECRET=local-test-secret STRIPE_SECRET_KEY=sk_test_dummy_key_for_tests_only \
  pnpm vitest run \
  server/standaloneQuizPublicSurfaceAudit.test.ts \
  server/embeddedQuizCourseAccess.test.ts \
  server/standaloneQuiz.embeddedWorkflow.test.ts \
  server/standaloneQuizCheckoutExclusion.test.ts \
  --pool=threads --poolOptions.threads.singleThread=true
```

The audit tests use source contracts plus authorization tests. They do not create learner accounts, quiz attempts, enrollments, or purchases.

## Live database check

A read-only query on 7 October 2026 found one published Quiz Creator quiz. It had **no** course lesson assignment and **no** active widget launch. Because the platform no longer exposes unassigned standalone quizzes through catalog, checkout, waitlist, campaign, community, dashboard, or direct learner routes, that record is intentionally not discoverable until an administrator assigns it to a course lesson or generates an approved widget launch.
