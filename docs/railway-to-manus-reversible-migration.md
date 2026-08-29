# Reversible Railway-to-Manus Migration Checklist

**Purpose:** Provide a safe decision path for returning the platform to Manus-managed hosting without interrupting the current Railway production service. This is a planning document only; it does not authorize a cutover.

## Principle

Run Manus and Railway in parallel until the Manus copy is validated. **Do not delete Railway, change production DNS, cancel integrations, or alter the Railway database** during preparation. Production domains move only after the user explicitly approves the final cutover.

## Preparation

| Workstream | Required preparation | Completion evidence |
| --- | --- | --- |
| Source code | Save a stable checkpoint and confirm the intended GitHub revision | Recorded checkpoint/version and clean repository status |
| Database | Capture a read-only inventory and create an encrypted Railway MySQL backup | Table counts and backup completion record; no credential values in source control |
| Object storage | Inventory media references and preserve R2 object access during transition | Sampled course, quiz, and editor images remain reachable in the parallel environment |
| Authentication | Configure the Manus authentication path and verify administrator plus learner sessions | Successful sign-in, logout, password, and magic-link test accounts |
| Payments | Configure a separate test webhook and verify a non-production checkout completion | Verified test payment and entitlement; no live-payment replay |
| Email | Verify sender authentication and one test email from Manus | SPF, DKIM, and DMARC pass in the recipient mail client |
| Domains | Keep current production records unchanged; prepare DNS values with low TTL only after testing | Written cutover and rollback values reviewed before use |

## Manus restoration gate

The current official Manus guidance states that Task Data Backups are fixed snapshots and new backups could only be created before the published August 23, 2026 cutoff. As of August 29, 2026, a parallel Manus environment can be restored only if the relevant Task Data Backup already exists and belongs to the original Manus account or team. Restoration accepts complete matching backup packages once; connectors must be re-enabled afterward. This means the first prerequisite is **confirmation that the current All About Ultrasound project has a complete, verified backup package**, not a production DNS change. [1] [2]

The Backup & Restoration portal currently presents restoration options only. No backup was opened, uploaded, restored, or altered during this planning work.

If no current backup package exists, do not attempt a partial restore or replace the Railway production database with an older Manus copy. Retain Railway as the source of truth and contact Manus Support for account-specific restoration guidance.

## Parallel validation

Validate a representative non-destructive set of routes and roles on the Manus environment: administrator content editing, rich-text image upload, course/lesson playback, standalone quiz access, results visibility, entitlement checks, email generation, and one test checkout. Compare counts for users, active enrollments, products, courses, quizzes, and media metadata against Railway. The acceptance criterion is parity for the verified scope, not merely a successful build.

## Final cutover — explicit approval required

After written approval, update only the required DNS records to the validated Manus service. Monitor sign-in, checkout, editor upload, and error logs during the defined cutover window. Retain Railway as a live rollback target until production behavior is stable for the agreed observation period.

## Rollback

If a critical production path fails after DNS change, restore the previous Railway DNS records, keep the Railway database as the production write target, and record the discrepancy for remediation. Do not migrate partial database writes back and forth without a reconciled migration plan.

## Current decision status

Railway remains the production host. The Manus migration checklist is prepared for review only. No DNS, hosting, user, course, payment, email, or database data has been changed by this planning work.

## Read-only Railway evidence collected

| Item | Observed state | Migration implication |
| --- | --- | --- |
| Application service | The production application service is online in Railway’s US West region and serves `learn.allaboutultrasound.com`. | Keep this service as the rollback target until the Manus test environment completes parity testing. |
| Database service | The separate Railway MySQL service is online. | A source schema/count inventory and point-in-time backup are required before any test import. |
| Deployment source | Railway deployment history is GitHub-connected and has accepted the current application revision. | Record the intended commit/checkpoint for the Manus test deployment and compare build behavior. |
| Variables | Railway’s production service has a managed variable inventory; secret values were not viewed or recorded. | Recreate only required non-secret configuration names in Manus through secure settings; never copy secrets into repository files. |
| AI generation | The task-oriented Manus API is not suitable for synchronous editor generation, while a direct provider attempt received an HTTP 429 rate limit. | Keep direct AI completion configuration out of the migration cutover path until it passes a test-environment authoring check. |
| Domains | Railway production is actively bound to the learning hostname. | Do not change production DNS; use Manus-provided staging domains for test verification. |

The Railway MySQL service route was opened for a read-only review, but the dashboard did not expose service details or export controls in the available browser session. No connection string, database value, table data, backup, or export was accessed. The source database inventory and backup evidence therefore remain explicit prerequisites rather than assumed completed work.

## References

[1] [Manus Help Center — How to Back Up Your Data](https://help.manus.im/en/articles/16147892-service-change-overview-how-to-back-up-your-data)

[2] [Manus Help Center — How to Restore Your Data](https://help.manus.im/en/articles/16147895-service-change-overview-how-to-restore-your-data)
