# Manus-to-Railway Database Synchronization Plan

## Scope and Current Inventory

The source Manus-managed TiDB database contains **353 tables** and the Railway MySQL database contains **288 tables**. All Railway tables exist in Manus, while **65 source tables are absent from Railway**. Among the 288 common tables, **38 have different row counts**. No data was copied or modified during the inventory.

## Safety Rules

The synchronization must be **one-way from Manus to Railway**, must never delete Railway rows, and must not overwrite a Railway row when the corresponding source identity differs or cannot be safely matched. Rows must be staged, reconciled, and logged before they are inserted or updated. The operation must not modify Stripe, Thinkific, storage, email, or authentication secrets.

| Data category | Examples | Proposed handling |
|---|---|---|
| Reference and authoring data | courses, lessons, quizzes, question bank, templates, media metadata | Upsert only after primary-key and natural-key conflict review. Preserve Railway on ambiguous conflicts. |
| Learner access and learning records | enrollments, lesson progress, certificates, quiz attempts | Insert missing rows and merge only when learner, content, and unique activity identifiers agree. Never revoke access or alter completed status. |
| Financial and fulfillment records | orders, digital purchases, subscriptions, Stripe identifiers | Reconcile as append-only. Railway remains authoritative for existing live payment identities; report conflicts rather than overwrite them. |
| Operational configuration | app settings, landing-page content, email templates | Prepare a field-level diff. Apply only selected source-of-truth tables after approval. |
| Analytics and security logs | IP access, email events, view events, audit logs | Exclude from initial synchronization. Retain source as archive and optionally import later in append-only batches. |
| Source-only schema | 65 missing Railway tables | Generate additive Railway migrations first; no data migration until each schema change is reviewed. |

## High-Priority Reconciliation Sets

The initial dry run will prioritize learner-facing and content records with meaningful source/target count differences: `lms_certificates`, `question_bank`, `lms_lesson_progress`, `digital_purchases`, `lms_orders`, `lms_enrollments`, and `emailListSubscribers`. Large telemetry-only differences such as `ip_access_logs`, `mediaViewEvents`, `emailCampaignEvents`, and `email_send_log` remain excluded from the initial transfer.

## Approval Gates

1. Capture source and target schema manifests plus count reports.
2. Create a Railway backup/export and a reversible staging table set.
3. Produce a dry-run report showing inserts, safe updates, conflicts, and excluded rows per table.
4. Obtain explicit approval for the dry-run results and selected configuration source-of-truth policy.
5. Execute in ordered batches, verify counts and referential integrity, and retain the reconciliation log.

## Executed Initial Batch

The approved initial batch completed as an insert-only transaction on 22 August 2026. Railway received 122 Question Bank items, 37 LMS orders, 30 LMS enrollments, 104 lesson-progress records, 331 CME certificates, 57 digital purchases, and 25 email subscribers. No Railway rows were updated or deleted.

Before execution, Railway backups were captured for the seven affected tables. The backup manifest records the target row counts and SHA-256 checksums, without storing learner records in this repository. The subsequent read-only reconciliation confirmed equal primary-key counts across all seven synchronized tables, with zero remaining source-only insert candidates. Where reliable timestamp fields exist, the latest source and Railway timestamps also match.

Future batches must create the backup manifest before approval and must preserve backups outside the project repository, because the raw exports can contain learner information.
