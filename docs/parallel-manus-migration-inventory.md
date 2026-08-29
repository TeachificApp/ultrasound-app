# Parallel Manus Migration Inventory

**Prepared:** August 29, 2026 (EDT)  
**Scope:** Read-only preparation for a Railway-to-Manus **parallel test environment**. Railway remains the production source of truth. No DNS, hosting, credential, user, payment, content, or database change is authorized by this document.

## Executive status

The application source is currently on `main` at checkpoint `3cfecf17`, with only the migration planning documents and task record modified after that checkpoint. Railway remains the active production environment. The Manus project has a full-stack test environment with database and user-management capabilities, but the existing Manus database cannot be treated as a current copy of Railway without a source export and formal reconciliation.

| Workstream | Current evidence | Readiness | Blocking evidence before any import |
| --- | --- | --- | --- |
| Source and build | Railway uses Nixpacks, `pnpm install && pnpm build`, `pnpm start`, and `/api/health`; source branch is `main`. | Partially ready | Record Railway’s active commit and compare a Manus test build from that exact commit. |
| Data schema | The source code declares 342 MySQL tables; the current Manus database reports 355 base tables and approximately 340,052 rows. | Not ready for import | Export Railway DDL plus per-table counts and reconcile the 13-table structural difference before copying data. |
| Core data | 102 named course, quiz, enrollment, payment, email, subscription, and media tables were identified as an initial parity sample. | Not ready for import | Produce a consistent Railway snapshot with counts, IDs, foreign-key relationships, and media reference samples. |
| Authentication | Railway is configured for the local authentication backend; the Manus target has managed user capability. | Not ready for cutover | Map password, magic-link, cookie, role, and identifier behavior using test accounts only. |
| Object storage | Railway uses R2 configuration for application storage; editor write access is unresolved. | Not ready for import | Confirm source bucket permission, object inventory, URL/prefix mapping, and target storage behavior with representative non-production objects. |
| Payments, email, webhooks | Stripe, SendGrid, and campaign tracking are source dependencies. | Not ready for cutover | Define isolated test-mode routes, signing secrets, sender checks, and idempotency protections. |
| AI and scheduled work | Synchronous AI generation is not working reliably in Railway. Scheduled jobs are application dependencies. | Not ready for feature parity | Validate the Manus-side AI, job, and provider configuration with synthetic test prompts and no live campaign sends. |
| Domains | Railway currently serves the production learning hostname. | Ready for staging only | Use Manus staging domains; no production DNS change. |

## Environment and integration inventory

The source references **74 runtime environment identifiers**. The migration should reproduce required configuration by category rather than copying values.

| Category | Examples of required configuration categories | Migration treatment |
| --- | --- | --- |
| Core runtime | Node environment, port, application URLs, canonical domains | Recreate from non-secret deployment configuration; validate host-specific redirects. |
| Database and session | Database URL, local-auth setting, JWT/session configuration | Do not copy production database credentials; create a target-specific connection and fresh non-production session settings. |
| Object storage | R2 account, bucket, S3 endpoint, access-key pair, public delivery base | Provision through secure target settings; preserve object metadata and references, not database BLOBs. |
| Payments | Stripe server key, webhook signing secret, public key | Use a dedicated test endpoint and test-mode events before any production cutover. |
| Email | Sender profile, delivery key, webhook verification key | Verify SPF/DKIM/DMARC and one controlled test message; do not send a campaign. |
| AI and media | Forge/direct model endpoint and key, Manus task configuration, image generation | Configure through secure target settings and test bounded authoring prompts before enabling production use. |
| External content | Thinkific, BookVault, Printful/Printify, Shopify, SCORM and media tools | Inventory enabled dependencies individually; defer inactive integrations rather than invent credentials. |

## Initial parity sample

The following areas require parent-to-child reconciliation, not an arbitrary whole-database import. The listed families are derived from the current source schema and should be confirmed against the Railway export.

