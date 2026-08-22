# Railway Complete Data-Parity Record

## Result

Railway now contains every audited **non-sensitive** source user, course/content, learner-access, community, purchase, lead, newsletter, and Quickfire record, except for one email-list source primary key that is already represented by an identical Railway list/email pair under a different primary key. The reconciliation used primary-key comparison, dependency-ordered insert-only batches, and fresh pre-write target manifests. It did not update or delete an existing Railway row.

| Scope | Verified outcome |
|---|---|
| User identities | 14,750 source users and 14,750 Railway users; no missing source user IDs. |
| Learning content and learner access | 144 non-sensitive tables in primary-key parity after 58 missing records were inserted across 16 tables. |
| Remaining non-sensitive platform data | 44 missing records inserted across 9 tables, including community membership, digital purchase history, funnel data, newsletter subscription, case views, and Quickfire content. |
| Post-write validation | The 9-table closing audit found zero missing source primary keys and matching source/Railway counts for every synchronized table. |
| Full platform key sweep | Every equal-count non-sensitive platform table was scanned by primary key. The only non-zero source-key exception is the email-list semantic duplicate described below. |

## Verified schema-review coverage and semantic duplicate

Four source/Railway tables retain cross-engine column-name/schema review flags: `lms_cohort_groups`, `lms_courses`, `question_bank`, and `users`. Their data were independently covered by the completed content/access and identity primary-key audits, which found every source primary key present in Railway.

A closing audit reconfirmed that `lms_cohort_groups` (8 records), `lms_courses` (46 records), `question_bank` (1,454 records), and `users` (14,750 records) have matching counts and zero missing source primary keys. The composite-key `quiz_question_tags` relationship has zero records in both environments, so its `(question_id, tag_id)` key set is explicitly in parity.

The final `emailListSubscribers` source-only primary key could not be inserted because Railway already holds exactly one row matching its two-column `uq_list_email` business key. Railway therefore already preserves the subscriber/list relationship. The source row was retained as a documented primary-key alias rather than overwriting or deleting the existing Railway record.

## Deliberate exclusions

The migration intentionally excludes raw credentials, password material, session data, access/refresh tokens, OAuth artifacts, raw webhook data, magic-link delivery tokens, and operational IP/login/request logs. Those categories are not needed to preserve course content or current learner entitlements, and transferring them would create unnecessary security and privacy risk. Railway-specific local authentication records and identity mapping tables are target-only implementation records rather than missing source data.

## Operational boundary

This record verifies database content and access parity. Final production readiness still depends on the separate Railway runtime and infrastructure cutover: verified custom-domain routing, stable Railway-local session signing, email-provider delivery validation, storage/provider configuration, and provider webhook endpoint updates.
