# Published Learning Content Integrity Audit

## Purpose

This is a **read-only operational audit** for learner-facing course and standalone-quiz display integrity on the Learn domain. It validates the published records in live MySQL and checks their public course landing routes without changing course, quiz, question, media, enrollment, or learner data.

## Runbook

Run from the project root with the production database environment available:

```bash
node scripts/auditPublishedLearningContent.mjs
```

The audit writes its detailed JSON output to:

```text
tmp/published-learning-content-audit.json
```

An audit exits non-zero only when it finds an **error**. Warnings flag external provider availability that needs a human follow-up but do not automatically indicate a broken internal record.

## What It Checks

| Area | Validation |
|---|---|
| Public courses | Every `public` course has one or more published lessons and a working `/courses/:slug` landing route on `learn.allaboutultrasound.com`. |
| Published lessons | Resolves each lesson to its owning public course; validates JSON content blocks; rejects video/embed lessons with no playable source. |
| Media Library links | Detects missing/deleted media assets and missing current media versions. |
| SCORM packages | Requires interactive package extraction to be complete with an extracted prefix and launch file. |
| LMS quizzes | Requires each published LMS quiz lesson to have a quiz record with questions. |
| Inline lesson quizzes | Rejects a published Lesson Quiz block when it has no questions. |
| Standalone quizzes | Requires published standalone quiz lessons and direct standalone quizzes to have linked or visual-builder questions. |
| External embeds | Performs bounded HTTP availability checks for external embedded content. |

## October 5, 2026 Completed Verification

The live audit returned **0 errors and 0 warnings** after the following record-level corrections:

1. Four POCUS Fundamentals quiz placeholders had been published with no questions. They were set back to **draft**, preserving the records for future authoring while removing empty assessments from learner view:
   - Basic Ultrasound Physics Concepts Quiz
   - Sound Waves Concepts Quiz
   - Ultrasound Imaging Instrumentation Concepts Quiz
   - Doppler Imaging Concepts Quiz
2. An empty **CME Quiz** placeholder in the All About LV Mechanical Support CME course was also set back to **draft**. It remains available for validated assessment authoring but is no longer shown as an empty learner assessment.
3. The ACS Sample Test & Learn Quiz in the published ACS Registry Review Quiz and ACS Mastery Course was repointed from a retired `app.iheartecho.com/api/media/.../view` URL to its working Learn-hosted SCORM player.
4. The Pediatric Echocardiography Registry Review SCORM quiz was verified intact and rendering from its existing Learn-hosted package; it was **not deleted**.

### Result Summary

| Metric | Result |
|---|---:|
| Public course/quiz products checked | 31 |
| Published lessons checked | 811 |
| Published standalone quizzes checked | 1 |
| Errors | 0 |
| Warnings | 0 |

> This audit is an integrity check, not a substitute for medical/editorial review. Draft quiz placeholders must be supplied with validated assessment questions before they are republished.

## Learner Dashboard Contract Check

Use the companion **read-only** dashboard audit to invoke the same `dashboard.getMyContent` procedure used by a signed-in learner. It selects anonymous eligible records and reports only aggregate assertions; it never writes learner, course, quiz, membership, Stripe, or MySQL data.

```bash
pnpm tsx scripts/validateLearnerDashboardContent.mts
```

The October 5, 2026 check confirmed that an eligible learner receives an active LMS quiz-course card and that a learner with both active brand memberships receives non-empty **UltrasoundAssist™** and **EchoAssist™** card images. The focused learner-dashboard test suite also passed 33 assertions covering quiz discovery, standalone-result privacy/navigation, and dashboard URL actions.

> There were no completed published standalone-system quiz attempts in live MySQL at this check. The results UI is covered by focused regression tests, but a future completed learner attempt is required before the live results-row portion of the dashboard validation can be closed without creating artificial learner data.
