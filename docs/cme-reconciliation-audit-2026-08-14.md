# CME Reconciliation Audit — 14 August 2026

The guarded `scripts/reconcileCmeCertificates.mjs` workflow was run against the production-connected project database after a read-only audit. The workflow deliberately considered only enrollments with recorded platform lesson progress and a non-zero stored progress percentage; imported rows without qualifying platform activity were excluded.

| Audit measure | Result |
| --- | ---: |
| Enrollments with qualifying recorded platform progress | 152 |
| Enrollments newly marked complete by canonical recalculation | 0 |
| Missing qualifying CME certificates recovered | 6 |

The reconciliation uses `recalcProgress` as the canonical completion check and only calls certificate recovery after the enrollment remains complete. It is safe to run again in audit mode; recovery is idempotent because certificate issuance checks for an existing certificate before generating another.