| Family | Representative tables or dependencies | Minimum parity check |
| --- | --- | --- |
| Identity and access | `users`, user aliases, membership plans/subscriptions, access grants | Count users by active state, map stable IDs, verify administrator and learner role grants. |
| LMS and CME | LMS courses, lessons, enrollments, lesson progress, quiz attempts, CME entries | Validate parent records before children; reconcile active access and completion state. |
| Standalone quizzes | Quizzes, questions, answer choices, access grants, attempts, widget launches | Reconcile published settings, question ordering, attempts, and protected widget behavior. |
| Commerce | Digital purchases, bundles, funnel purchases, subscriptions, Stripe sync records | Test idempotent Stripe webhook fulfillment in the Manus test environment. |
| Campaigns and messaging | Campaigns, lists, subscribers, templates, events, send logs | Preserve business metadata only; do not send or replay past messages. |
| Media | Media assets, versions, folders, upload sessions, access rules | Compare object keys, URLs, size, content type, and representative retrieval; do not store media bytes in the database. |

## Source data required from Railway

The Railway dashboard has confirmed that a dedicated MySQL service exists, but no source DDL, counts, connection string, backup, or data has been accessed in this preparation. Before a dry run, obtain an owner-controlled, encrypted point-in-time export with the following artifacts:

1. Schema-only DDL and an index/constraint manifest.
2. Per-table row counts and maximum updated timestamp where available.
3. A consistent, encrypted data export or read-only replica access limited to the approved migration scope.
4. An R2 object manifest containing keys, size, media type, and checksum or ETag—never object credentials.
5. A variable-name and integration-status manifest with all values redacted.
6. A webhook endpoint and event-subscription manifest with signing values redacted.

## Manus restoration prerequisite

The official Manus process relies on an existing Task Data Backup. Backups are fixed snapshots, the published backup window ended on August 23, 2026, and restoration can be completed only once with complete matching backup packages. Confirm the backup package is complete and belongs to the original account or team before using restoration as the basis for the Manus parallel environment. Re-enable restored connectors only after verification. [1] [2]

On August 29, 2026, the Manus Backup & Restoration portal exposed restoration options and no new backup-export option. This is consistent with the published post-cutoff restoration state. The portal view did not expose, open, upload, or restore any package. Backup package existence, ownership, and completeness remain owner-confirmation prerequisites.

The project owner confirmed that the required backup was already uploaded and that the current UltrasoundAssist Manus project is the intended restored environment. The current project title, full-stack capabilities, source tree, database access, and deployed-domain inventory are consistent with that stated scope. The backup manifest was not reopened and no repeat restoration was attempted, because restoration is a one-time operation. The remaining work is a no-write reconciliation between this restored Manus environment and the active Railway source of truth.

## Manus test-environment requirements

The current Manus project already has database and user-management capabilities. Its target environment should use target-specific configuration rather than Railway production values.

| Area | Manus test requirement | Railway value handling |
| --- | --- | --- |
| Database | Use the Manus-provisioned `DATABASE_URL` in the test environment. | Do not copy or retain the Railway MySQL connection string. |
| Authentication | Test the Manus OAuth callback and target cookie settings on a non-production Manus domain. | Do not reuse Railway local-session cookies or signing material. |
| Object storage | Use the Manus-provided storage capability or an explicitly configured target bucket with a separate test prefix. | Do not import credentials into source code or overwrite Railway R2 configuration. |
| AI | Use the Manus server-side Forge capability only after the target restored/configured environment confirms it is available. | Do not rely on the Railway task-only key for interactive generation. |
| Payments | Use test-mode Stripe keys and a unique test webhook endpoint. | Do not point a Manus test webhook at live payment fulfillment. |
| Email | Use an isolated test sender or controlled recipient allowlist. | Do not send campaigns or replay delivery logs. |
| Domains | Use a Manus staging domain. | Do not rebind any current production hostname. |
| Background jobs | Keep production jobs disabled in the test environment until an idempotent test run is defined. | Do not allow two environments to send the same notification or process the same purchase event. |

