# Railway Learning Content and User-Access Synchronization

## Scope and safeguards

This migration reconciled the learning-content and learner-access records that were present in the Manus source but absent from Railway. The work was performed with a fixed allowlist, matched single-column primary keys, source/target schema compatibility checks, a fresh Railway pre-write manifest, and insert-only transactions. It did not issue an `UPDATE` or `DELETE`, and it excluded credentials, passwords, session data, access tokens, raw webhook payloads, and email-delivery tokens.

## Completed batch

The fresh read-only audit identified **58** missing source records over the following tables. The guarded execution inserted all 58 records with **zero** unique-key conflicts and **zero** foreign-key conflicts.

| Area | Tables | Records inserted |
|---|---|---:|
| CME and downloads | `cme_generic_disclosures`, `digital_download_events` | 3 |
| LMS content and instructional relationships | `lms_instructors`, `lms_course_instructors`, `lms_lessons`, `lms_lesson_instructors` | 5 |
| Learner notes, bookmarks, progress, and enrollments | `lms_lesson_notes`, `lms_lesson_bookmarks`, `lms_lesson_progress`, `lms_enrollments` | 6 |
| Media content | `mediaAssets`, `mediaVersions` | 2 |
| Case attempts, memberships, question-bank folders, and quiz attempts | `echoLibraryCaseAttempts`, `membership_subscriptions`, `question_bank_folders`, `quickfireAttempts` | 42 |

## Verification

The post-write read-only primary-key reconciliation returned **16 of 16 synchronized tables in parity**: every source primary key in this inserted scope is now present in Railway. A subsequent full learning-content and user-access sweep found **144 non-sensitive tables in parity**. The sole composite-key table not amenable to the generic single-key scan contained zero rows in both environments and was separately verified as in parity. The remaining **12 excluded tables** contain session, token, webhook, or operational IP-address data rather than transferable content or access entitlements. Source and Railway row counts match for each synchronized table. The pre-write Railway manifest and both pre/post reconciliation reports were retained in the operator workspace without exposing personal records or secret values.

## Remaining scope

This batch brings the audited source content and learner-access gaps into Railway parity. It does not copy sensitive authentication or provider material, and it does not replace pre-existing Railway-only records. The broader Railway cutover still requires runtime, email-provider, custom-domain, webhook, storage, and service validation before production traffic can be considered fully independent of Manus.
