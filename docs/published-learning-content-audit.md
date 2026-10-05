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
| Standalone quizzes | Requires published standalone quiz lessons and direct standalone quizzes to have linked or visual-builder questions. |
| External embeds | Performs bounded HTTP availability checks for external embedded content. |

## October 5, 2026 Completed Verification

The live audit returned **0 errors and 0 warnings** after the following record-level corrections:

1. Four POCUS Fundamentals quiz placeholders had been published with no questions. They were set back to **draft**, preserving the records for future authoring while removing empty assessments from learner view:
   - Basic Ultrasound Physics Concepts Quiz
   - Sound Waves Concepts Quiz
   - Ultrasound Imaging Instrumentation Concepts Quiz
   - Doppler Imaging Concepts Quiz
2. The ACS Sample Test & Learn Quiz in the published ACS Registry Review Quiz and ACS Mastery Course was repointed from a retired `app.iheartecho.com/api/media/.../view` URL to its working Learn-hosted SCORM player.
3. The Pediatric Echocardiography Registry Review SCORM quiz was verified intact and rendering from its existing Learn-hosted package; it was **not deleted**.

### Result Summary

| Metric | Result |
|---|---:|
| Public course/quiz products checked | 31 |
| Published lessons checked | 812 |
| Published standalone quizzes checked | 1 |
| Errors | 0 |
| Warnings | 0 |

> This audit is an integrity check, not a substitute for medical/editorial review. Draft quiz placeholders must be supplied with validated assessment questions before they are republished.
