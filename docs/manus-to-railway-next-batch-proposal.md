# Proposed Next Manus-to-Railway Synchronization Batch

## Scope

The next batch is limited to the missing Teach live-game tables and their learner ownership dependency. It does not authorize schema changes or data movement.

| Order | Table group | Purpose | Dependency / safeguard |
|---:|---|---|---|
| 1 | `users` | Preserves owner identities for migrated Teach games. | Reconcile by stable user identity before any insert; do not overwrite Railway users. |
| 2 | `teach_folders`, `teach_materials`, `teach_slide_masters`, `teach_material_permissions` | Restores teacher-authored teaching material. | Requires verified user ownership and additive schema review. |
| 3 | `sonoQuizzes`, `sonoQuizQuestions`, `sonoQuizSessions`, `sonoQuizParticipants`, `sonoQuizAnswers` | Restores live Teach/SonoQuiz game definitions and historical session data. | Insert in parent-to-child order after user/Teach dependencies; exclude active sessions from a migration window. |

## Required Dry Run Before Approval

The future batch must create a fresh source/target timestamp report, Railway backup manifest and checksums, foreign-key dependency report, primary-key conflict list, and source-only row count per table. It must not alter Railway data until a separate approval is given.
