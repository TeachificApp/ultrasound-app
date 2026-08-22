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

The existing inventory and reconciliation utilities will be reused and extended for this read-only dry run. The previously approved insert-only sync utility must not be used for this batch until the fresh artifacts are reviewed and a separate approval is recorded.

## Read-Only Dry-Run Checklist

1. Capture source and Railway schema definitions and row counts for every proposed table.
2. Capture source and Railway freshness markers, where the table provides timestamps.
3. Produce a user-identity reconciliation report before attempting any Teach ownership mapping.
4. Produce a primary-key conflict report and foreign-key dependency report in the documented parent-to-child order.
5. Stop without writing to either database and present the resulting report for explicit approval.

## Fresh Read-Only Dry-Run Result — 2026-08-22

The current report is archived at `/tmp/railway-next-batch-dry-run.json`. It inspected the exact source tables and the Railway schema without creating tables, altering columns, exporting backups, or changing data. Railway does **not** currently contain a `users` table or any of the proposed Teach/live-game tables. Consequently, it was not possible to calculate cross-database user-ID, email, or OpenID conflicts; copying user identifiers unchanged would be unsafe and is not proposed.

| Order | Table | Manus rows | Railway table | Freshness marker | Result | Proposed inserts |
|---:|---|---:|---|---|---|---:|
| 1 | `users` | 14,749 | Absent | `updatedAt`: 2026-08-22T19:41:48Z | **Excluded.** Requires a separately approved identity, authentication, credential-exclusion, and ID-mapping design. | 0 |
| 2 | `userRoles` | 5,618 | Absent | `createdAt`: 2026-08-22T16:41:21Z | **Excluded.** Role/authorization data follows the separate identity plan. | 0 |
| 3 | `teach_folders` | 0 | Absent | `updated_at`: none | Blocked by owner identity mapping. | 0 |
| 4 | `teach_slide_masters` | 1 | Absent | `updated_at`: 2026-06-17T19:33:04Z | Blocked by owner identity mapping. | 0 |
| 5 | `teach_materials` | 1 | Absent | `updated_at`: 2026-06-19T04:51:46Z | Blocked by owner and related-record mapping. | 0 |
| 6 | `teach_material_permissions` | 0 | Absent | `created_at`: none | Blocked by material and user mapping. | 0 |
| 7 | `sonoQuizzes` | 0 | Absent | `updatedAt`: none | Schema-only candidate after identity review; no data proposed. | 0 |
| 8 | `sonoQuizQuestions` | 0 | Absent | `updatedAt`: none | Schema-only candidate after parent-schema review; no data proposed. | 0 |
| 9 | `sonoQuizSessions` | 0 | Absent | `createdAt`: none | Blocked by host identity mapping. | 0 |
| 10 | `sonoQuizParticipants` | 0 | Absent | `joinedAt`: none | Blocked by session and optional user mapping. | 0 |
| 11 | `sonoQuizAnswers` | 0 | Absent | `answeredAt`: none | Schema-only candidate after parent-schema review; no data proposed. | 0 |

The report captured the source `CREATE TABLE` definition for each missing Railway table as **candidate additive DDL only**. These definitions are not approved to run. The next durable batch must also omit sensitive user-authentication fields from any identity design; the authentication system must be independently designed rather than copied from the managed source environment.

## Explicit Approval Gate

| Proposed action | Current status | Conditions before any execution |
|---|---|---|
| Create any Railway identity or Teach/live-game table | **Not approved** | Approve exact additive DDL after an identity/authentication and ID-mapping design is documented. |
| Copy users or role assignments | **Not approved** | Calculate user-ID, normalized-email, and OpenID conflicts against the chosen Railway identity store; exclude credentials, reset tokens, magic links, access tokens, and other managed-auth secrets. |
| Copy Teach materials or permissions | **Not approved** | Reconcile all referenced users and parent records, then produce fresh primary-key overlap and source-only counts. |
| Copy Teach game/session/participant/answer records | **Not approved** | Review parent completeness and active-session timing; only insert source-only rows after the identity mapping is proven. |
| Update or delete Railway rows | **Prohibited** | Not part of this synchronization policy. |

Before any approved write, create a new Railway backup manifest and checksums immediately before the first DDL or insert. The eventual execution must be transactionally safe, use only the specifically approved additive schema changes and insert-only rows, and finish with a fresh key/count/freshness reconciliation.
