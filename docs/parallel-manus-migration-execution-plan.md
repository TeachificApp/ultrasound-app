# Parallel Railway-to-Manus Migration Execution Plan

**Status:** Planning only.  
**Source of truth:** Railway production.  
**Target:** A separate Manus test environment.  
**Cutover status:** Not approved. No production DNS, hosting, database, payment, email, or user change is authorized by this plan.

## Migration guardrails

The migration must be additive, reversible, and observable. Railway remains the only production write target until the user gives separate written approval for a final cutover. The Manus environment uses staging domains, test-mode payment events, controlled email recipients, and jobs disabled by default. Secrets are configured only through secure environment settings; they must never appear in source code, migration files, logs, reports, or chat.

| Guardrail | Requirement |
| --- | --- |
| No destructive source action | Do not delete, truncate, update, or repoint anything in Railway during preparation or test import. |
| Stable migration point | Record a Railway source timestamp and source commit before every export; invalidate a dry run if the source moves materially afterward. |
| No production side effects | Disable scheduled jobs, live campaign delivery, live checkout fulfillment, and production webhook destinations in Manus staging. |
| Identity protection | Never copy password hashes, raw session tokens, OAuth tokens, or webhook secrets into reports, source control, or a different environment. |
| Media handling | Copy object bytes only through authorized object storage; database records retain references and metadata, never BLOB file data. |
| Reversibility | Preserve Railway database, R2 objects, environment, and DNS as the rollback target throughout parallel validation. |

## Phase A — source backup evidence

The Railway owner should create a coherent, encrypted source backup and retain it outside both application repositories. The package should include schema DDL, data, and object manifests from the same migration window. A code archive alone is not sufficient to reconstruct application state.

| Artifact | Required source evidence | Acceptance check |
| --- | --- | --- |
| Application release | Active Railway commit, build command, health-check result, and release timestamp | Manus staging builds the same commit and returns a healthy application response. |
| Database schema | Schema-only DDL, index/constraint manifest, and character-set/collation metadata | Diff against Manus target before data import; resolve all structural differences explicitly. |
| Database data | Consistent encrypted logical export or approved read-only replica snapshot | Store export checksum, timestamp, table counts, and source-row totals. |
| Object storage | R2 key manifest containing key, size, media type, ETag/checksum, and prefix | Verify a sampled set of objects and all referenced keys after target transfer. |
| Settings and providers | Redacted variable-name manifest, webhook/event manifest, and service dependency inventory | Recreate required categories through target secure settings; do not reuse a production secret by copying it through a document. |
| Manus restoration package | Confirm that the original account/team has complete Task Data Backup packages before restoration | Use complete matching packages together; restoration is a one-time action. [1] [2] |

## Phase B — schema and reconciliation dry run

No target data import begins until schema parity is documented. The source code currently declares 342 MySQL table definitions, while the Manus target database reports 355 base tables. This difference must be classified as: target platform support table, obsolete source table, renamed table, missing migration, or intentionally excluded object. It must never be silently ignored.

| Reconciliation level | Comparison | Pass criterion |
| --- | --- | --- |
| Structure | Tables, columns, data types, nullability, defaults, indexes, constraints, triggers | Every difference has an approved mapping or an explicit test-only exclusion. |
| Relationships | Parent-before-child order and foreign-key references | Import order is deterministic and has no orphaned child records. |
| Counts | Per-table source and target counts | Counts match after applying approved exclusions and documented platform tables. |
| Identity | Stable primary IDs, unique emails/open IDs, role grants | No collision, duplicate, or silent remap; unresolved identities are quarantined for review. |
| Timestamps | Creation, update, completion, enrollment, purchase, and attempt timestamps | All values retain UTC semantics and expected precision. |
| Media | Database reference to object manifest | Every required reference resolves to a target object with expected metadata. |

The dry run produces reports only: a table mapping, row-count delta report, schema-diff report, identity-collision report, media-reference report, and a list of excluded data. It must not write to the Manus production database, send email, dispatch a job, or call a live payment provider.

## Phase C — Manus staging import and validation

After the user reviews the dry run, import only the approved data into the isolated Manus test environment. The test may use a timestamp-bounded source export or an explicitly selected dataset. Never use the Manus staging environment to process live Stripe events or email campaigns.

| Validation domain | Required test |
| --- | --- |
| Public and authenticated routes | Verify staging-only page, login, logout, administrator role, learner role, redirects, and cookie scope. |
| Learning content | Open representative courses, lessons, SCORM blocks, quizzes, flashcards, progress, certificates, and downloadable assets without modifying learner records. |
| Quiz administration | Verify Quiz Creator settings, default-off read-aloud, both voice selections, Visual Builder save/read, and native-results visibility. |
| Media | Upload a non-production test image, retrieve it through the target URL, and verify content type and access handling. |
| AI | Run bounded non-production content, question, and image-generation prompts using target-authorized service configuration; do not send prompts that trigger external actions. |
| Commerce and email | Use test-mode checkout and a controlled recipient; verify webhook signature handling and no duplicate fulfillment. |
| Jobs and webhooks | Run one explicit idempotent test; do not enable recurring production schedules until reviewed. |
| Analytics | Validate that staging analytics use a separate property or are disabled, so production reporting is not polluted. |

## Cutover and rollback — not yet authorized

After a successful validation report and separate written approval, the final cutover would be limited to the necessary production DNS and provider endpoint changes. Railway must remain intact during an agreed observation window. The first critical issue in sign-in, payment fulfillment, content access, email, or storage triggers rollback: restore the previous Railway DNS/endpoint configuration and continue Railway as the write target. Do not attempt a reverse data merge until a reconciliation plan is approved.

## Approval gates

| Gate | Required decision | Current state |
| --- | --- | --- |
| Backup availability | Confirm current complete Manus Task Data Backup package availability and Railway source backup location | Pending owner confirmation |
| Source export scope | Approve database/table scope and media scope for a read-only snapshot | Pending |
| Staging configuration | Approve target-only secrets, test domains, and non-production provider modes | Pending |
| Dry-run review | Approve the reconciliation report and explicit exclusions | Pending |
| Staging import | Approve a no-production-impact Manus test import | Pending |
| Final DNS cutover | Approve a scheduled cutover and rollback window | Not requested |

## References

[1] [Manus Help Center — How to Back Up Your Data](https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data)

[2] [Manus Help Center — How to Restore Your Data](https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data)
