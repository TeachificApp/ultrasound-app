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

## Parallel validation

Validate a representative non-destructive set of routes and roles on the Manus environment: administrator content editing, rich-text image upload, course/lesson playback, standalone quiz access, results visibility, entitlement checks, email generation, and one test checkout. Compare counts for users, active enrollments, products, courses, quizzes, and media metadata against Railway. The acceptance criterion is parity for the verified scope, not merely a successful build.

## Final cutover — explicit approval required

After written approval, update only the required DNS records to the validated Manus service. Monitor sign-in, checkout, editor upload, and error logs during the defined cutover window. Retain Railway as a live rollback target until production behavior is stable for the agreed observation period.

## Rollback

If a critical production path fails after DNS change, restore the previous Railway DNS records, keep the Railway database as the production write target, and record the discrepancy for remediation. Do not migrate partial database writes back and forth without a reconciled migration plan.

## Current decision status

Railway remains the production host. The Manus migration checklist is prepared for review only. No DNS, hosting, user, course, payment, email, or database data has been changed by this planning work.