The target application reads a defined environment contract for app identity, canonical domains, database, authentication, storage, AI, payment, email, and external fulfillment integrations. The test environment must be configured through secure settings only. Repository files must never contain secret values, database URLs, storage credentials, or webhook signing values.

## Phase 1 conclusion

The read-only inventory is complete enough to prepare a target environment and an import dry run. It is **not** evidence that Railway data has been backed up or that the target has parity. The target configuration requirements are now defined; the next phase is to design the backup, reconciliation, dry-run import, validation, and rollback plan. No production domain or data transfer will occur.

## Completed read-only reverse-sync baseline

The prior Manus-to-Railway transfer provides an existing foundation for reverse synchronization. A fresh metadata-only comparison now confirms 355 base tables in Railway and 355 in the restored Manus environment, with 351 shared table names. Of those shared tables, 297 have equal exact row counts and 54 have count differences. The environment-specific tables are preserved as implementation details: Railway has four identity/authentication support tables, while Manus has four SSO, widget-launch, and webhook support tables. No table is to be dropped merely to make the counts equal.

A second pass compared **hashed primary-key presence** in 20 high-priority identity, learning, assessment, commerce, and media tables. It retained neither raw identifiers nor application records. The result found 1,471 Railway-only keys and 185 Manus-only keys. The main source-side changes are newer user/access records, learner progress, Question Bank items, standalone quiz questions and attempts, commerce records, and a small number of media metadata records. Manus-only records remain in identity/access, learning, folders, commerce, and certificate families.

| Reconciliation family | Read-only result | Controlled reverse-sync rule |
| --- | --- | --- |
| Users, roles, memberships, subscriptions | Both Railway-only and Manus-only stable keys exist. | Compare by stable key and business relationship; do not overwrite either side from count deltas alone. |
| Courses and lessons | Course keys match; Manus includes a small number of target-only lesson/certificate records. | Preserve Manus-only records and assess each Railway change against its course and user parent. |
| Questions and standalone quizzes | Railway has 350 source-only Question Bank records, 350 quiz-question records, 11 attempts, and 150 attempt-answer records. | Stage in parent-to-child order: folders/tags, questions, quizzes, quiz questions, attempts, then answers. |
| Orders and purchases | Both environments have records absent from the other. | Reconcile on stable record and provider identifiers; never replay payment events or overwrite a conflict automatically. |
| Media metadata | Railway has a small set of source-only asset/version records. | Require an R2 object manifest and target-object availability check before metadata is staged. |

This baseline demonstrates that a controlled reverse sync is feasible but that a blind restore would lose the week of Railway activity or create conflicts. It is sufficient to formulate a test-import proposal after encrypted source backup evidence is available; it is not authorization to import records.

## Read-only referential and media-capacity evidence

The declared foreign-key review found three declared relationships in each environment and **zero orphaned relationships** in both. This is a limited integrity signal because most application relationships are managed by the application rather than declared database foreign keys. It supports, but does not replace, the stable-ID and parent-before-child staging checks required for any test import.

The source R2 aggregate inventory completed without reading bytes, object URLs, or object names. It reports **9,467 objects** totaling **10,055,720,462 bytes** across 28 top-level prefixes. The main capacity groups are the media repository (114 objects; approximately 5.43 GB), extracted SCORM content (8,402 objects; approximately 3.05 GB), page-builder media (318 objects; approximately 545 MB), dedicated media assets (2 objects; approximately 433 MB), certificates (408 objects; approximately 195 MB), digital files (17 objects; approximately 140 MB), and LMS editor images (67 objects; approximately 109 MB). This is sufficient for target storage capacity planning.

An **encrypted object-level manifest** and object-copy plan are still required before media metadata is imported. Object names, checksums, and references will be retained only in that encrypted migration artifact; they are not stored in this project documentation.

## References

[1] [Manus Help Center — How to Back Up Your Data](https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data)

[2] [Manus Help Center — How to Restore Your Data](https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data)
