# Railway Independent Identity and Authentication Migration Design

## Purpose

This design enables a controlled transition from the managed source database to Railway without preserving a dependency on managed OAuth or copying sensitive authentication material. It is the first required migration foundation because platform content, Teach ownership, live-game hosting, learner progress, and access grants all reference numeric user identifiers.

> **Safety invariant:** A source `users.id` may be preserved as the Railway `users.id` only while Railway has no existing `users` table and the migration confirms there is no competing target identity range. User credentials, authentication tokens, and managed-session data are never copied.

## Target Identity Model

| Target record | Purpose | Migration behavior |
|---|---|---|
| `users` | Canonical learner, educator, and administrator profile with the source numeric ID retained. | Insert-only, allowlisted profile/platform fields; no password or token fields. |
| `user_identity_migration_map` | Immutable audit mapping from source numeric ID to Railway numeric ID. | Insert one row per migrated source user. Initial mapping is one-to-one and ID-preserving. |
| `railway_auth_accounts` | Independent account state for email/password or passwordless activation. | Create `pending_activation` records only for source users with a unique normalized email. Do not copy password hashes or source authentication secrets. |
| `railway_auth_events` | Minimal non-secret audit trail for activation, password reset, login, and account recovery events. | Starts empty; populated only by the independent target authentication application after deployment. |
| `identity_migration_exceptions` | Holds duplicate-email, missing-email, or otherwise unclaimable accounts. | Insert-only review queue; does not prevent profile/data migration. |

## Authentication Policy

The independent application must authenticate against Railway-owned credentials and generate its own signed sessions and password-reset or magic-link secrets. Existing managed OAuth IDs may remain as non-authentication legacy references for reconciliation, but must not be a runtime login dependency. Source `passwordHash`, reset, magic-link, verification, access-token, and managed OAuth session fields are excluded from all target insert statements.

Initial account activation must remain **silent** during the database migration. No learner receives an email unless a separate approval covers the specific activation or recovery communication. Users with duplicate normalized emails or no usable email retain their records, enrollments, ownership, and history but require an administrative identity-resolution workflow before independent login activation.

## Migration Sequence

| Step | Controlled operation | Write policy |
|---:|---|---|
| 1 | Run a fresh identity-readiness report that counts duplicate/missing identity keys and user references without emitting personal data. | Read-only. |
| 2 | Back up the Railway schema and the new identity tables immediately before their first write. | Backup only. |
| 3 | Create the four additive identity/authentication tables. | Additive DDL only. |
| 4 | Insert all source user profiles using an explicit field allowlist, retaining `users.id`. | Insert-only. |
| 5 | Insert the one-to-one numeric ID map. | Insert-only. |
| 6 | Insert pending activation accounts only for unique valid emails. | Insert-only, no notifications. |
| 7 | Insert exception rows for duplicate/missing email identities. | Insert-only. |
| 8 | Reconcile user counts, IDs, ID-map coverage, activation counts, exceptions, and source/target freshness. | Read-only verification. |

## Non-Negotiable Exclusions

| Category | Examples | Reason |
|---|---|---|
| Source passwords and reset material | Password hashes, reset tokens, verification tokens, magic-link tokens. | Target must own authentication secrets and expiry lifecycle. |
| Persistent bearer-like data | Access tokens and managed OAuth/session artifacts. | These may grant access and must not be replicated into a new environment. |
| User communications | Activation, password-reset, or account-recovery emails. | Migration must not email users without separate approval. |
| Existing Railway rows | Any pre-existing target data. | This project uses non-destructive, insert-only migration; no updates or deletes are permitted. |

## Downstream Data Rule

Once `users.id` and `user_identity_migration_map` are verified, tables that reference user IDs can retain their numeric foreign-key values. Every future batch must still compare source and Railway schemas, back up Railway immediately before writing, insert only source-only primary keys, and reconcile counts and freshness afterward.
